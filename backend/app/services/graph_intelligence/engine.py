"""Build NetworkX graphs and extract explainable graph-risk features."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from statistics import fmean

import networkx as nx

from app.services.entity_resolution.models import RelationshipGraph

from .config import GraphIntelligenceConfig
from .models import GraphFeatureVector, GraphIntelligenceResult, GraphIntelligenceSummary

STRONG_IDENTITY_TYPES = {"shared_device", "shared_account"}


@dataclass(slots=True)
class GraphStructures:
    """NetworkX representations used for feature extraction and future traversal."""

    heterogeneous_graph: nx.Graph
    customer_graph: nx.Graph


class GraphIntelligenceEngine:
    """Calculate graph features from the Phase 2 relationship graph."""

    def __init__(self, config: GraphIntelligenceConfig | None = None) -> None:
        self.config = config or GraphIntelligenceConfig()

    def build_graphs(self, relationship_graph: RelationshipGraph) -> GraphStructures:
        heterogeneous = nx.Graph()
        for node in relationship_graph.nodes:
            heterogeneous.add_node(
                node.entity_id,
                entity_type=node.entity_type,
                label=node.label,
                **node.attributes,
            )
        for edge in relationship_graph.direct_edges:
            heterogeneous.add_edge(
                edge.customer_id,
                edge.entity_id,
                edge_id=edge.edge_id,
                relationship_type=edge.relationship_type,
                entity_type=edge.entity_type,
                first_seen_at=edge.first_seen_at,
                last_seen_at=edge.last_seen_at,
                event_count=edge.event_count,
                evidence_ids=edge.evidence_ids,
                **edge.attributes,
            )

        customer_graph = nx.Graph()
        customer_ids = sorted(
            node.entity_id for node in relationship_graph.nodes if node.entity_type == "customer"
        )
        customer_graph.add_nodes_from(customer_ids)
        for connection in relationship_graph.customer_connections:
            if connection.connection_strength < self.config.minimum_connection_strength:
                continue
            customer_graph.add_edge(
                connection.source_customer_id,
                connection.target_customer_id,
                weight=connection.connection_strength,
                connection_strength=connection.connection_strength,
                shared_entity_count=connection.shared_entity_count,
                evidence=connection.evidence,
                relationship_types=tuple(
                    sorted({item.relationship_type for item in connection.evidence})
                ),
            )
        return GraphStructures(
            heterogeneous_graph=heterogeneous,
            customer_graph=customer_graph,
        )

    def analyze(self, relationship_graph: RelationshipGraph) -> GraphIntelligenceResult:
        graphs = self.build_graphs(relationship_graph)
        customer_graph = graphs.customer_graph
        customer_count = customer_graph.number_of_nodes()
        degree_centrality = {
            customer_id: (
                customer_graph.degree(customer_id) / (customer_count - 1)
                if customer_count > 1
                else 0.0
            )
            for customer_id in customer_graph.nodes
        }
        component_attributes = self._component_attributes(customer_graph)
        community_attributes, community_sizes = self._community_attributes(customer_graph)

        features = tuple(
            self._feature_for_customer(
                customer_id,
                graphs,
                degree_centrality[customer_id],
                component_attributes[customer_id],
                community_attributes[customer_id],
            )
            for customer_id in sorted(customer_graph.nodes)
        )
        summary = GraphIntelligenceSummary(
            heterogeneous_node_count=graphs.heterogeneous_graph.number_of_nodes(),
            heterogeneous_edge_count=graphs.heterogeneous_graph.number_of_edges(),
            customer_node_count=customer_count,
            customer_edge_count=customer_graph.number_of_edges(),
            connected_component_count=(
                nx.number_connected_components(customer_graph) if customer_count else 0
            ),
            largest_component_size=max(
                (attributes[1] for attributes in component_attributes.values()), default=0
            ),
            overall_customer_graph_density=round(nx.density(customer_graph), 8),
            community_count=len(community_sizes),
            largest_community_size=max(community_sizes.values(), default=0),
            average_connected_applicants=round(
                fmean(feature.connected_applicant_count for feature in features),
                4 if features else 0.0,
            ),
        )
        return GraphIntelligenceResult(summary=summary, features=features)

    @staticmethod
    def _component_attributes(graph: nx.Graph) -> dict[str, tuple[str, int, float]]:
        attributes: dict[str, tuple[str, int, float]] = {}
        components = sorted(
            (sorted(component) for component in nx.connected_components(graph)),
            key=lambda members: members[0],
        )
        for index, members in enumerate(components, start=1):
            size = len(members)
            edge_count = graph.subgraph(members).number_of_edges()
            density = 0.0 if size < 2 else (2 * edge_count) / (size * (size - 1))
            component_id = f"cluster-{index:05d}"
            for customer_id in members:
                attributes[customer_id] = (component_id, size, round(density, 8))
        return attributes

    def _community_attributes(
        self, graph: nx.Graph
    ) -> tuple[dict[str, tuple[str, int]], dict[str, int]]:
        if graph.number_of_nodes() == 0:
            return {}, {}
        raw_communities = nx.community.louvain_communities(
            graph,
            weight="weight",
            resolution=self.config.community_resolution,
            seed=self.config.community_seed,
        )
        communities = sorted(
            (sorted(community) for community in raw_communities), key=lambda x: x[0]
        )
        attributes: dict[str, tuple[str, int]] = {}
        sizes: dict[str, int] = {}
        for index, members in enumerate(communities, start=1):
            community_id = f"community-{index:05d}"
            sizes[community_id] = len(members)
            for customer_id in members:
                attributes[customer_id] = (community_id, len(members))
        return attributes, sizes

    @staticmethod
    def _feature_for_customer(
        customer_id: str,
        graphs: GraphStructures,
        degree_centrality: float,
        component_attributes: tuple[str, int, float],
        community_attributes: tuple[str, int],
    ) -> GraphFeatureVector:
        customer_graph = graphs.customer_graph
        evidence_entities: dict[str, set[str]] = defaultdict(set)
        maximum_linked_customers: dict[str, int] = defaultdict(int)
        connection_strengths: list[float] = []

        for _, _, edge_attributes in customer_graph.edges(customer_id, data=True):
            connection_strengths.append(float(edge_attributes["connection_strength"]))
            for evidence in edge_attributes["evidence"]:
                evidence_entities[evidence.relationship_type].add(evidence.entity_id)
                maximum_linked_customers[evidence.relationship_type] = max(
                    maximum_linked_customers[evidence.relationship_type],
                    evidence.linked_customer_count - 1,
                )

        identity_entities = set().union(
            *(evidence_entities[relationship_type] for relationship_type in STRONG_IDENTITY_TYPES)
        )
        cluster_id, cluster_size, component_density = component_attributes
        community_id, community_size = community_attributes
        return GraphFeatureVector(
            customer_id=customer_id,
            degree_centrality=round(degree_centrality, 8),
            connected_applicant_count=customer_graph.degree(customer_id),
            heterogeneous_degree=graphs.heterogeneous_graph.degree(customer_id),
            cluster_id=cluster_id,
            cluster_size=cluster_size,
            network_density=component_density,
            community_id=community_id,
            community_size=community_size,
            shared_identity_signal_count=len(identity_entities),
            shared_device_count=len(evidence_entities["shared_device"]),
            shared_account_count=len(evidence_entities["shared_account"]),
            same_dealer_count=len(evidence_entities["same_dealer"]),
            same_location_count=len(evidence_entities["same_location"]),
            shared_device_applicant_count_max=maximum_linked_customers["shared_device"],
            shared_account_applicant_count_max=maximum_linked_customers["shared_account"],
            max_connection_strength=round(max(connection_strengths, default=0.0), 4),
            mean_connection_strength=round(
                fmean(connection_strengths) if connection_strengths else 0.0, 4
            ),
        )
