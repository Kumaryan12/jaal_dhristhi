"""Configuration for deterministic graph feature extraction."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class GraphIntelligenceConfig:
    """Controls projection filtering and Louvain community detection."""

    minimum_connection_strength: float = 0.0
    community_resolution: float = 1.0
    community_seed: int = 2026

    def __post_init__(self) -> None:
        if not 0 <= self.minimum_connection_strength <= 1:
            raise ValueError("minimum_connection_strength must be between 0 and 1")
        if self.community_resolution <= 0:
            raise ValueError("community_resolution must be positive")
