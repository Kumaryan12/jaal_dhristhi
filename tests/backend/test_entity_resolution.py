from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.entity_resolution import EntityResolutionEngine, ResolutionConfig
from app.services.synthetic_data import (
    GenerationConfig,
    SyntheticDataGenerator,
    SyntheticDataset,
)


class EntityResolutionEngineTests(unittest.TestCase):
    def test_resolves_direct_edges_and_aggregates_shared_evidence(self) -> None:
        graph = EntityResolutionEngine().resolve(self._fixture_dataset())

        connection = next(
            item
            for item in graph.customer_connections
            if {item.source_customer_id, item.target_customer_id} == {"CUS-A", "CUS-B"}
        )
        self.assertEqual(connection.shared_entity_count, 4)
        self.assertEqual(connection.connection_strength, 1.0)
        self.assertEqual(
            {item.relationship_type for item in connection.evidence},
            {"shared_device", "shared_account", "same_dealer", "same_location"},
        )
        self.assertEqual(len(graph.direct_edges), 12)

    def test_calculates_number_of_linked_applicants_per_customer(self) -> None:
        graph = EntityResolutionEngine().resolve(self._fixture_dataset())
        metrics = {item.customer_id: item for item in graph.customer_metrics}

        self.assertEqual(metrics["CUS-A"].linked_applicant_count, 1)
        self.assertEqual(metrics["CUS-B"].linked_applicant_count, 1)
        self.assertEqual(metrics["CUS-C"].linked_applicant_count, 0)
        self.assertEqual(metrics["CUS-A"].distinct_shared_entity_count, 4)

    def test_high_cardinality_entity_is_retained_but_not_projected(self) -> None:
        graph = EntityResolutionEngine(
            ResolutionConfig(max_projected_group_size=2)
        ).resolve(self._fixture_dataset(all_same_location=True))

        location_edges = [
            edge
            for edge in graph.direct_edges
            if edge.relationship_type == "located_in"
        ]
        location_suppression = next(
            item
            for item in graph.suppressed_projections
            if item.relationship_type == "same_location"
        )
        self.assertEqual(len(location_edges), 3)
        self.assertEqual(location_suppression.linked_customer_count, 3)
        self.assertTrue(
            all(
                "same_location"
                not in {evidence.relationship_type for evidence in connection.evidence}
                for connection in graph.customer_connections
            )
        )

    def test_evaluation_labels_never_enter_graph_nodes_or_edges(self) -> None:
        dataset = self._fixture_dataset()
        dataset.tables["customers"][0].update(
            {
                "is_suspicious": True,
                "scenario_id": "ECO-LEAK",
                "pattern_type": "mixed_ring",
                "unrecognized_metadata": "must-not-pass",
            }
        )
        dataset.tables["ground_truth"] = [
            {
                "application_id": "APP-A",
                "customer_id": "CUS-A",
                "is_suspicious": True,
                "scenario_id": "ECO-LEAK",
                "pattern_type": "mixed_ring",
            }
        ]

        payload = EntityResolutionEngine().resolve(dataset).to_dict()
        serialized = str(payload)

        self.assertNotIn("ECO-LEAK", serialized)
        self.assertNotIn("mixed_ring", serialized)
        self.assertNotIn("is_suspicious", serialized)
        self.assertNotIn("must-not-pass", serialized)

    def test_generated_ecosystem_members_resolve_as_linked_applicants(self) -> None:
        dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=44,
                normal_application_count=120,
                suspicious_ecosystem_count=8,
                normal_dealer_count=20,
                suspicious_dealer_count=4,
            )
        ).generate()

        graph = EntityResolutionEngine().resolve(dataset)
        metrics = {item.customer_id: item for item in graph.customer_metrics}
        suspicious_ids = {
            row["customer_id"]
            for row in dataset.tables["ground_truth"]
            if row["is_suspicious"]
        }

        self.assertTrue(suspicious_ids)
        self.assertTrue(
            all(
                metrics[customer_id].linked_applicant_count >= 3
                for customer_id in suspicious_ids
            )
        )
        self.assertGreater(graph.summary()["customer_connection_count"], 0)

    def test_graph_json_export_is_atomic_and_protected(self) -> None:
        graph = EntityResolutionEngine().resolve(self._fixture_dataset())
        with tempfile.TemporaryDirectory() as temporary_directory:
            target = Path(temporary_directory) / "relationship-graph.json"

            exported = graph.export_json(target)

            self.assertEqual(exported, target.resolve())
            self.assertIn('"customer_connection_count": 1', target.read_text())
            with self.assertRaises(FileExistsError):
                graph.export_json(target)

    @staticmethod
    def _fixture_dataset(*, all_same_location: bool = False) -> SyntheticDataset:
        timestamp = "2026-08-01T10:00:00Z"
        customers = [
            {
                "customer_id": "CUS-A",
                "age": 31,
                "annual_income_inr": 600_000,
                "location_id": "LOC-1",
                "credit_score": 720,
                "created_at": timestamp,
            },
            {
                "customer_id": "CUS-B",
                "age": 36,
                "annual_income_inr": 720_000,
                "location_id": "LOC-1",
                "credit_score": 705,
                "created_at": timestamp,
            },
            {
                "customer_id": "CUS-C",
                "age": 42,
                "annual_income_inr": 840_000,
                "location_id": "LOC-1" if all_same_location else "LOC-2",
                "credit_score": 735,
                "created_at": timestamp,
            },
        ]
        return SyntheticDataset(
            config=GenerationConfig(
                normal_application_count=3,
                suspicious_ecosystem_count=1,
                normal_dealer_count=10,
                suspicious_dealer_count=1,
            ),
            tables={
                "customers": customers,
                "applications": [
                    {
                        "application_id": "APP-A",
                        "customer_id": "CUS-A",
                        "dealer_id": "DLR-1",
                        "submitted_at": timestamp,
                    },
                    {
                        "application_id": "APP-B",
                        "customer_id": "CUS-B",
                        "dealer_id": "DLR-1",
                        "submitted_at": timestamp,
                    },
                    {
                        "application_id": "APP-C",
                        "customer_id": "CUS-C",
                        "dealer_id": "DLR-2",
                        "submitted_at": timestamp,
                    },
                ],
                "devices": [
                    {
                        "device_id": "DEV-X",
                        "device_type": "android",
                        "first_seen_at": timestamp,
                    },
                    {
                        "device_id": "DEV-Y",
                        "device_type": "ios",
                        "first_seen_at": timestamp,
                    },
                ],
                "customer_devices": [
                    {
                        "customer_id": "CUS-A",
                        "device_id": "DEV-X",
                        "first_seen_at": timestamp,
                        "last_seen_at": timestamp,
                    },
                    {
                        "customer_id": "CUS-B",
                        "device_id": "DEV-X",
                        "first_seen_at": timestamp,
                        "last_seen_at": timestamp,
                    },
                    {
                        "customer_id": "CUS-C",
                        "device_id": "DEV-Y",
                        "first_seen_at": timestamp,
                        "last_seen_at": timestamp,
                    },
                ],
                "bank_accounts": [
                    {
                        "account_id": "ACC-X",
                        "bank_code": "BANK-01",
                        "opened_at": "2020-01-01",
                    },
                    {
                        "account_id": "ACC-Y",
                        "bank_code": "BANK-02",
                        "opened_at": "2020-01-01",
                    },
                ],
                "customer_accounts": [
                    {
                        "customer_id": "CUS-A",
                        "account_id": "ACC-X",
                        "relationship_type": "primary",
                        "first_seen_at": timestamp,
                    },
                    {
                        "customer_id": "CUS-B",
                        "account_id": "ACC-X",
                        "relationship_type": "joint",
                        "first_seen_at": timestamp,
                    },
                    {
                        "customer_id": "CUS-C",
                        "account_id": "ACC-Y",
                        "relationship_type": "primary",
                        "first_seen_at": timestamp,
                    },
                ],
                "dealers": [
                    {
                        "dealer_id": "DLR-1",
                        "location_id": "LOC-1",
                        "dealer_type": "authorized",
                    },
                    {
                        "dealer_id": "DLR-2",
                        "location_id": "LOC-2",
                        "dealer_type": "independent",
                    },
                ],
                "locations": [
                    {"location_id": "LOC-1", "city": "Chennai", "state": "Tamil Nadu"},
                    {"location_id": "LOC-2", "city": "Pune", "state": "Maharashtra"},
                ],
            },
        )


if __name__ == "__main__":
    unittest.main()
