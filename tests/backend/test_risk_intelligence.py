from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.entity_resolution import EntityResolutionEngine
from app.services.entity_resolution.models import SharedEntityEvidence
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.graph_intelligence.models import GraphFeatureVector
from app.services.risk_intelligence import (
    RiskAnalysisContext,
    RiskAssessmentBatch,
    RiskIntelligenceEngine,
    RiskPolicy,
)
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator
from app.services.temporal_intelligence import TemporalIntelligenceEngine
from app.services.temporal_intelligence.models import TemporalFeatureVector


class RiskIntelligenceEngineTests(unittest.TestCase):
    def test_shared_device_signal_contains_entity_evidence_and_enforces_high_floor(
        self,
    ) -> None:
        context = self._context(shared_device_applicants=5, connection_strength=0.6)

        result = RiskIntelligenceEngine().score_context(context)

        signal = next(
            item
            for item in result.signals
            if item.code == "SHARED_DEVICE_MANY_APPLICANTS"
        )
        self.assertEqual(signal.entity_ids, ("DEV-RING",))
        self.assertIn("6 applicants", signal.message)
        self.assertEqual(result.score_components.enforced_floor, 72.0)
        self.assertEqual(result.risk_level, "HIGH")
        self.assertEqual(result.recommended_action.code, "ENHANCED_VERIFICATION")

    def test_rapid_dealer_burst_produces_explanation_and_high_action(self) -> None:
        context = self._context(rapid_dealer_burst=True)

        result = RiskIntelligenceEngine().score_context(context)

        signal = next(
            item
            for item in result.signals
            if item.code == "RAPID_DEALER_APPLICATION_BURST"
        )
        self.assertEqual(signal.entity_ids, ("DLR-17",))
        self.assertEqual(signal.window, "2h")
        self.assertEqual(result.risk_score, 70.0)
        self.assertEqual(result.risk_level, "HIGH")

    def test_independent_plausible_customer_remains_low_risk(self) -> None:
        result = RiskIntelligenceEngine().score_context(self._context())

        self.assertEqual(result.signals, ())
        self.assertLess(result.risk_score, 40)
        self.assertEqual(result.risk_level, "LOW")
        self.assertEqual(result.recommended_action.code, "STANDARD_PROCESSING")
        self.assertFalse(result.recommended_action.human_review_required)

    def test_emerging_concentration_creates_medium_review_band(self) -> None:
        result = RiskIntelligenceEngine().score_context(
            self._context(emerging_concentration=True)
        )

        signal = next(
            item
            for item in result.signals
            if item.code == "EMERGING_APPLICATION_CONCENTRATION"
        )
        self.assertEqual(signal.score_floor, 40.0)
        self.assertEqual(result.risk_score, 40.0)
        self.assertEqual(result.risk_level, "MEDIUM")
        self.assertEqual(result.recommended_action.code, "MANUAL_REVIEW")

    def test_optional_ml_probability_uses_versioned_hybrid_weights(self) -> None:
        context = self._context()
        engine = RiskIntelligenceEngine()

        without_ml = engine.score_context(context)
        with_ml = engine.score_context(
            context,
            model_probability=0.9,
            model_version="rf-test-1",
        )

        self.assertIsNone(without_ml.score_components.ml_score)
        self.assertEqual(with_ml.score_components.ml_score, 90.0)
        self.assertEqual(with_ml.versions.model, "rf-test-1")
        self.assertGreater(with_ml.risk_score, without_ml.risk_score)
        self.assertEqual(with_ml.score_components.weights["ml"], 0.25)

    def test_rejects_unversioned_or_invalid_model_probability(self) -> None:
        engine = RiskIntelligenceEngine()
        context = self._context()

        with self.assertRaises(ValueError):
            engine.score_context(context, model_probability=0.8)
        with self.assertRaises(ValueError):
            engine.score_context(context, model_probability=1.1, model_version="bad")

    def test_risk_band_boundaries_are_non_overlapping(self) -> None:
        policy = RiskPolicy()

        self.assertEqual(policy.risk_level(39.99), "LOW")
        self.assertEqual(policy.risk_level(40.0), "MEDIUM")
        self.assertEqual(policy.risk_level(69.99), "MEDIUM")
        self.assertEqual(policy.risk_level(70.0), "HIGH")
        self.assertEqual(policy.risk_level(100.0), "HIGH")

    def test_batch_pipeline_scores_suspicious_population_higher(self) -> None:
        dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=44,
                normal_application_count=120,
                suspicious_ecosystem_count=8,
                normal_dealer_count=20,
                suspicious_dealer_count=4,
            )
        ).generate()
        relationships = EntityResolutionEngine().resolve(dataset)
        graph_result = GraphIntelligenceEngine().analyze(relationships)
        temporal_result = TemporalIntelligenceEngine().analyze(dataset, relationships)

        assessments = RiskIntelligenceEngine().analyze_all(
            dataset, relationships, graph_result, temporal_result
        )

        labels = {
            row["application_id"]: row["is_suspicious"]
            for row in dataset.tables["ground_truth"]
        }
        suspicious_scores = [
            item.risk_score for item in assessments if labels[item.application_id]
        ]
        normal_scores = [
            item.risk_score for item in assessments if not labels[item.application_id]
        ]
        self.assertEqual(len(assessments), len(dataset.tables["applications"]))
        self.assertGreater(
            sum(suspicious_scores) / len(suspicious_scores),
            sum(normal_scores) / len(normal_scores) + 40,
        )
        self.assertEqual(
            sum(
                item.risk_level == "HIGH"
                for item in assessments
                if not labels[item.application_id]
            ),
            0,
        )

    def test_unknown_application_is_reported(self) -> None:
        dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=9,
                normal_application_count=10,
                suspicious_ecosystem_count=2,
                normal_dealer_count=10,
                suspicious_dealer_count=2,
            )
        ).generate()
        relationships = EntityResolutionEngine().resolve(dataset)
        graph_result = GraphIntelligenceEngine().analyze(relationships)
        temporal_result = TemporalIntelligenceEngine().analyze(dataset, relationships)

        with self.assertRaises(KeyError):
            RiskIntelligenceEngine().analyze_application(
                "APP-MISSING",
                dataset,
                relationships,
                graph_result,
                temporal_result,
            )

    def test_batch_summary_and_artifacts_are_structured_and_protected(self) -> None:
        low = RiskIntelligenceEngine().score_context(
            self._context(), analysed_at="2026-09-01T00:00:00Z"
        )
        high = RiskIntelligenceEngine().score_context(
            self._context(shared_device_applicants=5, connection_strength=0.6),
            analysed_at="2026-09-01T00:00:00Z",
        )
        batch = RiskAssessmentBatch.from_assessments((low, high))

        self.assertEqual(
            batch.summary.risk_distribution, {"LOW": 1, "MEDIUM": 0, "HIGH": 1}
        )
        self.assertEqual(batch.summary.high_risk_applications, 1)
        self.assertEqual(batch.summary.review_required_applications, 1)
        with tempfile.TemporaryDirectory() as temporary_directory:
            artifacts = batch.export_artifacts(Path(temporary_directory))

            self.assertIn(
                "application_id,customer_id,risk_score", artifacts["csv"].read_text()
            )
            self.assertIn(
                "SHARED_DEVICE_MANY_APPLICANTS", artifacts["json"].read_text()
            )
            self.assertIn(
                '"assessment_schema_version": "1.0.0"', artifacts["summary"].read_text()
            )
            with self.assertRaises(FileExistsError):
                batch.export_artifacts(Path(temporary_directory))

    @staticmethod
    def _context(
        *,
        shared_device_applicants: int = 0,
        connection_strength: float = 0.0,
        rapid_dealer_burst: bool = False,
        emerging_concentration: bool = False,
    ) -> RiskAnalysisContext:
        graph = GraphFeatureVector(
            customer_id="CUS-1",
            degree_centrality=0.01,
            connected_applicant_count=5 if shared_device_applicants else 0,
            heterogeneous_degree=4,
            cluster_id="cluster-1",
            cluster_size=6 if shared_device_applicants else 1,
            network_density=0.3 if shared_device_applicants else 0.0,
            community_id="community-1",
            community_size=6 if shared_device_applicants else 1,
            shared_identity_signal_count=1 if shared_device_applicants else 0,
            shared_device_count=1 if shared_device_applicants else 0,
            shared_account_count=0,
            same_dealer_count=1 if rapid_dealer_burst else 0,
            same_location_count=0,
            shared_device_applicant_count_max=shared_device_applicants,
            shared_account_applicant_count_max=0,
            max_connection_strength=connection_strength,
            mean_connection_strength=connection_strength,
        )
        temporal = TemporalFeatureVector(
            application_id="APP-1",
            customer_id="CUS-1",
            as_of="2026-08-01T10:00:00Z",
            applications_same_device_2h=1,
            applications_same_dealer_2h=(
                5 if rapid_dealer_burst else 3 if emerging_concentration else 1
            ),
            applications_same_account_24h=1,
            customer_applications_30d=1,
            application_velocity_2h=(
                5 if rapid_dealer_burst else 3 if emerging_concentration else 1
            ),
            linked_applicants_24h=(
                4 if rapid_dealer_burst else 2 if emerging_concentration else 0
            ),
            network_prior_applicants_30d=0,
            network_growth_rate_24h=(
                4.0 if rapid_dealer_burst else 2.0 if emerging_concentration else 0.0
            ),
            hours_since_latest_link=(
                0.5 if rapid_dealer_burst or emerging_concentration else None
            ),
            recency_score=0.9857
            if rapid_dealer_burst or emerging_concentration
            else 0.0,
            rapid_burst_detected=rapid_dealer_burst,
            burst_signal_types=("dealer_2h",) if rapid_dealer_burst else (),
        )
        evidence = (
            {
                "shared_device": (
                    SharedEntityEvidence(
                        "DEV-RING",
                        "device",
                        "shared_device",
                        shared_device_applicants + 1,
                        0.45,
                    ),
                )
            }
            if shared_device_applicants
            else {}
        )
        return RiskAnalysisContext(
            application={
                "application_id": "APP-1",
                "customer_id": "CUS-1",
                "loan_amount_inr": 100_000,
                "loan_type": "two_wheeler",
                "dealer_id": "DLR-17",
            },
            customer={
                "customer_id": "CUS-1",
                "age": 34,
                "annual_income_inr": 600_000,
                "location_id": "LOC-1",
                "credit_score": 720,
            },
            graph_features=graph,
            temporal_features=temporal,
            shared_evidence=evidence,
        )


if __name__ == "__main__":
    unittest.main()
