"""Build a deterministic before/after ecosystem without mutating baseline state."""

from __future__ import annotations

import uuid
from dataclasses import asdict
from datetime import UTC, datetime
from typing import Any

from app.services.entity_resolution import EntityResolutionEngine, RelationshipGraph
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.graph_intelligence.models import GraphFeatureVector
from app.services.risk_intelligence import RiskAssessment, RiskIntelligenceEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator
from app.services.synthetic_data.dataset import SyntheticDataset
from app.services.temporal_intelligence import TemporalIntelligenceEngine
from app.services.temporal_intelligence.models import TemporalFeatureVector


class EmergingRiskSimulationService:
    """Compute a small shared-device ecosystem in a fresh scenario namespace."""

    applicant_count = 6

    def simulate(self, seed: int) -> dict[str, Any]:
        after_dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=seed,
                normal_application_count=1,
                suspicious_ecosystem_count=1,
                min_ecosystem_size=self.applicant_count,
                max_ecosystem_size=self.applicant_count,
            )
        ).generate()
        ecosystem = after_dataset.tables["ecosystems"][0]
        ecosystem_id = str(ecosystem["scenario_id"])
        scenario_truth = [
            row
            for row in after_dataset.tables["ground_truth"]
            if str(row["scenario_id"]) == ecosystem_id
        ]
        application_by_id = {
            str(row["application_id"]): row for row in after_dataset.tables["applications"]
        }
        focus_truth = max(
            scenario_truth,
            key=lambda row: (
                str(application_by_id[str(row["application_id"])]["submitted_at"]),
                str(row["application_id"]),
            ),
        )
        focus_application_id = str(focus_truth["application_id"])
        focus_customer_id = str(focus_truth["customer_id"])
        before_dataset = self._focus_only_dataset(
            after_dataset,
            focus_application_id=focus_application_id,
            focus_customer_id=focus_customer_id,
        )

        before_assessment, before_graph, before_temporal, before_relationships = self._analyse(
            before_dataset, focus_application_id, focus_customer_id
        )
        after_assessment, after_graph, after_temporal, after_relationships = self._analyse(
            after_dataset, focus_application_id, focus_customer_id
        )
        network = self._scenario_network(
            after_dataset,
            after_relationships,
            scenario_truth=scenario_truth,
            focus_customer_id=focus_customer_id,
            shared_device_id=str(ecosystem["shared_device_id"]),
            dealer_id=str(ecosystem["concentrated_dealer_id"]),
        )
        before_node_ids = {
            focus_customer_id,
            str(ecosystem["shared_device_id"]),
            str(ecosystem["concentrated_dealer_id"]),
        }
        before_edge_ids = {
            edge["id"] for edge in network["edges"] if edge["source"] == focus_customer_id
        }
        generated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        return {
            "scenario_id": f"SIM-{seed}-{uuid.uuid4().hex[:12]}",
            "seed": seed,
            "customer_label": "Customer A",
            "application_id": focus_application_id,
            "customer_id": focus_customer_id,
            "before": self._snapshot(before_assessment, before_graph, before_temporal),
            "after": self._snapshot(after_assessment, after_graph, after_temporal),
            "created_entities": [
                node for node in network["nodes"] if node["id"] not in before_node_ids
            ],
            "created_edges": [
                edge for edge in network["edges"] if edge["id"] not in before_edge_ids
            ],
            "network": network,
            "explanations": [asdict(signal) for signal in after_assessment.signals],
            "recommended_action": asdict(after_assessment.recommended_action),
            "generated_at": generated_at,
        }

    @staticmethod
    def _analyse(
        dataset: SyntheticDataset, application_id: str, customer_id: str
    ) -> tuple[
        RiskAssessment,
        GraphFeatureVector,
        TemporalFeatureVector,
        RelationshipGraph,
    ]:
        relationships = EntityResolutionEngine().resolve(dataset)
        graph = GraphIntelligenceEngine().analyze(relationships)
        temporal = TemporalIntelligenceEngine().analyze(dataset, relationships)
        assessment = RiskIntelligenceEngine().analyze_application(
            application_id,
            dataset,
            relationships,
            graph,
            temporal,
        )
        return (
            assessment,
            graph.feature_for(customer_id),
            temporal.feature_for(application_id),
            relationships,
        )

    @staticmethod
    def _snapshot(
        assessment: RiskAssessment,
        graph: GraphFeatureVector,
        temporal: TemporalFeatureVector,
    ) -> dict[str, Any]:
        return {
            "risk_score": assessment.risk_score,
            "risk_level": assessment.risk_level,
            "linked_applicant_count": graph.connected_applicant_count,
            "cluster_size": graph.cluster_size,
            "shared_device_applicant_count": graph.shared_device_applicant_count_max + 1,
            "application_velocity_2h": temporal.application_velocity_2h,
            "dealer_applications_2h": temporal.applications_same_dealer_2h,
            "signals": [asdict(signal) for signal in assessment.signals],
            "recommended_action": asdict(assessment.recommended_action),
        }

    @staticmethod
    def _focus_only_dataset(
        dataset: SyntheticDataset,
        *,
        focus_application_id: str,
        focus_customer_id: str,
    ) -> SyntheticDataset:
        device_ids = {
            str(row["device_id"])
            for row in dataset.tables["customer_devices"]
            if str(row["customer_id"]) == focus_customer_id
        }
        account_ids = {
            str(row["account_id"])
            for row in dataset.tables["customer_accounts"]
            if str(row["customer_id"]) == focus_customer_id
        }
        tables = {name: list(rows) for name, rows in dataset.tables.items()}
        tables["customers"] = [
            row
            for row in dataset.tables["customers"]
            if str(row["customer_id"]) == focus_customer_id
        ]
        tables["applications"] = [
            row
            for row in dataset.tables["applications"]
            if str(row["application_id"]) == focus_application_id
        ]
        tables["customer_devices"] = [
            row
            for row in dataset.tables["customer_devices"]
            if str(row["customer_id"]) == focus_customer_id
        ]
        tables["customer_accounts"] = [
            row
            for row in dataset.tables["customer_accounts"]
            if str(row["customer_id"]) == focus_customer_id
        ]
        tables["devices"] = [
            row for row in dataset.tables["devices"] if str(row["device_id"]) in device_ids
        ]
        tables["bank_accounts"] = [
            row
            for row in dataset.tables["bank_accounts"]
            if str(row["account_id"]) in account_ids
        ]
        tables["repayments"] = [
            row
            for row in dataset.tables["repayments"]
            if str(row["application_id"]) == focus_application_id
        ]
        tables["repayment_summaries"] = [
            row
            for row in dataset.tables["repayment_summaries"]
            if str(row["application_id"]) == focus_application_id
        ]
        tables["ground_truth"] = [
            row
            for row in dataset.tables["ground_truth"]
            if str(row["application_id"]) == focus_application_id
        ]
        tables["ecosystems"] = []
        return SyntheticDataset(config=dataset.config, tables=tables)

    @staticmethod
    def _scenario_network(
        dataset: SyntheticDataset,
        relationships: RelationshipGraph,
        *,
        scenario_truth: list[dict[str, Any]],
        focus_customer_id: str,
        shared_device_id: str,
        dealer_id: str,
    ) -> dict[str, Any]:
        customer_ids = {str(row["customer_id"]) for row in scenario_truth}
        selected_ids = customer_ids | {shared_device_id, dealer_id}
        node_catalog = {node.entity_id: node for node in relationships.nodes}
        nodes = []
        for node_id in sorted(
            selected_ids,
            key=lambda item: (
                item != focus_customer_id,
                node_catalog[item].entity_type,
                item,
            ),
        ):
            node = node_catalog[node_id]
            role = (
                "focus_customer"
                if node_id == focus_customer_id
                else "applicant"
                if node.entity_type == "customer"
                else "shared_device"
                if node.entity_type == "device"
                else "dealer"
            )
            nodes.append(
                {
                    "id": node_id,
                    "type": node.entity_type,
                    "label": "Customer A" if node_id == focus_customer_id else node.label,
                    "role": role,
                    "is_focus": node_id == focus_customer_id,
                }
            )
        edges = [
            {
                "id": edge.edge_id,
                "source": edge.customer_id,
                "target": edge.entity_id,
                "type": edge.relationship_type,
            }
            for edge in relationships.direct_edges
            if edge.customer_id in customer_ids
            and edge.entity_id in {shared_device_id, dealer_id}
        ]
        return {
            "nodes": nodes,
            "edges": edges,
            "summary": {
                "applicant_count": len(customer_ids),
                "shared_device_id": shared_device_id,
                "dealer_id": dealer_id,
            },
        }
