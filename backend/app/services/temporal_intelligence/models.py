"""Typed output models for temporal application features."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

TEMPORAL_FEATURE_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True, slots=True)
class TemporalFeatureVector:
    application_id: str
    customer_id: str
    as_of: str
    applications_same_device_2h: int
    applications_same_dealer_2h: int
    applications_same_account_24h: int
    customer_applications_30d: int
    application_velocity_2h: int
    linked_applicants_24h: int
    network_prior_applicants_30d: int
    network_growth_rate_24h: float
    hours_since_latest_link: float | None
    recency_score: float
    rapid_burst_detected: bool
    burst_signal_types: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class TemporalIntelligenceSummary:
    application_count: int
    rapid_burst_application_count: int
    rapid_burst_rate: float
    peak_application_velocity_2h: int
    peak_dealer_applications_2h: int
    peak_device_applications_2h: int
    peak_account_applications_24h: int
    average_network_growth_rate_24h: float
    average_recency_score: float


@dataclass(frozen=True, slots=True)
class TemporalIntelligenceResult:
    summary: TemporalIntelligenceSummary
    features: tuple[TemporalFeatureVector, ...]

    def feature_for(self, application_id: str) -> TemporalFeatureVector:
        try:
            return next(
                feature for feature in self.features if feature.application_id == application_id
            )
        except StopIteration as error:
            raise KeyError(
                f"no temporal features exist for application: {application_id}"
            ) from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "feature_schema_version": TEMPORAL_FEATURE_SCHEMA_VERSION,
            "summary": asdict(self.summary),
            "features": [asdict(feature) for feature in self.features],
        }

    def export_artifacts(
        self, output_dir: Path, *, replace_existing: bool = False
    ) -> dict[str, Path]:
        """Atomically export temporal feature CSV and versioned summary."""

        output_dir = output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        feature_path = output_dir / "temporal-features.csv"
        summary_path = output_dir / "temporal-intelligence-summary.json"
        existing = [path for path in (feature_path, summary_path) if path.exists()]
        if existing and not replace_existing:
            names = ", ".join(path.name for path in existing)
            raise FileExistsError(f"temporal intelligence artifacts already exist ({names})")
        if not self.features:
            raise ValueError("cannot export an empty temporal feature set")

        rows = []
        for feature in self.features:
            row = asdict(feature)
            row["burst_signal_types"] = "|".join(feature.burst_signal_types)
            rows.append(row)
        self._write_csv_atomic(feature_path, rows)
        self._write_json_atomic(
            summary_path,
            {
                "feature_schema_version": TEMPORAL_FEATURE_SCHEMA_VERSION,
                "feature_row_count": len(rows),
                "feature_sha256": self._sha256(feature_path),
                "summary": asdict(self.summary),
            },
        )
        return {"features": feature_path, "summary": summary_path}

    @staticmethod
    def _write_csv_atomic(target: Path, rows: list[dict[str, Any]]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", newline="", dir=target.parent, delete=False
        ) as handle:
            writer = csv.DictWriter(handle, fieldnames=list(rows[0]), extrasaction="raise")
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
