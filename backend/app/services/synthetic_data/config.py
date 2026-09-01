"""Configuration for deterministic synthetic ecosystem generation."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True, slots=True)
class GenerationConfig:
    """Validated inputs controlling one generated dataset."""

    seed: int = 2026
    normal_application_count: int = 5_000
    suspicious_ecosystem_count: int = 100
    min_ecosystem_size: int = 4
    max_ecosystem_size: int = 8
    normal_dealer_count: int = 180
    suspicious_dealer_count: int = 20
    benign_shared_device_rate: float = 0.012
    benign_shared_account_rate: float = 0.008
    as_of: datetime = datetime(2026, 8, 31, 12, 0, tzinfo=UTC)

    def __post_init__(self) -> None:
        if self.normal_application_count < 1:
            raise ValueError("normal_application_count must be positive")
        if self.suspicious_ecosystem_count < 1:
            raise ValueError("suspicious_ecosystem_count must be positive")
        if self.min_ecosystem_size < 3:
            raise ValueError("min_ecosystem_size must be at least 3")
        if self.max_ecosystem_size < self.min_ecosystem_size:
            raise ValueError("max_ecosystem_size must not be smaller than the minimum")
        if self.normal_dealer_count < 10:
            raise ValueError("normal_dealer_count must be at least 10")
        if self.suspicious_dealer_count < 1:
            raise ValueError("suspicious_dealer_count must be positive")
        for name, rate in (
            ("benign_shared_device_rate", self.benign_shared_device_rate),
            ("benign_shared_account_rate", self.benign_shared_account_rate),
        ):
            if not 0 <= rate < 0.1:
                raise ValueError(f"{name} must be between 0 and 0.1")
        if self.as_of.tzinfo is None or self.as_of.utcoffset() is None:
            raise ValueError("as_of must be timezone-aware")
