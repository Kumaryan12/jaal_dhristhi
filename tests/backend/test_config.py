"""Environment-specific API configuration tests."""

from __future__ import annotations

import os
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core import APISettings


class APISettingsTests(unittest.TestCase):
    def test_vercel_uses_writable_temporary_database_by_default(self) -> None:
        with patch.dict(os.environ, {"VERCEL": "1"}, clear=True):
            self.assertEqual(APISettings().database_path, Path("/tmp/jaaldrishti.db"))

    def test_explicit_database_path_takes_precedence_on_vercel(self) -> None:
        with patch.dict(
            os.environ,
            {"VERCEL": "1", "JAALDRISHTI_DB_PATH": "/tmp/custom-jaal.db"},
            clear=True,
        ):
            self.assertEqual(APISettings().database_path, Path("/tmp/custom-jaal.db"))


if __name__ == "__main__":
    unittest.main()
