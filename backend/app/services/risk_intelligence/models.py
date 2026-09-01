"""Structured risk evidence, score, and action models."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import tempfile
from collections import Counter
from dataclasses import asdict, dataclass
from pathlib import Path
from statistics import fmean
from typing import Any

RISK_ASSESSMENT_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True, slots=True)
class RiskSignal:
    code: str
    category: str
    severity: str
    message: str
    observed_value: float | int | bool
    threshold: float | int | bool
    points: float
    score_floor: float
    entity_ids: tuple[str, ...] = ()
    window: str | None = None


@dataclass(frozen=True, slots=True)
class ScoreComponents:
    rule_score: float
    graph_score: float
    temporal_score: float
    ml_score: float | None
    weights: dict[str, float]
    weighted_score: float
    enforced_floor: float
    final_score: float


@dataclass(frozen=True, slots=True)
class RecommendedAction:
    code: str
    label: str
    rationale: str
    human_review_required: bool


@dataclass(frozen=True, slots=True)
class BorrowerSnapshot:
    age: int
    annual_income_inr: int
    credit_score: int
    location_id: str
    loan_amount_inr: int
    loan_type: str
    dealer_id: str


@dataclass(frozen=True, slots=True)
class RiskAssessmentVersions:
    risk_policy: str
    graph_feature_schema: str
    temporal_feature_schema: str
    model: str | None


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    application_id: str
    customer_id: str
    risk_score: float
    risk_level: str
    signals: tuple[RiskSignal, ...]
    recommended_action: RecommendedAction
    score_components: ScoreComponents
    borrower: BorrowerSnapshot
    versions: RiskAssessmentVersions
    analysed_at: str

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class RiskIntelligenceSummary:
    total_applications: int
    risk_distribution: dict[str, int]
    average_risk_score: float
    high_risk_applications: int
    review_required_applications: int
    potential_exposure_inr: int
    top_signal_counts: dict[str, int]


@dataclass(frozen=True, slots=True)
class RiskAssessmentBatch:
    assessments: tuple[RiskAssessment, ...]
    summary: RiskIntelligenceSummary

    @classmethod
    def from_assessments(cls, assessments: tuple[RiskAssessment, ...]) -> RiskAssessmentBatch:
        distribution = Counter(item.risk_level for item in assessments)
        signal_counts = Counter(
            signal.code for assessment in assessments for signal in assessment.signals
        )
        return cls(
            assessments=assessments,
            summary=RiskIntelligenceSummary(
                total_applications=len(assessments),
                risk_distribution={
                    level: distribution.get(level, 0) for level in ("LOW", "MEDIUM", "HIGH")
                },
                average_risk_score=(
                    round(fmean(item.risk_score for item in assessments), 4) if assessments else 0.0
                ),
                high_risk_applications=distribution.get("HIGH", 0),
                review_required_applications=sum(
                    item.recommended_action.human_review_required for item in assessments
                ),
                potential_exposure_inr=sum(
                    item.borrower.loan_amount_inr
                    for item in assessments
                    if item.risk_level in {"MEDIUM", "HIGH"}
                ),
                top_signal_counts=dict(signal_counts.most_common(10)),
            ),
        )

    def export_artifacts(
        self, output_dir: Path, *, replace_existing: bool = False
    ) -> dict[str, Path]:
        """Export summary CSV, complete explanations JSON, and checksum manifest."""

        if not self.assessments:
            raise ValueError("cannot export an empty risk assessment batch")
        output_dir = output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        csv_path = output_dir / "risk-assessments.csv"
        json_path = output_dir / "risk-assessments.json"
        summary_path = output_dir / "risk-intelligence-summary.json"
        existing = [path for path in (csv_path, json_path, summary_path) if path.exists()]
        if existing and not replace_existing:
            names = ", ".join(path.name for path in existing)
            raise FileExistsError(f"risk intelligence artifacts already exist ({names})")

        rows = [self._csv_row(item) for item in self.assessments]
        self._write_csv_atomic(csv_path, rows)
        self._write_json_atomic(
            json_path,
            {
                "assessment_schema_version": RISK_ASSESSMENT_SCHEMA_VERSION,
                "assessments": [item.to_dict() for item in self.assessments],
            },
        )
        self._write_json_atomic(
            summary_path,
            {
                "assessment_schema_version": RISK_ASSESSMENT_SCHEMA_VERSION,
                "assessment_count": len(self.assessments),
                "csv_sha256": self._sha256(csv_path),
                "json_sha256": self._sha256(json_path),
                "summary": asdict(self.summary),
            },
        )
        return {"csv": csv_path, "json": json_path, "summary": summary_path}

    @staticmethod
    def _csv_row(assessment: RiskAssessment) -> dict[str, Any]:
        components = assessment.score_components
        return {
            "application_id": assessment.application_id,
            "customer_id": assessment.customer_id,
            "risk_score": assessment.risk_score,
            "risk_level": assessment.risk_level,
            "recommended_action": assessment.recommended_action.code,
            "signal_codes": "|".join(signal.code for signal in assessment.signals),
            "rule_score": components.rule_score,
            "graph_score": components.graph_score,
            "temporal_score": components.temporal_score,
            "ml_score": "" if components.ml_score is None else components.ml_score,
            "enforced_floor": components.enforced_floor,
            "analysed_at": assessment.analysed_at,
        }

    @staticmethod
    def _write_csv_atomic(target: Path, rows: list[dict[str, Any]]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="", dir=target.parent, delete=False
        ) as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), extrasaction="raise")
            writer.writeheader()
            writer.writerows(rows)
            temporary_name = handle.name
        os.replace(temporary_name, target)

    @staticmethod
    def _write_json_atomic(target: Path, payload: dict[str, Any]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=target.parent, delete=False
        ) as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_name = handle.name
        os.replace(temporary_name, target)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(64 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
