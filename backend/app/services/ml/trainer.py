"""Train and compare supervised and unsupervised ecosystem-risk models."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    precision_recall_fscore_support,
)
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .config import MLTrainingConfig
from .feature_builder import MLFeatureDataset
from .models import (
    ClassificationMetrics,
    MLTrainingResult,
    ModelBenchmark,
    VersionedPredictor,
)
from .splitting import DatasetSplit

MODEL_SCHEMA_VERSION = "1.0.0"
SELECTION_RULE = "highest validation PR-AUC, then validation F1, then model name"


class MLModelTrainer:
    """Fit all Phase 6 candidates and select without consulting held-out test labels."""

    def __init__(self, config: MLTrainingConfig | None = None) -> None:
        self.config = config or MLTrainingConfig()

    def train(self, dataset: MLFeatureDataset, split: DatasetSplit) -> MLTrainingResult:
        candidates = (
            self._train_random_forest(dataset, split),
            self._train_xgboost(dataset, split),
            self._train_isolation_forest(dataset, split),
        )
        selected_predictor, _ = max(
            candidates,
            key=lambda item: (
                item[1].validation.pr_auc,
                item[1].validation.f1,
                item[1].name,
            ),
        )
        benchmarks = tuple(item[1] for item in candidates)
        return MLTrainingResult(
            selected_model=selected_predictor.name,
            selection_rule=SELECTION_RULE,
            predictor=selected_predictor,
            benchmarks=benchmarks,
            split_counts=split.counts(dataset.labels),
        )

    def _train_random_forest(
        self, dataset: MLFeatureDataset, split: DatasetSplit
    ) -> tuple[VersionedPredictor, ModelBenchmark]:
        estimator = RandomForestClassifier(
            n_estimators=240,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=self.config.random_seed,
            n_jobs=-1,
        )
        return self._fit_supervised("random_forest", estimator, dataset, split)

    def _train_xgboost(
        self, dataset: MLFeatureDataset, split: DatasetSplit
    ) -> tuple[VersionedPredictor, ModelBenchmark]:
        try:
            from xgboost import XGBClassifier
        except ImportError as error:
            raise RuntimeError(
                "XGBoost is required for the Phase 6 comparison; "
                "install the backend[ml-xgboost] extra"
            ) from error

        train_labels = dataset.labels[split.train_indices]
        positives = max(1, int(train_labels.sum()))
        negatives = max(1, len(train_labels) - positives)
        estimator = XGBClassifier(
            n_estimators=220,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.9,
            colsample_bytree=0.9,
            min_child_weight=2,
            reg_lambda=2.0,
            scale_pos_weight=negatives / positives,
            objective="binary:logistic",
            eval_metric="aucpr",
            random_state=self.config.random_seed,
            n_jobs=1,
        )
        return self._fit_supervised("xgboost", estimator, dataset, split)

    def _fit_supervised(
        self,
        name: str,
        estimator: object,
        dataset: MLFeatureDataset,
        split: DatasetSplit,
    ) -> tuple[VersionedPredictor, ModelBenchmark]:
        train_x = dataset.values[split.train_indices]
        train_y = dataset.labels[split.train_indices]
        estimator.fit(train_x, train_y)  # type: ignore[attr-defined]
        validation_scores = np.asarray(
            estimator.predict_proba(dataset.values[split.validation_indices])[:, 1],  # type: ignore[attr-defined]
            dtype=np.float64,
        )
        threshold = self._select_threshold(
            dataset.labels[split.validation_indices], validation_scores
        )
        predictor = VersionedPredictor(
            name=name,
            model_version=f"{name}:{MODEL_SCHEMA_VERSION}",
            feature_schema_version=dataset.feature_schema_version,
            feature_names=dataset.feature_names,
            threshold=threshold,
            estimator=estimator,
        )
        importance = tuple(
            (name, float(value))
            for name, value in sorted(
                zip(dataset.feature_names, estimator.feature_importances_, strict=True),  # type: ignore[attr-defined]
                key=lambda item: (-float(item[1]), item[0]),
            )[:10]
        )
        return predictor, self._benchmark(
            predictor,
            dataset,
            split,
            training_rows=len(split.train_indices),
            training_positive_rows=int(train_y.sum()),
            feature_importance=importance,
        )

    def _train_isolation_forest(
        self, dataset: MLFeatureDataset, split: DatasetSplit
    ) -> tuple[VersionedPredictor, ModelBenchmark]:
        train_indices = split.train_indices
        normal_indices = train_indices[dataset.labels[train_indices] == 0]
        estimator = make_pipeline(
            StandardScaler(),
            IsolationForest(
                n_estimators=240,
                contamination="auto",
                random_state=self.config.random_seed,
                n_jobs=-1,
            ),
        )
        normal_train_x = dataset.values[normal_indices]
        estimator.fit(normal_train_x)
        normal_scores = -estimator.decision_function(normal_train_x)
        score_low, score_high = np.quantile(normal_scores, (0.01, 0.99))
        predictor = VersionedPredictor(
            name="isolation_forest",
            model_version=f"isolation_forest:{MODEL_SCHEMA_VERSION}",
            feature_schema_version=dataset.feature_schema_version,
            feature_names=dataset.feature_names,
            threshold=0.5,
            estimator=estimator,
            anomaly_score_low=float(score_low),
            anomaly_score_high=float(max(score_high, score_low + 1e-9)),
        )
        validation_scores = predictor.predict_probabilities(
            dataset.values[split.validation_indices]
        )
        predictor.threshold = self._select_threshold(
            dataset.labels[split.validation_indices], validation_scores
        )
        return predictor, self._benchmark(
            predictor,
            dataset,
            split,
            training_rows=len(normal_indices),
            training_positive_rows=0,
            feature_importance=(),
        )

    def _benchmark(
        self,
        predictor: VersionedPredictor,
        dataset: MLFeatureDataset,
        split: DatasetSplit,
        *,
        training_rows: int,
        training_positive_rows: int,
        feature_importance: tuple[tuple[str, float], ...],
    ) -> ModelBenchmark:
        validation_scores = predictor.predict_probabilities(
            dataset.values[split.validation_indices]
        )
        test_scores = predictor.predict_probabilities(dataset.values[split.test_indices])
        return ModelBenchmark(
            name=predictor.name,
            model_version=predictor.model_version,
            training_rows=training_rows,
            training_positive_rows=training_positive_rows,
            validation=self._metrics(
                dataset.labels[split.validation_indices],
                validation_scores,
                predictor.threshold,
            ),
            test=self._metrics(
                dataset.labels[split.test_indices], test_scores, predictor.threshold
            ),
            feature_importance=feature_importance,
        )

    @staticmethod
    def _select_threshold(labels: NDArray[np.int64], scores: NDArray[np.float64]) -> float:
        candidates = np.unique(np.concatenate((scores, np.asarray([0.0, 0.5, 1.0]))))
        ranked: list[tuple[float, float, float, float]] = []
        for threshold in candidates:
            predictions = (scores >= threshold).astype(np.int64)
            precision, recall, f1, _ = precision_recall_fscore_support(
                labels, predictions, average="binary", zero_division=0
            )
            ranked.append((float(f1), float(precision), float(recall), float(threshold)))
        return max(ranked)[3]

    @staticmethod
    def _metrics(
        labels: NDArray[np.int64], scores: NDArray[np.float64], threshold: float
    ) -> ClassificationMetrics:
        predictions = (scores >= threshold).astype(np.int64)
        precision, recall, f1, _ = precision_recall_fscore_support(
            labels, predictions, average="binary", zero_division=0
        )
        true_negative, false_positive, false_negative, true_positive = confusion_matrix(
            labels, predictions, labels=[0, 1]
        ).ravel()
        return ClassificationMetrics(
            precision=round(float(precision), 6),
            recall=round(float(recall), 6),
            f1=round(float(f1), 6),
            pr_auc=round(float(average_precision_score(labels, scores)), 6),
            threshold=round(float(threshold), 8),
            true_positives=int(true_positive),
            false_positives=int(false_positive),
            true_negatives=int(true_negative),
            false_negatives=int(false_negative),
        )
