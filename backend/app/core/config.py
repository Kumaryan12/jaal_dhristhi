"""Environment-backed API settings with safe local defaults."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


def _default_database_path() -> Path:
    configured = os.environ.get("JAALDRISHTI_DB_PATH")
    if configured:
        return Path(configured)
    if os.environ.get("VERCEL"):
        return Path("/tmp/jaaldrishti.db")
    return Path("data/jaaldrishti.db")


def _default_model_path() -> Path:
    return Path(os.environ.get("JAALDRISHTI_MODEL_PATH", "models/ecosystem-risk-model.joblib"))


def _default_cors_origins() -> tuple[str, ...]:
    configured = os.environ.get("JAALDRISHTI_CORS_ORIGINS")
    if configured:
        return tuple(origin.strip() for origin in configured.split(",") if origin.strip())
    return ("http://localhost:3000", "http://localhost:5173")


@dataclass(frozen=True, slots=True)
class APISettings:
    database_path: Path = field(default_factory=_default_database_path)
    model_path: Path = field(default_factory=_default_model_path)
    api_title: str = "TVS JaalDrishti API"
    api_version: str = "0.9.0"
    cors_origins: tuple[str, ...] = field(default_factory=_default_cors_origins)
