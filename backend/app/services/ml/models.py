"""Versioned ML predictors and evaluation records."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True, slots=True)
class ClassificationMetrics:
    precision: float
    recall: float
    f1: float
    pr_auc: float
    threshold: float
    true_positives: int
    false_positives: int
    true_negatives: int
    false_negatives: int


@dataclass(frozen=True, slots=True)
class ModelBenchmark:
    name: str
    model_version: str
    training_rows: int
    training_positive_rows: int
    validation: ClassificationMetrics
    test: ClassificationMetrics
    feature_importance: tuple[tuple[str, float], ...]


@dataclass(slots=True)
class VersionedPredictor:
    """Serializable adapter exposing risk probabilities for every candidate model."""

    name: str
    model_version: str
    feature_schema_version: str
    feature_names: tuple[str, ...]
    threshold: float
    estimator: Any
    anomaly_score_low: float | None = None
    anomaly_score_high: float | None = None

    def predict_probabilities(self, values: NDArray[np.float64]) -> NDArray[np.float64]:
        if values.ndim != 2 or values.shape[1] != len(self.feature_names):
            raise ValueError("prediction matrix does not match the model feature contract")
        if self.name == "isolation_forest":
            if self.anomaly_score_low is None or self.anomaly_score_high is None:
                raise ValueError("isolation forest calibration metadata is incomplete")
            raw_scores = -self.estimator.decision_function(values)
            width = max(1e-9, self.anomaly_score_high - self.anomaly_score_low)
            probabilities = (raw_scores - self.anomaly_score_low) / width
            return np.clip(probabilities, 0.0, 1.0).astype(np.float64)
        probabilities = self.estimator.predict_proba(values)[:, 1]
        return np.asarray(probabilities, dtype=np.float64)


@dataclass(frozen=True, slots=True)
class MLTrainingResult:
    selected_model: str
    selection_rule: str
    predictor: VersionedPredictor
    benchmarks: tuple[ModelBenchmark, ...]
    split_counts: dict[str, dict[str, int]]

    def summary_dict(self) -> dict[str, Any]:
        return {
            "selected_model": self.selected_model,
            "selected_model_version": self.predictor.model_version,
            "selection_rule": self.selection_rule,
            "feature_schema_version": self.predictor.feature_schema_version,
            "feature_count": len(self.predictor.feature_names),
            "split_counts": self.split_counts,
            "benchmarks": [asdict(item) for item in self.benchmarks],
        }
