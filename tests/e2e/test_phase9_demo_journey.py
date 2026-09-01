"""Cross-layer Phase 9 journey through the complete ASGI boundary."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import httpx
from app.core import APISettings
from app.main import create_app


class Phase9DemoJourneyTests(unittest.IsolatedAsyncioTestCase):
    async def test_one_click_journey_escalates_without_changing_portfolio(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            app = create_app(
                APISettings(
                    database_path=Path(temporary) / "journey.db",
                    model_path=Path(temporary) / "missing-model.joblib",
                )
            )
            async with httpx.AsyncClient(
                transport=httpx.ASGITransport(app=app),
                base_url="http://journey",
            ) as client:
                generated = await client.post(
                    "/api/v1/generate_demo_data",
                    json={
                        "seed": 42,
                        "normal_application_count": 30,
                        "suspicious_ecosystem_count": 6,
                    },
                )
                self.assertEqual(generated.status_code, 201, generated.text)
                portfolio_before = (await client.get("/api/v1/dashboard/summary")).json()

                response = await client.post("/api/v1/demo/simulate", json={"seed": 2026})
                self.assertEqual(response.status_code, 201, response.text)
                journey = response.json()
                self.assertEqual(journey["before"]["risk_level"], "LOW")
                self.assertEqual(journey["after"]["risk_level"], "HIGH")
                self.assertEqual(journey["network"]["summary"]["applicant_count"], 6)
                self.assertTrue(journey["explanations"])
                self.assertTrue(journey["recommended_action"]["human_review_required"])

                portfolio_after = (await client.get("/api/v1/dashboard/summary")).json()
                for field in (
                    "total_applications",
                    "analysed_applications",
                    "detected_networks",
                    "high_risk_ecosystems",
                    "potential_exposure",
                ):
                    self.assertEqual(portfolio_after[field], portfolio_before[field])


if __name__ == "__main__":
    unittest.main()
