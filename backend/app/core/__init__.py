"""Cross-cutting API configuration and error behavior."""

from .config import APISettings
from .errors import APIError

__all__ = ["APIError", "APISettings"]
