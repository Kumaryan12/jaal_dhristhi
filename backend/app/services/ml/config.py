"""Versioned model training and data-split configuration."""

from __future__ import annotations

from dataclasses import dataclass

ML_FEATURE_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True, slots=True)
class MLTrainingConfig:
    random_seed: int = 2026
    train_ratio: float = 0.60
    validation_ratio: float = 0.20
    test_ratio: float = 0.20
    missing_recency_hours: float = 720.0

    def __post_init__(self) -> None:
        ratios = (self.train_ratio, self.validation_ratio, self.test_ratio)
        if any(ratio <= 0 or ratio >= 1 for ratio in ratios):
            raise ValueError("train, validation, and test ratios must be within (0, 1)")
        if abs(sum(ratios) - 1.0) > 1e-9:
            raise ValueError("train, validation, and test ratios must sum to 1.0")
        if self.missing_recency_hours <= 0:
            raise ValueError("missing_recency_hours must be positive")
