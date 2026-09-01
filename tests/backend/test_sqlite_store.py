"""Persistence contract tests for the Phase 7 SQLite demo store."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from app.repositories import SQLiteDemoStore, StoredAnalysis
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator


class SQLiteDemoStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.store = SQLiteDemoStore(Path(self.temporary_directory.name) / "api.db")
        self.dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=7, normal_application_count=8, suspicious_ecosystem_count=3
            )
        ).generate()

    def test_dataset_round_trip_preserves_ordered_tables_and_config(self) -> None:
        self.store.save_dataset(
            self.dataset,
            generated_at="2026-09-01T12:00:00Z",
            replace_existing=False,
        )
        loaded = self.store.load_active_dataset()
        self.assertIsNotNone(loaded)
        restored, generated_at = loaded  # type: ignore[misc]
        self.assertEqual(restored.dataset_id, self.dataset.dataset_id)
        self.assertEqual(restored.tables, self.dataset.tables)
        self.assertEqual(restored.config, self.dataset.config)
        self.assertEqual(generated_at, "2026-09-01T12:00:00Z")

    def test_active_dataset_requires_explicit_replace(self) -> None:
        self.store.save_dataset(
            self.dataset,
            generated_at="2026-09-01T12:00:00Z",
            replace_existing=False,
        )
        with self.assertRaises(FileExistsError):
            self.store.save_dataset(
                self.dataset,
                generated_at="2026-09-01T12:01:00Z",
                replace_existing=False,
            )
        replacement = SyntheticDataGenerator(
            GenerationConfig(
                seed=8, normal_application_count=5, suspicious_ecosystem_count=3
            )
        ).generate()
        self.store.save_dataset(
            replacement,
            generated_at="2026-09-01T12:02:00Z",
            replace_existing=True,
        )
        loaded = self.store.load_active_dataset()
        self.assertEqual(loaded[0].dataset_id, replacement.dataset_id)  # type: ignore[index]

    def test_analysis_upsert_is_scoped_to_active_dataset(self) -> None:
        self.store.save_dataset(
            self.dataset,
            generated_at="2026-09-01T12:00:00Z",
            replace_existing=False,
        )
        first = StoredAnalysis(
            analysis_id="analysis_first",
            application_id="APP-1",
            assessment={"risk_score": 40},
            analysed_at="2026-09-01T12:03:00Z",
        )
        second = StoredAnalysis(
            analysis_id="analysis_second",
            application_id="APP-1",
            assessment={"risk_score": 55},
            analysed_at="2026-09-01T12:04:00Z",
        )
        self.store.save_analysis(self.dataset.dataset_id, first)
        self.store.save_analysis(self.dataset.dataset_id, second)
        restored = self.store.get_analysis(self.dataset.dataset_id, "APP-1")
        self.assertEqual(restored, second)
        self.assertEqual(self.store.list_analyses(self.dataset.dataset_id), (second,))


if __name__ == "__main__":
    unittest.main()
