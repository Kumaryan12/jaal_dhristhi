"""Atomic persistence for the selected predictor and reproducible benchmark metadata."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from pathlib import Path
from typing import Any

import joblib

from .models import MLTrainingResult, VersionedPredictor


class MLArtifactStore:
    MODEL_FILENAME = "ecosystem-risk-model.joblib"
    SUMMARY_FILENAME = "ml-training-summary.json"

    def save(
        self,
        result: MLTrainingResult,
        output_dir: Path,
        *,
        dataset_id: str,
        dataset_rows: int,
        hybrid_risk_summary: dict[str, Any],
        replace_existing: bool = False,
    ) -> dict[str, Path]:
        output_dir = output_dir.resolve()
        output_dir.mkdir(parents=True, exist_ok=True)
        model_path = output_dir / self.MODEL_FILENAME
        summary_path = output_dir / self.SUMMARY_FILENAME
        existing = [path for path in (model_path, summary_path) if path.exists()]
        if existing and not replace_existing:
            names = ", ".join(path.name for path in existing)
            raise FileExistsError(f"ML artifacts already exist ({names})")

        self._dump_model_atomic(model_path, result.predictor)
        summary = result.summary_dict()
        summary.update(
            {
                "dataset_id": dataset_id,
                "dataset_rows": dataset_rows,
                "model_artifact": model_path.name,
                "model_sha256": self._sha256(model_path),
                "hybrid_risk_summary": hybrid_risk_summary,
                "evaluation_scope": "deterministic synthetic benchmark; not production validation",
            }
        )
        self._write_json_atomic(summary_path, summary)
        return {"model": model_path, "summary": summary_path}

    @staticmethod
    def load(model_path: Path) -> VersionedPredictor:
        """Load a trusted local artifact and validate its adapter type."""

        predictor = joblib.load(model_path)
        if not isinstance(predictor, VersionedPredictor):
            raise TypeError("artifact is not a JaalDrishti VersionedPredictor")
        return predictor

    @staticmethod
    def _dump_model_atomic(target: Path, predictor: VersionedPredictor) -> None:
        with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as handle:
            temporary_name = handle.name
        try:
            joblib.dump(predictor, temporary_name)
            os.replace(temporary_name, target)
        finally:
            if os.path.exists(temporary_name):
                os.unlink(temporary_name)

    @staticmethod
    def _write_json_atomic(target: Path, payload: dict[str, Any]) -> None:
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=target.parent, delete=False
        ) as handle:
            temporary_name = handle.name
            try:
                json.dump(payload, handle, indent=2, sort_keys=True)
                handle.write("\n")
            except Exception:
                os.unlink(temporary_name)
                raise
        os.replace(temporary_name, target)

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(64 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
