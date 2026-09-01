"""Exact entity resolution for the synthetic lending ecosystem."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from itertools import combinations
from typing import Any

from app.services.synthetic_data.dataset import SyntheticDataset

from .config import ResolutionConfig
from .models import (
    CustomerConnection,
    CustomerResolutionMetrics,
    DirectRelationshipEdge,
    EntityNode,
    ProjectionSuppression,
    RelationshipGraph,
    SharedEntityEvidence,
)

DIRECT_TO_SHARED = {
    "uses_device": "shared_device",
    "linked_account": "shared_account",
    "applied_via": "same_dealer",
    "located_in": "same_location",
}

ENTITY_TYPE_ORDER = {
    "customer": 0,
    "device": 1,
    "account": 2,
    "dealer": 3,
    "location": 4,
}


@dataclass(slots=True)
class _EdgeAccumulator:
    customer_id: str
    entity_id: str
    entity_type: str
    relationship_type: str
    first_seen_at: str
    last_seen_at: str
    event_count: int = 0
    evidence_ids: set[str] = field(default_factory=set)
    attributes: dict[str, Any] = field(default_factory=dict)


class EntityResolutionEngine:
    """Create direct entity links and resolve shared-entity customer connections."""

    def __init__(self, config: ResolutionConfig | None = None) -> None:
        self.config = config or ResolutionConfig()

    def resolve(self, dataset: SyntheticDataset) -> RelationshipGraph:
        self._validate_input_tables(dataset.tables)
        nodes = self._build_nodes(dataset.tables)
        direct_edges = self._build_direct_edges(dataset.tables)
        connections, suppressions = self._build_customer_connections(direct_edges)
        metrics = self._build_customer_metrics(dataset.tables["customers"], connections)
        return RelationshipGraph(
            nodes=nodes,
            direct_edges=direct_edges,
            customer_connections=connections,
            customer_metrics=metrics,
            suppressed_projections=suppressions,
        )

    @staticmethod
    def _validate_input_tables(tables: dict[str, list[dict[str, Any]]]) -> None:
        required = {
            "customers",
            "devices",
            "customer_devices",
            "bank_accounts",
            "customer_accounts",
            "dealers",
            "locations",
            "applications",
        }
        missing = required - tables.keys()
        if missing:
            raise ValueError(f"entity resolution is missing tables: {sorted(missing)}")

    def _build_nodes(self, tables: dict[str, list[dict[str, Any]]]) -> tuple[EntityNode, ...]:
        nodes: list[EntityNode] = []
        specifications = (
            (
                "customers",
                "customer_id",
                "customer",
                "Customer",
                {"age", "annual_income_inr", "location_id", "credit_score", "created_at"},
            ),
            (
                "devices",
                "device_id",
                "device",
                "Device",
                {"device_type", "first_seen_at"},
            ),
            (
                "bank_accounts",
                "account_id",
                "account",
                "Account",
                {"bank_code", "opened_at"},
            ),
            (
                "dealers",
                "dealer_id",
                "dealer",
                "Dealer",
                {"location_id", "dealer_type"},
            ),
            (
                "locations",
                "location_id",
                "location",
                "Location",
                {"city", "state", "postal_zone"},
            ),
        )
        for table_name, id_column, entity_type, label_prefix, allowed_attributes in specifications:
            for row in tables[table_name]:
                entity_id = str(row[id_column])
                attributes = {key: value for key, value in row.items() if key in allowed_attributes}
                nodes.append(
                    EntityNode(
                        entity_id=entity_id,
                        entity_type=entity_type,
                        label=f"{label_prefix} {self._display_suffix(entity_id)}",
                        attributes=attributes,
                    )
                )
        return tuple(
            sorted(nodes, key=lambda node: (ENTITY_TYPE_ORDER[node.entity_type], node.entity_id))
        )

    def _build_direct_edges(
        self, tables: dict[str, list[dict[str, Any]]]
    ) -> tuple[DirectRelationshipEdge, ...]:
        accumulators: dict[tuple[str, str, str], _EdgeAccumulator] = {}

        for row in tables["customer_devices"]:
            self._accumulate_edge(
                accumulators,
                customer_id=str(row["customer_id"]),
                entity_id=str(row["device_id"]),
                entity_type="device",
                relationship_type="uses_device",
                first_seen_at=str(row["first_seen_at"]),
                last_seen_at=str(row["last_seen_at"]),
            )

        for row in tables["customer_accounts"]:
            self._accumulate_edge(
                accumulators,
                customer_id=str(row["customer_id"]),
                entity_id=str(row["account_id"]),
                entity_type="account",
                relationship_type="linked_account",
                first_seen_at=str(row["first_seen_at"]),
                last_seen_at=str(row["first_seen_at"]),
                attributes={"account_relationship_type": row["relationship_type"]},
            )

        for row in tables["applications"]:
            submitted_at = str(row["submitted_at"])
            self._accumulate_edge(
                accumulators,
                customer_id=str(row["customer_id"]),
                entity_id=str(row["dealer_id"]),
                entity_type="dealer",
                relationship_type="applied_via",
                first_seen_at=submitted_at,
                last_seen_at=submitted_at,
                evidence_id=str(row["application_id"]),
            )

        for row in tables["customers"]:
            created_at = str(row.get("created_at", ""))
            self._accumulate_edge(
                accumulators,
                customer_id=str(row["customer_id"]),
                entity_id=str(row["location_id"]),
                entity_type="location",
                relationship_type="located_in",
                first_seen_at=created_at,
                last_seen_at=created_at,
            )

        edges = [
            DirectRelationshipEdge(
                edge_id=(f"REL::{value.customer_id}::{value.relationship_type}::{value.entity_id}"),
                customer_id=value.customer_id,
                entity_id=value.entity_id,
                entity_type=value.entity_type,
                relationship_type=value.relationship_type,
                first_seen_at=value.first_seen_at,
                last_seen_at=value.last_seen_at,
                event_count=value.event_count,
                evidence_ids=tuple(sorted(value.evidence_ids)),
                attributes=value.attributes,
            )
            for value in accumulators.values()
        ]
        return tuple(
            sorted(
                edges,
                key=lambda edge: (
                    edge.customer_id,
                    ENTITY_TYPE_ORDER[edge.entity_type],
                    edge.entity_id,
                ),
            )
        )

    @staticmethod
    def _accumulate_edge(
        accumulators: dict[tuple[str, str, str], _EdgeAccumulator],
        *,
        customer_id: str,
        entity_id: str,
        entity_type: str,
        relationship_type: str,
        first_seen_at: str,
        last_seen_at: str,
        evidence_id: str | None = None,
        attributes: dict[str, Any] | None = None,
    ) -> None:
        key = (customer_id, relationship_type, entity_id)
        existing = accumulators.get(key)
        if existing is None:
            existing = _EdgeAccumulator(
                customer_id=customer_id,
                entity_id=entity_id,
                entity_type=entity_type,
                relationship_type=relationship_type,
                first_seen_at=first_seen_at,
                last_seen_at=last_seen_at,
                attributes=dict(attributes or {}),
            )
            accumulators[key] = existing
        else:
            if first_seen_at and (
                not existing.first_seen_at or first_seen_at < existing.first_seen_at
            ):
                existing.first_seen_at = first_seen_at
            if last_seen_at and (not existing.last_seen_at or last_seen_at > existing.last_seen_at):
                existing.last_seen_at = last_seen_at
            if attributes:
                existing.attributes.update(attributes)
        existing.event_count += 1
        if evidence_id:
            existing.evidence_ids.add(evidence_id)

    def _build_customer_connections(
        self, direct_edges: tuple[DirectRelationshipEdge, ...]
    ) -> tuple[tuple[CustomerConnection, ...], tuple[ProjectionSuppression, ...]]:
        customers_by_entity: dict[tuple[str, str, str], set[str]] = defaultdict(set)
        for edge in direct_edges:
            customers_by_entity[(edge.entity_type, edge.entity_id, edge.relationship_type)].add(
                edge.customer_id
            )

        evidence_by_pair: dict[tuple[str, str], list[SharedEntityEvidence]] = defaultdict(list)
        suppressions: list[ProjectionSuppression] = []
        for (entity_type, entity_id, direct_type), customer_ids in sorted(
            customers_by_entity.items()
        ):
            group_size = len(customer_ids)
            if group_size < 2:
                continue
            shared_type = DIRECT_TO_SHARED[direct_type]
            if group_size > self.config.max_projected_group_size:
                suppressions.append(
                    ProjectionSuppression(
                        entity_id=entity_id,
                        entity_type=entity_type,
                        relationship_type=shared_type,
                        linked_customer_count=group_size,
                        reason="group_exceeds_projection_limit",
                    )
                )
                continue
            evidence = SharedEntityEvidence(
                entity_id=entity_id,
                entity_type=entity_type,
                relationship_type=shared_type,
                linked_customer_count=group_size,
                weight=self.config.weight_for(shared_type),
            )
            for source, target in combinations(sorted(customer_ids), 2):
                evidence_by_pair[(source, target)].append(evidence)

        connections = []
        for (source, target), evidence_items in evidence_by_pair.items():
            evidence = tuple(
                sorted(
                    evidence_items,
                    key=lambda item: (
                        -item.weight,
                        ENTITY_TYPE_ORDER[item.entity_type],
                        item.entity_id,
                    ),
                )
            )
            connections.append(
                CustomerConnection(
                    source_customer_id=source,
                    target_customer_id=target,
                    shared_entity_count=len(evidence),
                    connection_strength=round(min(1.0, sum(item.weight for item in evidence)), 4),
                    evidence=evidence,
                )
            )
        return (
            tuple(
                sorted(
                    connections,
                    key=lambda item: (item.source_customer_id, item.target_customer_id),
                )
            ),
            tuple(
                sorted(
                    suppressions,
                    key=lambda item: (
                        ENTITY_TYPE_ORDER[item.entity_type],
                        item.entity_id,
                    ),
                )
            ),
        )

    @staticmethod
    def _build_customer_metrics(
        customer_rows: list[dict[str, Any]],
        connections: tuple[CustomerConnection, ...],
    ) -> tuple[CustomerResolutionMetrics, ...]:
        neighbors: dict[str, set[str]] = defaultdict(set)
        shared_entities: dict[str, set[tuple[str, str]]] = defaultdict(set)
        max_strength: dict[str, float] = defaultdict(float)
        for connection in connections:
            source = connection.source_customer_id
            target = connection.target_customer_id
            neighbors[source].add(target)
            neighbors[target].add(source)
            evidence_keys = {(item.entity_type, item.entity_id) for item in connection.evidence}
            shared_entities[source].update(evidence_keys)
            shared_entities[target].update(evidence_keys)
            max_strength[source] = max(max_strength[source], connection.connection_strength)
            max_strength[target] = max(max_strength[target], connection.connection_strength)

        return tuple(
            CustomerResolutionMetrics(
                customer_id=str(row["customer_id"]),
                linked_applicant_count=len(neighbors[str(row["customer_id"])]),
                distinct_shared_entity_count=len(shared_entities[str(row["customer_id"])]),
                max_connection_strength=round(max_strength[str(row["customer_id"])], 4),
            )
            for row in sorted(customer_rows, key=lambda item: str(item["customer_id"]))
        )

    @staticmethod
    def _display_suffix(entity_id: str) -> str:
        return entity_id.rsplit("-", maxsplit=1)[-1]
