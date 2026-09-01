"""Dataset container and safe CSV export."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import GenerationConfig

GENERATOR_VERSION = "1.0.0"


@dataclass(slots=True)
class SyntheticDataset:
    """All normalized tables and metadata produced by one generation run."""

    config: GenerationConfig
    tables: dict[str, list[dict[str, Any]]]

    @property
    def dataset_id(self) -> str:
        return f"jaaldrishti-seed-{self.config.seed}"

    def row_counts(self) -> dict[str, int]:
        return {name: len(rows) for name, rows in self.tables.items()}

    def manifest(self, checksums: dict[str, str] | None = None) -> dict[str, Any]:
        ground_truth = self.tables["ground_truth"]
        suspicious_rows = [row for row in ground_truth if row["is_suspicious"]]
        pattern_counts: dict[str, int] = {}
        for row in self.tables["ecosystems"]:
            pattern = str(row["pattern_type"])
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1

        return {
            "dataset_id": self.dataset_id,
            "generator_version": GENERATOR_VERSION,
            "seed": self.config.seed,
            "as_of": self.config.as_of.isoformat().replace("+00:00", "Z"),
            "requested": {
                "normal_applications": self.config.normal_application_count,
                "suspicious_ecosystems": self.config.suspicious_ecosystem_count,
            },
            "actual": {
                "normal_applications": len(ground_truth) - len(suspicious_rows),
                "suspicious_applications": len(suspicious_rows),
                "suspicious_ecosystems": len(self.tables["ecosystems"]),
            },
            "ecosystem_pattern_counts": pattern_counts,
            "table_row_counts": self.row_counts(),
            "sha256": checksums or {},
        }

    def export_csv(self, output_dir: Path, *, replace_existing: bool = False) -> Path:
        """Write each table and a manifest, refusing accidental overwrite by default."""

        output_dir = output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        target_files = [output_dir / f"{name}.csv" for name in self.tables]
        target_files.append(output_dir / "manifest.json")
        existing = [path for path in target_files if path.exists()]
        if existing and not replace_existing:
            names = ", ".join(path.name for path in existing[:3])
            raise FileExistsError(
                f"dataset files already exist ({names}); pass replace_existing=True"
            )

        checksums: dict[str, str] = {}
        for table_name, rows in self.tables.items():
            target = output_dir / f"{table_name}.csv"
            self._write_csv_atomic(target, rows)
            checksums[target.name] = self._sha256(target)

        manifest_path = output_dir / "manifest.json"
        self._write_json_atomic(manifest_path, self.manifest(checksums))
        return manifest_path

    @staticmethod
    def _write_csv_atomic(target: Path, rows: list[dict[str, Any]]) -> None:
        if not rows:
            raise ValueError(f"cannot export empty table: {target.stem}")
        fieldnames = list(rows[0].keys())
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="", dir=target.parent, delete=False
        ) as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="raise")
            writer.writeheader()
            writer.writerows(rows)
            temporary_name = handle.name
        os.replace(temporary_name, target)

    @staticmethod
    def _write_json_atomic(target: Path, payload: dict[str, Any]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=target.parent, delete=False
        ) as handle:
            json.dump(payload, handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_name = handle.name
        os.replace(temporary_name, target)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(64 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
