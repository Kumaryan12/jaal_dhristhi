"""Typed output models for the heterogeneous relationship graph."""

from __future__ import annotations

import json
import os
import tempfile
from collections import Counter
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any


@dataclass(frozen=True, slots=True)
class EntityNode:
    entity_id: str
    entity_type: str
    label: str
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class DirectRelationshipEdge:
    edge_id: str
    customer_id: str
    entity_id: str
    entity_type: str
    relationship_type: str
    first_seen_at: str
    last_seen_at: str
    event_count: int
    evidence_ids: tuple[str, ...] = ()
    attributes: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class SharedEntityEvidence:
    entity_id: str
    entity_type: str
    relationship_type: str
    linked_customer_count: int
    weight: float


@dataclass(frozen=True, slots=True)
class CustomerConnection:
    source_customer_id: str
    target_customer_id: str
    shared_entity_count: int
    connection_strength: float
    evidence: tuple[SharedEntityEvidence, ...]


@dataclass(frozen=True, slots=True)
class CustomerResolutionMetrics:
    customer_id: str
    linked_applicant_count: int
    distinct_shared_entity_count: int
    max_connection_strength: float


@dataclass(frozen=True, slots=True)
class ProjectionSuppression:
    entity_id: str
    entity_type: str
    relationship_type: str
    linked_customer_count: int
    reason: str


@dataclass(frozen=True, slots=True)
class RelationshipGraph:
    """Heterogeneous graph plus a derived customer-to-customer projection."""

    nodes: tuple[EntityNode, ...]
    direct_edges: tuple[DirectRelationshipEdge, ...]
    customer_connections: tuple[CustomerConnection, ...]
    customer_metrics: tuple[CustomerResolutionMetrics, ...]
    suppressed_projections: tuple[ProjectionSuppression, ...]

    def summary(self) -> dict[str, Any]:
        node_counts = Counter(node.entity_type for node in self.nodes)
        edge_counts = Counter(edge.relationship_type for edge in self.direct_edges)
        evidence_counts = Counter(
            evidence.relationship_type
            for connection in self.customer_connections
            for evidence in connection.evidence
        )
        linked_metrics = [
            metric for metric in self.customer_metrics if metric.linked_applicant_count > 0
        ]
        return {
            "node_count": len(self.nodes),
            "node_counts_by_type": dict(sorted(node_counts.items())),
            "direct_edge_count": len(self.direct_edges),
            "direct_edge_counts_by_type": dict(sorted(edge_counts.items())),
            "customer_connection_count": len(self.customer_connections),
            "connection_evidence_counts_by_type": dict(sorted(evidence_counts.items())),
            "customers_with_links": len(linked_metrics),
            "max_linked_applicants": max(
                (metric.linked_applicant_count for metric in linked_metrics), default=0
            ),
            "suppressed_projection_count": len(self.suppressed_projections),
        }

    def to_dict(self) -> dict[str, Any]:
        return {
            "summary": self.summary(),
            "nodes": [asdict(node) for node in self.nodes],
            "direct_edges": [asdict(edge) for edge in self.direct_edges],
            "customer_connections": [
                asdict(connection) for connection in self.customer_connections
            ],
            "customer_metrics": [asdict(metric) for metric in self.customer_metrics],
            "suppressed_projections": [
                asdict(suppression) for suppression in self.suppressed_projections
            ],
        }

    def export_json(self, target: Path, *, replace_existing: bool = False) -> Path:
        """Atomically export the complete graph, refusing overwrite by default."""

        target = target.resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and not replace_existing:
            raise FileExistsError(f"relationship graph already exists: {target}")
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=target.parent, delete=False
        ) as handle:
            json.dump(self.to_dict(), handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_name = handle.name
        os.replace(temporary_name, target)
        return target
