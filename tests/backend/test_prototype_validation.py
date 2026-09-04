"""Regression tests for the offline prototype-validation benchmark."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from app.services.prototype_validation import PrototypeValidationEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator


class PrototypeValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=2026,
                normal_application_count=5_000,
                suspicious_ecosystem_count=100,
            )
        ).generate()
        cls.engine = PrototypeValidationEngine()
        cls.report = cls.engine.evaluate(cls.dataset)

    def test_standard_seed_metrics_are_measured_and_stable(self) -> None:
        baseline = self.report.baseline
        jaaldrishti = self.report.jaaldrishti

        self.assertEqual(baseline.true_positives, 137)
        self.assertEqual(baseline.false_positives, 913)
        self.assertEqual(baseline.suspicious_application_recall, 0.232993)
        self.assertEqual(baseline.false_positive_rate, 0.1826)
        self.assertEqual(baseline.step_up_rate, 0.187903)

        self.assertEqual(jaaldrishti.true_positives, 488)
        self.assertEqual(jaaldrishti.false_positives, 0)
        self.assertEqual(jaaldrishti.suspicious_application_recall, 0.829932)
        self.assertEqual(jaaldrishti.false_positive_rate, 0.0)
        self.assertEqual(jaaldrishti.step_up_rate, 0.08733)

    def test_network_policy_improves_recall_and_review_precision(self) -> None:
        baseline = self.report.baseline
        jaaldrishti = self.report.jaaldrishti

        self.assertGreater(
            jaaldrishti.suspicious_application_recall,
            baseline.suspicious_application_recall,
        )
        self.assertLess(jaaldrishti.false_positive_rate, baseline.false_positive_rate)
        self.assertLess(jaaldrishti.step_up_rate, baseline.step_up_rate)

    def test_staged_replay_detects_high_confidence_ecosystems_early(self) -> None:
        detection = self.report.ecosystem_detection

        self.assertEqual(detection.total_ecosystems, 100)
        self.assertEqual(detection.detected_ecosystems, 93)
        self.assertEqual(detection.ecosystem_recall, 0.93)
        self.assertEqual(detection.median_detection_application, 4.0)
        self.assertEqual(detection.mean_detection_application, 4.19)
        self.assertEqual(detection.detection_point_distribution, {"4": 75, "5": 18})

    def test_json_export_is_versioned_and_refuses_accidental_overwrite(self) -> None:
        with tempfile.TemporaryDirectory() as temporary_directory:
            target = Path(temporary_directory) / "prototype-validation.json"
            exported = self.engine.export_json(self.report, target)
            payload = json.loads(exported.read_text(encoding="utf-8"))

            self.assertEqual(payload["benchmark_version"], "1.0.0")
            self.assertEqual(payload["dataset_id"], "jaaldrishti-seed-2026")
            self.assertIn("not production", payload["evaluation_scope"])
            with self.assertRaises(FileExistsError):
                self.engine.export_json(self.report, target)


if __name__ == "__main__":
    unittest.main()
