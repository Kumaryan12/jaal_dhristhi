"""Transparent configuration for entity projection and connection strength."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class ResolutionConfig:
    """Weights and safety limits used by the exact-match resolver."""

    shared_device_weight: float = 0.45
    shared_account_weight: float = 0.35
    same_dealer_weight: float = 0.15
    same_location_weight: float = 0.05
    max_projected_group_size: int = 80

    def __post_init__(self) -> None:
        weights = (
            self.shared_device_weight,
            self.shared_account_weight,
            self.same_dealer_weight,
            self.same_location_weight,
        )
        if any(weight < 0 or weight > 1 for weight in weights):
            raise ValueError("connection weights must be between 0 and 1")
        if not any(weights):
            raise ValueError("at least one connection weight must be positive")
        if self.max_projected_group_size < 2:
            raise ValueError("max_projected_group_size must be at least 2")

    def weight_for(self, relationship_type: str) -> float:
        weights = {
            "shared_device": self.shared_device_weight,
            "shared_account": self.shared_account_weight,
            "same_dealer": self.same_dealer_weight,
            "same_location": self.same_location_weight,
        }
        try:
            return weights[relationship_type]
        except KeyError as error:
            raise ValueError(f"unsupported relationship type: {relationship_type}") from error
