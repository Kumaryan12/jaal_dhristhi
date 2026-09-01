from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.entity_resolution import (
    CustomerConnection,
    DirectRelationshipEdge,
    EntityNode,
    RelationshipGraph,
)
from app.services.entity_resolution.models import SharedEntityEvidence
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.graph_intelligence.config import GraphIntelligenceConfig


class GraphIntelligenceEngineTests(unittest.TestCase):
    def test_builds_heterogeneous_and_customer_graphs(self) -> None:
        structures = GraphIntelligenceEngine().build_graphs(self._relationship_graph())

        self.assertEqual(structures.heterogeneous_graph.number_of_nodes(), 7)
        self.assertEqual(structures.heterogeneous_graph.number_of_edges(), 5)
        self.assertEqual(structures.customer_graph.number_of_nodes(), 4)
        self.assertEqual(structures.customer_graph.number_of_edges(), 2)
        self.assertEqual(
            structures.heterogeneous_graph.nodes["CUS-A"]["entity_type"], "customer"
        )
        self.assertEqual(
            structures.customer_graph.edges["CUS-A", "CUS-B"]["relationship_types"],
            ("shared_device",),
        )

    def test_calculates_centrality_component_and_density_features(self) -> None:
        result = GraphIntelligenceEngine().analyze(self._relationship_graph())
        feature_a = result.feature_for("CUS-A")
        feature_b = result.feature_for("CUS-B")
        feature_d = result.feature_for("CUS-D")

        self.assertAlmostEqual(feature_a.degree_centrality, 1 / 3, places=7)
        self.assertAlmostEqual(feature_b.degree_centrality, 2 / 3, places=7)
        self.assertEqual(feature_a.connected_applicant_count, 1)
        self.assertEqual(feature_b.connected_applicant_count, 2)
        self.assertEqual(feature_a.cluster_size, 3)
        self.assertAlmostEqual(feature_a.network_density, 2 / 3, places=7)
        self.assertEqual(feature_d.cluster_size, 1)
        self.assertEqual(feature_d.network_density, 0.0)

    def test_calculates_distinct_shared_identity_signals(self) -> None:
        result = GraphIntelligenceEngine().analyze(self._relationship_graph())
        feature_a = result.feature_for("CUS-A")
        feature_b = result.feature_for("CUS-B")

        self.assertEqual(feature_a.shared_identity_signal_count, 1)
        self.assertEqual(feature_a.shared_device_count, 1)
        self.assertEqual(feature_a.shared_device_applicant_count_max, 1)
        self.assertEqual(feature_b.shared_identity_signal_count, 2)
        self.assertEqual(feature_b.shared_account_count, 1)
        self.assertEqual(feature_b.max_connection_strength, 0.45)
        self.assertEqual(feature_b.mean_connection_strength, 0.4)

    def test_community_detection_is_deterministic(self) -> None:
        engine = GraphIntelligenceEngine()

        first = engine.analyze(self._relationship_graph())
        second = engine.analyze(self._relationship_graph())

        self.assertEqual(first, second)
        self.assertEqual(first.summary.connected_component_count, 2)
        self.assertGreaterEqual(first.summary.community_count, 2)
        self.assertEqual(len(first.features), 4)

    def test_minimum_strength_filters_weak_projection_edges(self) -> None:
        result = GraphIntelligenceEngine(
            GraphIntelligenceConfig(minimum_connection_strength=0.4)
        ).analyze(self._relationship_graph())

        self.assertEqual(result.summary.customer_edge_count, 1)
        self.assertEqual(result.feature_for("CUS-B").connected_applicant_count, 1)
        self.assertEqual(result.feature_for("CUS-C").connected_applicant_count, 0)

    def test_exports_versioned_features_and_protects_existing_files(self) -> None:
        result = GraphIntelligenceEngine().analyze(self._relationship_graph())
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory)

            artifacts = result.export_artifacts(output_dir)

            self.assertIn(
                "customer_id,degree_centrality", artifacts["features"].read_text()
            )
            summary = artifacts["summary"].read_text()
            self.assertIn('"feature_schema_version": "1.0.0"', summary)
            self.assertIn('"feature_row_count": 4', summary)
            with self.assertRaises(FileExistsError):
                result.export_artifacts(output_dir)

    @staticmethod
    def _relationship_graph() -> RelationshipGraph:
        nodes = (
            EntityNode("CUS-A", "customer", "Customer A"),
            EntityNode("CUS-B", "customer", "Customer B"),
            EntityNode("CUS-C", "customer", "Customer C"),
            EntityNode("CUS-D", "customer", "Customer D"),
            EntityNode("DEV-X", "device", "Device X"),
            EntityNode("ACC-X", "account", "Account X"),
            EntityNode("LOC-X", "location", "Location X"),
        )
        timestamp = "2026-08-01T10:00:00Z"
        direct_edges = (
            DirectRelationshipEdge(
                "REL-A-DEV",
                "CUS-A",
                "DEV-X",
                "device",
                "uses_device",
                timestamp,
                timestamp,
                1,
            ),
            DirectRelationshipEdge(
                "REL-B-DEV",
                "CUS-B",
                "DEV-X",
                "device",
                "uses_device",
                timestamp,
                timestamp,
                1,
            ),
            DirectRelationshipEdge(
                "REL-B-ACC",
                "CUS-B",
                "ACC-X",
                "account",
                "linked_account",
                timestamp,
                timestamp,
                1,
            ),
            DirectRelationshipEdge(
                "REL-C-ACC",
                "CUS-C",
                "ACC-X",
                "account",
                "linked_account",
                timestamp,
                timestamp,
                1,
            ),
            DirectRelationshipEdge(
                "REL-D-LOC",
                "CUS-D",
                "LOC-X",
                "location",
                "located_in",
                timestamp,
                timestamp,
                1,
            ),
        )
        connections = (
            CustomerConnection(
                "CUS-A",
                "CUS-B",
                1,
                0.45,
                (SharedEntityEvidence("DEV-X", "device", "shared_device", 2, 0.45),),
            ),
            CustomerConnection(
                "CUS-B",
                "CUS-C",
                1,
                0.35,
                (SharedEntityEvidence("ACC-X", "account", "shared_account", 2, 0.35),),
            ),
        )
        return RelationshipGraph(nodes, direct_edges, connections, (), ())


if __name__ == "__main__":
    unittest.main()
