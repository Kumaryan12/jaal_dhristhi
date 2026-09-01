"""Typed output models for temporal application features."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class TemporalFeatureVector:
    application_id: str
    customer_id: str
    as_of: str
    applications_same_device_2h: int
    applications_same_dealer_2h: int
    applications_same_account_24h: int
    customer_applications_30d: int
    application_velocity_2h: int
    linked_applicants_24h: int
    network_prior_applicants_30d: int
    network_growth_rate_24h: float
    hours_since_latest_link: float | None
    recency_score: float
    rapid_burst_detected: bool
    burst_signal_types: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class TemporalIntelligenceSummary:
    application_count: int
    rapid_burst_application_count: int
    rapid_burst_rate: float
    peak_application_velocity_2h: int
    peak_dealer_applications_2h: int
    peak_device_applications_2h: int
    peak_account_applications_24h: int
    average_network_growth_rate_24h: float
    average_recency_score: float


@dataclass(frozen=True, slots=True)
class TemporalIntelligenceResult:
    summary: TemporalIntelligenceSummary
    features: tuple[TemporalFeatureVector, ...]

    def feature_for(self, application_id: str) -> TemporalFeatureVector:
        try:
            return next(
                feature for feature in self.features if feature.application_id == application_id
            )
        except StopIteration as error:
            raise KeyError(
                f"no temporal features exist for application: {application_id}"
            ) from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": asdict(self.summary),
            "features": [asdict(feature) for feature in self.features],
        }
