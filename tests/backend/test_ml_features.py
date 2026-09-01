from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.entity_resolution import EntityResolutionEngine
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.ml import EcosystemGroupedSplitter, MLFeatureMatrixBuilder
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator
from app.services.temporal_intelligence import TemporalIntelligenceEngine


class MLFeatureFoundationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=61,
                normal_application_count=120,
                suspicious_ecosystem_count=12,
                normal_dealer_count=20,
                suspicious_dealer_count=4,
            )
        ).generate()
        relationships = EntityResolutionEngine().resolve(cls.dataset)
        cls.graph_result = GraphIntelligenceEngine().analyze(relationships)
        cls.temporal_result = TemporalIntelligenceEngine().analyze(
            cls.dataset, relationships
        )

    def test_feature_matrix_has_one_finite_row_per_application(self) -> None:
        features = MLFeatureMatrixBuilder().build(
            self.dataset, self.graph_result, self.temporal_result
        )

        self.assertEqual(
            features.values.shape[0], len(self.dataset.tables["applications"])
        )
        self.assertEqual(features.values.shape[1], len(features.feature_names))
        self.assertTrue(np.isfinite(features.values).all())
        self.assertEqual(set(features.labels.tolist()), {0, 1})

    def test_evaluation_provenance_never_enters_feature_names_or_values(self) -> None:
        features = MLFeatureMatrixBuilder().build(
            self.dataset, self.graph_result, self.temporal_result
        )
        feature_names = " ".join(features.feature_names).lower()

        self.assertNotIn("scenario", feature_names)
        self.assertNotIn("pattern", feature_names)
        self.assertNotIn("suspicious", feature_names)
        self.assertNotIn("default_status", feature_names)
        self.assertEqual(features.feature_schema_version, "1.0.0")

    def test_feature_build_is_deterministic(self) -> None:
        builder = MLFeatureMatrixBuilder()

        first = builder.build(self.dataset, self.graph_result, self.temporal_result)
        second = builder.build(self.dataset, self.graph_result, self.temporal_result)

        self.assertEqual(first.feature_names, second.feature_names)
        self.assertEqual(first.application_ids, second.application_ids)
        self.assertTrue(np.array_equal(first.values, second.values))
        self.assertTrue(np.array_equal(first.labels, second.labels))

    def test_grouped_split_has_no_ecosystem_or_row_overlap(self) -> None:
        features = MLFeatureMatrixBuilder().build(
            self.dataset, self.graph_result, self.temporal_result
        )

        split = EcosystemGroupedSplitter().split(features)

        index_sets = [
            set(split.train_indices.tolist()),
            set(split.validation_indices.tolist()),
            set(split.test_indices.tolist()),
        ]
        self.assertFalse(index_sets[0] & index_sets[1])
        self.assertFalse(index_sets[0] & index_sets[2])
        self.assertFalse(index_sets[1] & index_sets[2])
        self.assertEqual(
            set().union(*index_sets), set(range(len(features.application_ids)))
        )
        group_sets = [
            {features.groups[index] for index in indices}
            for indices in (
                split.train_indices,
                split.validation_indices,
                split.test_indices,
            )
        ]
        self.assertFalse(group_sets[0] & group_sets[1])
        self.assertFalse(group_sets[0] & group_sets[2])
        self.assertFalse(group_sets[1] & group_sets[2])

    def test_each_split_contains_both_classes_and_is_deterministic(self) -> None:
        features = MLFeatureMatrixBuilder().build(
            self.dataset, self.graph_result, self.temporal_result
        )
        splitter = EcosystemGroupedSplitter()

        first = splitter.split(features)
        second = splitter.split(features)

        self.assertTrue(np.array_equal(first.train_indices, second.train_indices))
        self.assertTrue(
            np.array_equal(first.validation_indices, second.validation_indices)
        )
        self.assertTrue(np.array_equal(first.test_indices, second.test_indices))
        for counts in first.counts(features.labels).values():
            self.assertGreater(counts["normal"], 0)
            self.assertGreater(counts["suspicious"], 0)


if __name__ == "__main__":
    unittest.main()
