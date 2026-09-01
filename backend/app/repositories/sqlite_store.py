"""Transactional SQLite store for the active demo dataset and cached analyses."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from app.services.synthetic_data import GenerationConfig
from app.services.synthetic_data.dataset import SyntheticDataset


@dataclass(frozen=True, slots=True)
class StoredAnalysis:
    analysis_id: str
    application_id: str
    assessment: dict[str, Any]
    analysed_at: str


class SQLiteDemoStore:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path.resolve()
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS datasets (
                    dataset_id TEXT PRIMARY KEY,
                    seed INTEGER NOT NULL,
                    normal_application_count INTEGER NOT NULL,
                    suspicious_ecosystem_count INTEGER NOT NULL,
                    min_ecosystem_size INTEGER NOT NULL,
                    max_ecosystem_size INTEGER NOT NULL,
                    normal_dealer_count INTEGER NOT NULL,
                    suspicious_dealer_count INTEGER NOT NULL,
                    benign_shared_device_rate REAL NOT NULL,
                    benign_shared_account_rate REAL NOT NULL,
                    as_of TEXT NOT NULL,
                    generated_at TEXT NOT NULL,
                    is_active INTEGER NOT NULL CHECK (is_active IN (0, 1))
                );
                CREATE UNIQUE INDEX IF NOT EXISTS one_active_dataset
                    ON datasets(is_active) WHERE is_active = 1;
                CREATE TABLE IF NOT EXISTS dataset_records (
                    dataset_id TEXT NOT NULL,
                    table_name TEXT NOT NULL,
                    row_index INTEGER NOT NULL,
                    payload_json TEXT NOT NULL,
                    PRIMARY KEY (dataset_id, table_name, row_index),
                    FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id) ON DELETE CASCADE
                );
                CREATE INDEX IF NOT EXISTS dataset_records_lookup
                    ON dataset_records(dataset_id, table_name, row_index);
                CREATE TABLE IF NOT EXISTS analyses (
                    dataset_id TEXT NOT NULL,
                    application_id TEXT NOT NULL,
                    analysis_id TEXT NOT NULL,
                    assessment_json TEXT NOT NULL,
                    analysed_at TEXT NOT NULL,
                    PRIMARY KEY (dataset_id, application_id),
                    FOREIGN KEY (dataset_id) REFERENCES datasets(dataset_id) ON DELETE CASCADE
                );
                """
            )

    def has_active_dataset(self) -> bool:
        with self._connect() as connection:
            row = connection.execute("SELECT 1 FROM datasets WHERE is_active = 1").fetchone()
        return row is not None

    def save_dataset(
        self,
        dataset: SyntheticDataset,
        *,
        generated_at: str,
        replace_existing: bool,
    ) -> None:
        config = dataset.config
        with self._connect() as connection:
            active = connection.execute(
                "SELECT dataset_id FROM datasets WHERE is_active = 1"
            ).fetchone()
            if active is not None and not replace_existing:
                raise FileExistsError("an active demo dataset already exists")
            if active is not None:
                connection.execute("DELETE FROM datasets WHERE is_active = 1")
            connection.execute(
                """
                INSERT INTO datasets VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                """,
                (
                    dataset.dataset_id,
                    config.seed,
                    config.normal_application_count,
                    config.suspicious_ecosystem_count,
                    config.min_ecosystem_size,
                    config.max_ecosystem_size,
                    config.normal_dealer_count,
                    config.suspicious_dealer_count,
                    config.benign_shared_device_rate,
                    config.benign_shared_account_rate,
                    config.as_of.isoformat(),
                    generated_at,
                ),
            )
            records = (
                (
                    dataset.dataset_id,
                    table_name,
                    row_index,
                    json.dumps(row, separators=(",", ":"), sort_keys=True),
                )
                for table_name, rows in dataset.tables.items()
                for row_index, row in enumerate(rows)
            )
            connection.executemany("INSERT INTO dataset_records VALUES (?, ?, ?, ?)", records)

    def load_active_dataset(self) -> tuple[SyntheticDataset, str] | None:
        with self._connect() as connection:
            metadata = connection.execute("SELECT * FROM datasets WHERE is_active = 1").fetchone()
            if metadata is None:
                return None
            records = connection.execute(
                """
                SELECT table_name, payload_json
                FROM dataset_records
                WHERE dataset_id = ?
                ORDER BY table_name, row_index
                """,
                (metadata["dataset_id"],),
            ).fetchall()
        tables: dict[str, list[dict[str, Any]]] = {}
        for record in records:
            tables.setdefault(str(record["table_name"]), []).append(
                json.loads(record["payload_json"])
            )
        config = GenerationConfig(
            seed=int(metadata["seed"]),
            normal_application_count=int(metadata["normal_application_count"]),
            suspicious_ecosystem_count=int(metadata["suspicious_ecosystem_count"]),
            min_ecosystem_size=int(metadata["min_ecosystem_size"]),
            max_ecosystem_size=int(metadata["max_ecosystem_size"]),
            normal_dealer_count=int(metadata["normal_dealer_count"]),
            suspicious_dealer_count=int(metadata["suspicious_dealer_count"]),
            benign_shared_device_rate=float(metadata["benign_shared_device_rate"]),
            benign_shared_account_rate=float(metadata["benign_shared_account_rate"]),
            as_of=datetime.fromisoformat(str(metadata["as_of"])),
        )
        return SyntheticDataset(config=config, tables=tables), str(metadata["generated_at"])

    def save_analysis(self, dataset_id: str, analysis: StoredAnalysis) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO analyses VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(dataset_id, application_id) DO UPDATE SET
                    analysis_id = excluded.analysis_id,
                    assessment_json = excluded.assessment_json,
                    analysed_at = excluded.analysed_at
                """,
                (
                    dataset_id,
                    analysis.application_id,
                    analysis.analysis_id,
                    json.dumps(analysis.assessment, separators=(",", ":"), sort_keys=True),
                    analysis.analysed_at,
                ),
            )

    def get_analysis(self, dataset_id: str, application_id: str) -> StoredAnalysis | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT analysis_id, application_id, assessment_json, analysed_at
                FROM analyses WHERE dataset_id = ? AND application_id = ?
                """,
                (dataset_id, application_id),
            ).fetchone()
        if row is None:
            return None
        return StoredAnalysis(
            analysis_id=str(row["analysis_id"]),
            application_id=str(row["application_id"]),
            assessment=json.loads(row["assessment_json"]),
            analysed_at=str(row["analysed_at"]),
        )

    def list_analyses(self, dataset_id: str) -> tuple[StoredAnalysis, ...]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT analysis_id, application_id, assessment_json, analysed_at
                FROM analyses WHERE dataset_id = ? ORDER BY application_id
                """,
                (dataset_id,),
            ).fetchall()
        return tuple(
            StoredAnalysis(
                analysis_id=str(row["analysis_id"]),
                application_id=str(row["application_id"]),
                assessment=json.loads(row["assessment_json"]),
                analysed_at=str(row["analysed_at"]),
            )
            for row in rows
        )
