from __future__ import annotations

import csv
import json
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.services.synthetic_data import (
    GenerationConfig,
    SyntheticDataGenerator,
    validate_dataset,
)


class SyntheticDataGeneratorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.config = GenerationConfig(
            seed=17,
            normal_application_count=120,
            suspicious_ecosystem_count=8,
            normal_dealer_count=20,
            suspicious_dealer_count=4,
        )

    def test_generation_is_deterministic_for_the_same_seed(self) -> None:
        first = SyntheticDataGenerator(self.config).generate()
        second = SyntheticDataGenerator(self.config).generate()

        self.assertEqual(first.tables, second.tables)
        self.assertEqual(first.manifest(), second.manifest())

    def test_dataset_satisfies_cross_table_contract(self) -> None:
        dataset = SyntheticDataGenerator(self.config).generate()

        report = validate_dataset(dataset)

        self.assertTrue(report["valid"])
        self.assertEqual(report["normal_applications"], 120)
        self.assertEqual(report["suspicious_ecosystems"], 8)
        self.assertGreaterEqual(report["suspicious_applications"], 8 * 4)

    def test_suspicious_population_is_individually_plausible(self) -> None:
        dataset = SyntheticDataGenerator(self.config).generate()
        suspicious_ids = {
            row["customer_id"]
            for row in dataset.tables["ground_truth"]
            if row["is_suspicious"]
        }
        suspicious_customers = [
            row
            for row in dataset.tables["customers"]
            if row["customer_id"] in suspicious_ids
        ]

        average_score = sum(row["credit_score"] for row in suspicious_customers) / len(
            suspicious_customers
        )
        self.assertGreater(average_score, 670)
        self.assertTrue(
            all(row["annual_income_inr"] >= 140_000 for row in suspicious_customers)
        )

    def test_all_ecosystem_pattern_types_are_represented(self) -> None:
        dataset = SyntheticDataGenerator(self.config).generate()

        pattern_counts = Counter(
            row["pattern_type"] for row in dataset.tables["ecosystems"]
        )

        self.assertEqual(
            set(pattern_counts),
            {"shared_device", "shared_account", "dealer_burst", "mixed_ring"},
        )
        self.assertTrue(all(count == 2 for count in pattern_counts.values()))

    def test_ground_truth_provenance_is_isolated_from_source_tables(self) -> None:
        dataset = SyntheticDataGenerator(self.config).generate()
        evaluation_tables = {"ground_truth", "ecosystems"}

        for table_name, rows in dataset.tables.items():
            if table_name in evaluation_tables:
                continue
            columns = set(rows[0])
            self.assertNotIn("is_suspicious", columns, table_name)
            self.assertNotIn("pattern_type", columns, table_name)
            self.assertNotIn("scenario_id", columns, table_name)
            self.assertNotIn("synthetic_segment", columns, table_name)

    def test_csv_export_includes_manifest_and_refuses_accidental_overwrite(
        self,
    ) -> None:
        dataset = SyntheticDataGenerator(self.config).generate()
        with tempfile.TemporaryDirectory() as temporary_directory:
            output_dir = Path(temporary_directory)

            manifest_path = dataset.export_csv(output_dir)

            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            self.assertEqual(manifest["actual"]["normal_applications"], 120)
            self.assertIn("applications.csv", manifest["sha256"])
            with (output_dir / "applications.csv").open(
                encoding="utf-8", newline=""
            ) as handle:
                rows = list(csv.DictReader(handle))
            self.assertEqual(len(rows), len(dataset.tables["applications"]))
            with self.assertRaises(FileExistsError):
                dataset.export_csv(output_dir)


if __name__ == "__main__":
    unittest.main()
