"""Window and threshold configuration for temporal feature extraction."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class TemporalIntelligenceConfig:
    dealer_burst_window_hours: int = 2
    device_burst_window_hours: int = 2
    account_window_hours: int = 24
    customer_velocity_window_days: int = 30
    network_recent_window_hours: int = 24
    network_baseline_window_days: int = 30
    recency_half_life_hours: float = 24.0
    recency_horizon_hours: int = 720
    rapid_burst_min_unique_applicants: int = 5

    def __post_init__(self) -> None:
        positive_values = (
            self.dealer_burst_window_hours,
            self.device_burst_window_hours,
            self.account_window_hours,
            self.customer_velocity_window_days,
            self.network_recent_window_hours,
            self.network_baseline_window_days,
            self.recency_half_life_hours,
            self.recency_horizon_hours,
        )
        if any(value <= 0 for value in positive_values):
            raise ValueError("temporal windows and half-life must be positive")
        if self.rapid_burst_min_unique_applicants < 2:
            raise ValueError("rapid burst threshold must be at least 2 applicants")
        if self.network_baseline_window_days * 24 <= self.network_recent_window_hours:
            raise ValueError("network baseline window must exceed the recent window")
