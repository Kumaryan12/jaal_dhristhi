"""Typed results for the offline prototype validation benchmark."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class ScreeningMetrics:
    suspicious_applications: int
    normal_applications: int
    true_positives: int
    false_positives: int
    false_negatives: int
    true_negatives: int
    stepped_up_applications: int
    suspicious_application_recall: float
    false_positive_rate: float
    step_up_rate: float

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class EcosystemDetectionMetrics:
    total_ecosystems: int
    detected_ecosystems: int
    ecosystem_recall: float
    median_detection_application: float | None
    mean_detection_application: float | None
    detection_point_distribution: dict[str, int]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class PrototypeValidationReport:
    benchmark_version: str
    dataset_id: str
    seed: int
    evaluation_scope: str
    decision_threshold: str
    baseline_definition: str
    jaaldrishti_definition: str
    baseline: ScreeningMetrics
    jaaldrishti: ScreeningMetrics
    ecosystem_detection: EcosystemDetectionMetrics

    def to_dict(self) -> dict[str, Any]:
        return {
            "benchmark_version": self.benchmark_version,
            "dataset_id": self.dataset_id,
            "seed": self.seed,
            "evaluation_scope": self.evaluation_scope,
            "decision_threshold": self.decision_threshold,
            "baseline_definition": self.baseline_definition,
            "jaaldrishti_definition": self.jaaldrishti_definition,
            "baseline": self.baseline.to_dict(),
            "jaaldrishti": self.jaaldrishti.to_dict(),
            "ecosystem_detection": self.ecosystem_detection.to_dict(),
        }
