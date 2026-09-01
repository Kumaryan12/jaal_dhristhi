"""Versioned thresholds, points, floors, and component weights."""

from __future__ import annotations

from dataclasses import dataclass

RISK_POLICY_VERSION = "1.0.0"


@dataclass(frozen=True, slots=True)
class RiskPolicy:
    low_upper_bound: float = 40.0
    medium_upper_bound: float = 70.0

    shared_device_applicant_threshold: int = 3
    shared_account_applicant_threshold: int = 3
    emerging_application_velocity_threshold: int = 3
    emerging_linked_applicant_threshold: int = 2
    application_velocity_threshold: int = 5
    linked_applicant_threshold: int = 3
    network_growth_rate_threshold: float = 2.0
    strong_connection_threshold: float = 0.5
    identity_signal_threshold: int = 2
    low_credit_score_threshold: int = 600
    loan_to_income_threshold: float = 0.75

    shared_device_points: float = 30.0
    shared_account_points: float = 28.0
    rapid_dealer_burst_points: float = 30.0
    rapid_device_burst_points: float = 35.0
    emerging_concentration_points: float = 20.0
    velocity_points: float = 15.0
    growth_points: float = 12.0
    strong_connection_points: float = 10.0
    multiple_identity_points: float = 10.0
    low_credit_points: float = 8.0
    high_loan_to_income_points: float = 6.0

    shared_device_floor: float = 72.0
    shared_account_floor: float = 70.0
    rapid_dealer_burst_floor: float = 70.0
    rapid_device_burst_floor: float = 75.0
    emerging_concentration_floor: float = 40.0

    rule_weight_without_ml: float = 0.50
    graph_weight_without_ml: float = 0.30
    temporal_weight_without_ml: float = 0.20

    rule_weight_with_ml: float = 0.40
    graph_weight_with_ml: float = 0.20
    temporal_weight_with_ml: float = 0.15
    ml_weight: float = 0.25

    def __post_init__(self) -> None:
        if not 0 < self.low_upper_bound < self.medium_upper_bound <= 100:
            raise ValueError("risk bands must be ordered within 0–100")
        without_ml = (
            self.rule_weight_without_ml
            + self.graph_weight_without_ml
            + self.temporal_weight_without_ml
        )
        with_ml = (
            self.rule_weight_with_ml
            + self.graph_weight_with_ml
            + self.temporal_weight_with_ml
            + self.ml_weight
        )
        if abs(without_ml - 1.0) > 1e-9 or abs(with_ml - 1.0) > 1e-9:
            raise ValueError("component weights must sum to 1.0")

    def risk_level(self, score: float) -> str:
        if score < self.low_upper_bound:
            return "LOW"
        if score < self.medium_upper_bound:
            return "MEDIUM"
        return "HIGH"

    def weights(self, *, ml_available: bool) -> dict[str, float]:
        if ml_available:
            return {
                "rule": self.rule_weight_with_ml,
                "graph": self.graph_weight_with_ml,
                "temporal": self.temporal_weight_with_ml,
                "ml": self.ml_weight,
            }
        return {
            "rule": self.rule_weight_without_ml,
            "graph": self.graph_weight_without_ml,
            "temporal": self.temporal_weight_without_ml,
        }
