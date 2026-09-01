from __future__ import annotations

import sys
import unittest
from datetime import UTC, datetime, timedelta
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.entity_resolution import EntityResolutionEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataset
from app.services.temporal_intelligence import TemporalIntelligenceEngine


class TemporalIntelligenceEngineTests(unittest.TestCase):
    def test_detects_five_unique_applicants_at_one_dealer_within_two_hours(
        self,
    ) -> None:
        dataset = self._burst_dataset()
        relationships = EntityResolutionEngine().resolve(dataset)

        result = TemporalIntelligenceEngine().analyze(dataset, relationships)
        first = result.feature_for("APP-1")
        fifth = result.feature_for("APP-5")

        self.assertEqual(first.applications_same_dealer_2h, 1)
        self.assertFalse(first.rapid_burst_detected)
        self.assertEqual(fifth.applications_same_dealer_2h, 5)
        self.assertEqual(fifth.application_velocity_2h, 5)
        self.assertTrue(fifth.rapid_burst_detected)
        self.assertEqual(fifth.burst_signal_types, ("dealer_2h",))

    def test_never_reads_future_applications(self) -> None:
        dataset = self._burst_dataset()
        relationships = EntityResolutionEngine().resolve(dataset)

        first = (
            TemporalIntelligenceEngine()
            .analyze(dataset, relationships)
            .feature_for("APP-1")
        )

        self.assertEqual(first.linked_applicants_24h, 0)
        self.assertEqual(first.network_growth_rate_24h, 0.0)
        self.assertIsNone(first.hours_since_latest_link)
        self.assertEqual(first.recency_score, 0.0)

    def test_calculates_shared_device_account_growth_and_recency(self) -> None:
        dataset = self._burst_dataset()
        relationships = EntityResolutionEngine().resolve(dataset)

        result = TemporalIntelligenceEngine().analyze(dataset, relationships)
        second = result.feature_for("APP-2")
        fifth = result.feature_for("APP-5")

        self.assertEqual(second.applications_same_device_2h, 2)
        self.assertEqual(second.applications_same_account_24h, 2)
        self.assertEqual(fifth.linked_applicants_24h, 4)
        self.assertEqual(fifth.network_prior_applicants_30d, 0)
        self.assertEqual(fifth.network_growth_rate_24h, 4.0)
        self.assertEqual(fifth.hours_since_latest_link, 0.3333)
        self.assertGreater(fifth.recency_score, 0.99)

    def test_repeat_submissions_by_one_customer_do_not_trigger_network_burst(
        self,
    ) -> None:
        dataset = self._burst_dataset(repeat_customer=True)
        relationships = EntityResolutionEngine().resolve(dataset)

        result = TemporalIntelligenceEngine().analyze(dataset, relationships)
        fifth = result.feature_for("APP-5")

        self.assertEqual(fifth.applications_same_dealer_2h, 5)
        self.assertEqual(fifth.customer_applications_30d, 5)
        self.assertFalse(fifth.rapid_burst_detected)

    def test_temporal_output_is_deterministic(self) -> None:
        dataset = self._burst_dataset()
        relationships = EntityResolutionEngine().resolve(dataset)
        engine = TemporalIntelligenceEngine()

        self.assertEqual(
            engine.analyze(dataset, relationships),
            engine.analyze(dataset, relationships),
        )

    def test_empty_application_set_returns_zero_summary(self) -> None:
        dataset = self._burst_dataset()
        dataset.tables["applications"] = []
        relationships = EntityResolutionEngine().resolve(dataset)

        result = TemporalIntelligenceEngine().analyze(dataset, relationships)

        self.assertEqual(result.features, ())
        self.assertEqual(result.summary.application_count, 0)
        self.assertEqual(result.summary.average_network_growth_rate_24h, 0.0)
        self.assertEqual(result.summary.average_recency_score, 0.0)

    @staticmethod
    def _burst_dataset(*, repeat_customer: bool = False) -> SyntheticDataset:
        base = datetime(2026, 8, 1, 10, 0, tzinfo=UTC)
        customer_ids = (
            ["CUS-1"] * 5
            if repeat_customer
            else [f"CUS-{index}" for index in range(1, 6)]
        )
        distinct_customers = sorted(set(customer_ids))
        customers = [
            {
                "customer_id": customer_id,
                "age": 30,
                "annual_income_inr": 600_000,
                "location_id": "LOC-1",
                "credit_score": 720,
                "created_at": (base - timedelta(days=2)).isoformat(),
            }
            for customer_id in distinct_customers
        ]
        applications = [
            {
                "application_id": f"APP-{index}",
                "customer_id": customer_ids[index - 1],
                "loan_amount_inr": 100_000,
                "loan_type": "two_wheeler",
                "dealer_id": "DLR-1",
                "submitted_at": (
                    base + timedelta(minutes=20 * (index - 1))
                ).isoformat(),
            }
            for index in range(1, 6)
        ]
        device_for_customer = {
            customer_id: (
                "DEV-SHARED"
                if customer_id in {"CUS-1", "CUS-2"}
                else f"DEV-{customer_id}"
            )
            for customer_id in distinct_customers
        }
        account_for_customer = {
            customer_id: (
                "ACC-SHARED"
                if customer_id in {"CUS-1", "CUS-2"}
                else f"ACC-{customer_id}"
            )
            for customer_id in distinct_customers
        }
        first_application_time = {
            customer_id: min(
                row["submitted_at"]
                for row in applications
                if row["customer_id"] == customer_id
            )
            for customer_id in distinct_customers
        }
        return SyntheticDataset(
            config=GenerationConfig(
                normal_application_count=5,
                suspicious_ecosystem_count=1,
                normal_dealer_count=10,
                suspicious_dealer_count=1,
            ),
            tables={
                "customers": customers,
                "applications": applications,
                "devices": [
                    {
                        "device_id": device_id,
                        "device_type": "android",
                        "first_seen_at": base.isoformat(),
                    }
                    for device_id in sorted(set(device_for_customer.values()))
                ],
                "customer_devices": [
                    {
                        "customer_id": customer_id,
                        "device_id": device_for_customer[customer_id],
                        "first_seen_at": first_application_time[customer_id],
                        "last_seen_at": first_application_time[customer_id],
                    }
                    for customer_id in distinct_customers
                ],
                "bank_accounts": [
                    {
                        "account_id": account_id,
                        "bank_code": "BANK-01",
                        "opened_at": "2020-01-01",
                    }
                    for account_id in sorted(set(account_for_customer.values()))
                ],
                "customer_accounts": [
                    {
                        "customer_id": customer_id,
                        "account_id": account_for_customer[customer_id],
                        "relationship_type": "primary",
                        "first_seen_at": first_application_time[customer_id],
                    }
                    for customer_id in distinct_customers
                ],
                "dealers": [
                    {
                        "dealer_id": "DLR-1",
                        "location_id": "LOC-1",
                        "dealer_type": "authorized",
                    }
                ],
                "locations": [
                    {
                        "location_id": "LOC-1",
                        "city": "Chennai",
                        "state": "Tamil Nadu",
                        "postal_zone": "600-A",
                    }
                ],
            },
        )


if __name__ == "__main__":
    unittest.main()
