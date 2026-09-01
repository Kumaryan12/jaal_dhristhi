"""Typed graph intelligence feature and summary models."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import tempfile
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

FEATURE_SCHEMA_VERSION = "1.0.0"


@dataclass(frozen=True, slots=True)
class GraphFeatureVector:
    customer_id: str
    degree_centrality: float
    connected_applicant_count: int
    heterogeneous_degree: int
    cluster_id: str
    cluster_size: int
    network_density: float
    community_id: str
    community_size: int
    shared_identity_signal_count: int
    shared_device_count: int
    shared_account_count: int
    same_dealer_count: int
    same_location_count: int
    shared_device_applicant_count_max: int
    shared_account_applicant_count_max: int
    max_connection_strength: float
    mean_connection_strength: float


@dataclass(frozen=True, slots=True)
class GraphIntelligenceSummary:
    heterogeneous_node_count: int
    heterogeneous_edge_count: int
    customer_node_count: int
    customer_edge_count: int
    connected_component_count: int
    largest_component_size: int
    overall_customer_graph_density: float
    community_count: int
    largest_community_size: int
    average_connected_applicants: float


@dataclass(frozen=True, slots=True)
class GraphIntelligenceResult:
    summary: GraphIntelligenceSummary
    features: tuple[GraphFeatureVector, ...]

    def feature_for(self, customer_id: str) -> GraphFeatureVector:
        try:
            return next(feature for feature in self.features if feature.customer_id == customer_id)
        except StopIteration as error:
            raise KeyError(f"no graph features exist for customer: {customer_id}") from error

    def to_dict(self) -> dict[str, Any]:
        return {
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "summary": asdict(self.summary),
            "features": [asdict(feature) for feature in self.features],
        }

    def export_artifacts(
        self, output_dir: Path, *, replace_existing: bool = False
    ) -> dict[str, Path]:
        """Atomically export feature CSV and a compact versioned summary."""

        output_dir = output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        feature_path = output_dir / "graph-features.csv"
        summary_path = output_dir / "graph-intelligence-summary.json"
        existing = [path for path in (feature_path, summary_path) if path.exists()]
        if existing and not replace_existing:
            names = ", ".join(path.name for path in existing)
            raise FileExistsError(f"graph intelligence artifacts already exist ({names})")

        rows = [asdict(feature) for feature in self.features]
        if not rows:
            raise ValueError("cannot export an empty graph feature set")
        self._write_csv_atomic(feature_path, rows)
        summary_payload = {
            "feature_schema_version": FEATURE_SCHEMA_VERSION,
            "feature_row_count": len(rows),
            "feature_sha256": self._sha256(feature_path),
            "summary": asdict(self.summary),
        }
        self._write_json_atomic(summary_path, summary_payload)
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
