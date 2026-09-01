"""Environment-backed API settings with safe local defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _default_database_path() -> Path:
    return Path(os.environ.get("JAALDRISHTI_DB_PATH", "data/jaaldrishti.db"))


@dataclass(frozen=True, slots=True)
class APISettings:
    database_path: Path = field(default_factory=_default_database_path)
    model_path: Path = Path("models/ecosystem-risk-model.joblib")
    api_title: str = "TVS JaalDrishti API"
    api_version: str = "0.7.0"
    cors_origins: tuple[str, ...] = (
        "http://localhost:3000",
        "http://localhost:5173",
    )
