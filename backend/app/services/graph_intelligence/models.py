"""Typed graph intelligence feature and summary models."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class GraphFeatureVector:
    customer_id: str
    degree_centrality: float
    connected_applicant_count: int
    heterogeneous_degree: int
    cluster_id: str
    cluster_size: int
    network_density: float
    community_id: str
    community_size: int
    shared_identity_signal_count: int
    shared_device_count: int
    shared_account_count: int
    same_dealer_count: int
    same_location_count: int
    shared_device_applicant_count_max: int
    shared_account_applicant_count_max: int
    max_connection_strength: float
    mean_connection_strength: float


@dataclass(frozen=True, slots=True)
class GraphIntelligenceSummary:
    heterogeneous_node_count: int
    heterogeneous_edge_count: int
    customer_node_count: int
    customer_edge_count: int
    connected_component_count: int
    largest_component_size: int
    overall_customer_graph_density: float
    community_count: int
    largest_community_size: int
    average_connected_applicants: float


@dataclass(frozen=True, slots=True)
class GraphIntelligenceResult:
    summary: GraphIntelligenceSummary
    features: tuple[GraphFeatureVector, ...]

    def feature_for(self, customer_id: str) -> GraphFeatureVector:
        try:
            return next(feature for feature in self.features if feature.customer_id == customer_id)
        except StopIteration as error:
            raise KeyError(f"no graph features exist for customer: {customer_id}") from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": asdict(self.summary),
            "features": [asdict(feature) for feature in self.features],
        }
