"""Tests for model persistence and Phase 5 hybrid integration."""

from __future__ import annotations

import json
import tempfile
import unittest
from dataclasses import asdict
from pathlib import Path

import numpy as np
from app.services.entity_resolution import EntityResolutionEngine
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.ml import (
    EcosystemGroupedSplitter,
    MLArtifactStore,
    MLFeatureMatrixBuilder,
    MLModelTrainer,
)
from app.services.risk_intelligence import RiskAssessmentBatch, RiskIntelligenceEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator
from app.services.temporal_intelligence import TemporalIntelligenceEngine


class MLArtifactTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.source = SyntheticDataGenerator(
            GenerationConfig(
                seed=17, normal_application_count=120, suspicious_ecosystem_count=12
            )
        ).generate()
        cls.relationships = EntityResolutionEngine().resolve(cls.source)
        cls.graph_result = GraphIntelligenceEngine().analyze(cls.relationships)
        cls.temporal_result = TemporalIntelligenceEngine().analyze(
            cls.source, cls.relationships
        )
        cls.features = MLFeatureMatrixBuilder().build(
            cls.source, cls.graph_result, cls.temporal_result
        )
        cls.training = MLModelTrainer().train(
            cls.features, EcosystemGroupedSplitter().split(cls.features)
        )

    def test_model_round_trip_and_metadata_checksum(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            paths = MLArtifactStore().save(
                self.training,
                Path(directory),
                dataset_id=self.source.dataset_id,
                dataset_rows=len(self.features.application_ids),
                hybrid_risk_summary={
                    "total_applications": len(self.features.application_ids)
                },
            )
            loaded = MLArtifactStore.load(paths["model"])
            np.testing.assert_allclose(
                self.training.predictor.predict_probabilities(self.features.values),
                loaded.predict_probabilities(self.features.values),
            )
            metadata = json.loads(paths["summary"].read_text(encoding="utf-8"))
            self.assertEqual(metadata["selected_model_version"], loaded.model_version)
            self.assertEqual(len(metadata["model_sha256"]), 64)
            with self.assertRaises(FileExistsError):
                MLArtifactStore().save(
                    self.training,
                    Path(directory),
                    dataset_id=self.source.dataset_id,
                    dataset_rows=len(self.features.application_ids),
                    hybrid_risk_summary={},
                )

    def test_selected_probabilities_reach_every_hybrid_assessment(self) -> None:
        probabilities = self.training.predictor.predict_probabilities(
            self.features.values
        )
        mapping = dict(
            zip(self.features.application_ids, map(float, probabilities), strict=True)
        )
        assessments = RiskIntelligenceEngine().analyze_all(
            self.source,
            self.relationships,
            self.graph_result,
            self.temporal_result,
            model_probabilities=mapping,
            model_version=self.training.predictor.model_version,
        )
        batch = RiskAssessmentBatch.from_assessments(assessments)
        self.assertEqual(
            batch.summary.total_applications, len(self.features.application_ids)
        )
        self.assertTrue(
            all(item.score_components.ml_score is not None for item in assessments)
        )
        self.assertTrue(
            all(
                item.versions.model == self.training.predictor.model_version
                for item in assessments
            )
        )
        self.assertGreater(asdict(batch.summary)["review_required_applications"], 0)


if __name__ == "__main__":
    unittest.main()
