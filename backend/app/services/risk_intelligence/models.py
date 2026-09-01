"""Structured risk evidence, score, and action models."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


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
