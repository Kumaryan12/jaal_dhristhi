"""Tests for imbalanced Phase 6 model training and selection."""

from __future__ import annotations

import unittest

import numpy as np
from app.services.entity_resolution import EntityResolutionEngine
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.ml import (
    EcosystemGroupedSplitter,
    MLFeatureMatrixBuilder,
    MLModelTrainer,
)
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator
from app.services.temporal_intelligence import TemporalIntelligenceEngine


class MLModelTrainingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        source = SyntheticDataGenerator(
            GenerationConfig(
                seed=2026, normal_application_count=240, suspicious_ecosystem_count=18
            )
        ).generate()
        relationships = EntityResolutionEngine().resolve(source)
        graph_result = GraphIntelligenceEngine().analyze(relationships)
        temporal_result = TemporalIntelligenceEngine().analyze(source, relationships)
        cls.dataset = MLFeatureMatrixBuilder().build(
            source, graph_result, temporal_result
        )
        cls.split = EcosystemGroupedSplitter().split(cls.dataset)
        cls.result = MLModelTrainer().train(cls.dataset, cls.split)

    def test_trains_and_evaluates_all_three_candidates(self) -> None:
        self.assertEqual(
            {benchmark.name for benchmark in self.result.benchmarks},
            {"random_forest", "xgboost", "isolation_forest"},
        )
        for benchmark in self.result.benchmarks:
            for metrics in (benchmark.validation, benchmark.test):
                self.assertGreaterEqual(metrics.precision, 0)
                self.assertLessEqual(metrics.precision, 1)
                self.assertGreaterEqual(metrics.recall, 0)
                self.assertLessEqual(metrics.recall, 1)
                self.assertGreaterEqual(metrics.pr_auc, 0)
                self.assertLessEqual(metrics.pr_auc, 1)

    def test_isolation_forest_is_fit_only_on_normal_rows(self) -> None:
        benchmark = next(
            item for item in self.result.benchmarks if item.name == "isolation_forest"
        )
        self.assertEqual(benchmark.training_positive_rows, 0)
        self.assertEqual(
            benchmark.training_rows,
            self.result.split_counts["train"]["normal"],
        )

    def test_selected_predictor_emits_finite_probabilities(self) -> None:
        probabilities = self.result.predictor.predict_probabilities(self.dataset.values)
        self.assertEqual(probabilities.shape, self.dataset.labels.shape)
        self.assertTrue(np.isfinite(probabilities).all())
        self.assertTrue(((probabilities >= 0) & (probabilities <= 1)).all())

    def test_selection_uses_validation_metrics(self) -> None:
        expected = max(
            self.result.benchmarks,
            key=lambda item: (item.validation.pr_auc, item.validation.f1, item.name),
        )
        self.assertEqual(self.result.selected_model, expected.name)
        self.assertIn("validation PR-AUC", self.result.selection_rule)

    def test_training_is_reproducible(self) -> None:
        repeated = MLModelTrainer().train(self.dataset, self.split)
        self.assertEqual(self.result.summary_dict(), repeated.summary_dict())
        np.testing.assert_allclose(
            self.result.predictor.predict_probabilities(self.dataset.values),
            repeated.predictor.predict_probabilities(self.dataset.values),
        )


if __name__ == "__main__":
    unittest.main()
