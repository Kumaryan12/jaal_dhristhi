"""ASGI contract and workflow tests for the Phase 7 API."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

import httpx
import joblib
import numpy as np
from app.core import APISettings
from app.main import create_app
from app.services.ml import MLFeatureMatrixBuilder, VersionedPredictor
from app.services.ml.config import ML_FEATURE_SCHEMA_VERSION


class ConstantProbabilityEstimator:
    def __init__(self, probability: float) -> None:
        self.probability = probability

    def predict_proba(self, values: np.ndarray) -> np.ndarray:
        positive = np.full(len(values), self.probability, dtype=np.float64)
        return np.column_stack((1.0 - positive, positive))


class APIContractTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.database_path = Path(self.temporary_directory.name) / "api.db"
        self.settings = APISettings(
            database_path=self.database_path,
            model_path=Path(self.temporary_directory.name) / "missing-model.joblib",
        )
        self.app = create_app(self.settings)
        self.client = httpx.AsyncClient(
            transport=httpx.ASGITransport(app=self.app), base_url="http://testserver"
        )

    async def asyncTearDown(self) -> None:
        await self.client.aclose()
        self.temporary_directory.cleanup()

    async def _generate(self, **overrides: object) -> dict[str, object]:
        payload: dict[str, object] = {
            "seed": 42,
            "normal_application_count": 30,
            "suspicious_ecosystem_count": 6,
        }
        payload.update(overrides)
        response = await self.client.post("/api/v1/generate_demo_data", json=payload)
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    async def test_health_and_openapi_publish_required_contract(self) -> None:
        health = await self.client.get("/health")
        self.assertEqual(health.status_code, 200)
        self.assertFalse(health.json()["dataset_ready"])
        self.assertTrue(health.headers["x-request-id"].startswith("req_"))

        openapi = (await self.client.get("/openapi.json")).json()
        expected = {
            "/health",
            "/api/v1/generate_demo_data",
            "/api/v1/analyse",
            "/api/v1/risk_score/{application_id}",
            "/api/v1/network/{customer_id}",
            "/api/v1/explanation/{application_id}",
            "/api/v1/dashboard/summary",
            "/api/v1/monitor/activity",
            "/api/v1/analytics",
            "/api/v1/demo/simulate",
        }
        self.assertTrue(expected.issubset(openapi["paths"]))
        analyse_responses = openapi["paths"]["/api/v1/analyse"]["post"]["responses"]
        self.assertIn("409", analyse_responses)
        self.assertIn("422", analyse_responses)

    async def test_generation_enforces_conflict_and_validation_envelopes(self) -> None:
        generated = await self._generate()
        self.assertEqual(
            generated["counts"]["applications"], generated["counts"]["customers"]
        )
        self.assertEqual(generated["counts"]["suspicious_ecosystems"], 6)

        conflict = await self.client.post(
            "/api/v1/generate_demo_data",
            json={
                "seed": 42,
                "normal_application_count": 30,
                "suspicious_ecosystem_count": 6,
            },
        )
        self.assertEqual(conflict.status_code, 409)
        self.assertEqual(conflict.json()["error"]["code"], "DATASET_EXISTS")
        self.assertEqual(
            conflict.json()["error"]["request_id"], conflict.headers["x-request-id"]
        )

        invalid = await self.client.post(
            "/api/v1/generate_demo_data",
            json={"normal_application_count": 0, "unexpected": True},
        )
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"]["code"], "VALIDATION_ERROR")
        violations = invalid.json()["error"]["details"]["violations"]
        self.assertTrue(all("input" not in violation for violation in violations))

    async def test_analysis_cache_refresh_risk_and_explanation_flow(self) -> None:
        await self._generate()
        application_id = "APP-S-000031"
        before = await self.client.get(f"/api/v1/risk_score/{application_id}")
        self.assertEqual(before.status_code, 409)
        self.assertEqual(before.json()["error"]["code"], "ANALYSIS_REQUIRED")

        first = await self.client.post(
            "/api/v1/analyse", json={"application_id": application_id}
        )
        self.assertEqual(first.status_code, 200, first.text)
        body = first.json()
        self.assertGreaterEqual(body["risk_score"], 0)
        self.assertLessEqual(body["risk_score"], 100)
        self.assertIn(body["risk_level"], {"LOW", "MEDIUM", "HIGH"})
        self.assertTrue(body["signals"])
        self.assertIn("risk_policy", body["versions"])

        cached = await self.client.post(
            "/api/v1/analyse", json={"application_id": application_id}
        )
        self.assertEqual(cached.json()["analysis_id"], body["analysis_id"])
        refreshed = await self.client.post(
            "/api/v1/analyse",
            json={"application_id": application_id, "force_refresh": True},
        )
        self.assertNotEqual(refreshed.json()["analysis_id"], body["analysis_id"])

        risk = await self.client.get(f"/api/v1/risk_score/{application_id}")
        self.assertEqual(risk.json()["analysis_id"], refreshed.json()["analysis_id"])
        explanation = await self.client.get(f"/api/v1/explanation/{application_id}")
        self.assertEqual(explanation.status_code, 200, explanation.text)
        self.assertEqual(
            explanation.json()["borrower"]["application_id"], application_id
        )
        self.assertEqual(
            explanation.json()["recommended_action"], risk.json()["recommended_action"]
        )

    async def test_missing_state_and_entities_use_stable_errors(self) -> None:
        missing_state = await self.client.post(
            "/api/v1/analyse", json={"application_id": "APP-N-000001"}
        )
        self.assertEqual(missing_state.status_code, 409)
        self.assertEqual(missing_state.json()["error"]["code"], "DATASET_REQUIRED")
        await self._generate()
        missing_application = await self.client.post(
            "/api/v1/analyse", json={"application_id": "APP-UNKNOWN"}
        )
        self.assertEqual(missing_application.status_code, 404)
        self.assertEqual(
            missing_application.json()["error"]["code"], "APPLICATION_NOT_FOUND"
        )
        missing_customer = await self.client.get("/api/v1/network/CUS-UNKNOWN")
        self.assertEqual(missing_customer.status_code, 404)
        self.assertEqual(missing_customer.json()["error"]["code"], "CUSTOMER_NOT_FOUND")

    async def test_network_is_bounded_and_validates_query_limits(self) -> None:
        await self._generate()
        response = await self.client.get(
            "/api/v1/network/CUS-S-000031", params={"depth": 2, "max_nodes": 25}
        )
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertLessEqual(body["summary"]["node_count"], 25)
        self.assertTrue(any(node["is_focus"] for node in body["nodes"]))
        node_ids = {node["id"] for node in body["nodes"]}
        self.assertTrue(
            all(
                edge["source"] in node_ids and edge["target"] in node_ids
                for edge in body["edges"]
            )
        )

        invalid = await self.client.get(
            "/api/v1/network/CUS-S-000031", params={"depth": 4, "max_nodes": 10}
        )
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"]["code"], "VALIDATION_ERROR")
        naive = await self.client.get(
            "/api/v1/network/CUS-S-000031",
            params={"as_of": "2026-08-01T12:00:00"},
        )
        self.assertEqual(naive.status_code, 400)
        self.assertEqual(naive.json()["error"]["code"], "INVALID_AS_OF")

    async def test_dashboard_and_analytics_are_computed_from_current_data(self) -> None:
        generated = await self._generate()
        dashboard = await self.client.get("/api/v1/dashboard/summary")
        self.assertEqual(dashboard.status_code, 200, dashboard.text)
        summary = dashboard.json()
        self.assertEqual(
            summary["total_applications"], generated["counts"]["applications"]
        )
        self.assertEqual(summary["analysed_applications"], 0)
        self.assertGreater(summary["detected_networks"], 0)
        self.assertGreater(summary["potential_exposure"], 0)

        analytics = await self.client.get("/api/v1/analytics")
        self.assertEqual(analytics.status_code, 200, analytics.text)
        body = analytics.json()
        self.assertEqual(
            sum(item["count"] for item in body["risk_distribution"]),
            generated["counts"]["applications"],
        )
        self.assertLessEqual(len(body["top_dealer_clusters"]), 10)
        self.assertTrue(body["daily_activity"])
        reversed_range = await self.client.get(
            "/api/v1/analytics",
            params={"from": "2026-09-01", "to": "2026-08-01"},
        )
        self.assertEqual(reversed_range.status_code, 400)
        self.assertEqual(reversed_range.json()["error"]["code"], "INVALID_DATE_RANGE")

    async def test_live_monitor_returns_scored_backend_events(self) -> None:
        await self._generate()
        response = await self.client.get("/api/v1/monitor/activity", params={"limit": 8})
        self.assertEqual(response.status_code, 200, response.text)
        body = response.json()
        self.assertEqual(len(body["events"]), 8)
        self.assertTrue(body["focus_customer_id"])
        self.assertTrue(body["dataset_id"])
        self.assertTrue(all(item["application_id"] for item in body["events"]))
        self.assertTrue(all(item["device_id"] for item in body["events"]))
        self.assertTrue(all(0 <= item["risk_score"] <= 100 for item in body["events"]))
        self.assertTrue(
            all(
                item["status"]
                in {"Analysed", "Relationship Found", "Requires Review"}
                for item in body["events"]
            )
        )

        invalid = await self.client.get("/api/v1/monitor/activity", params={"limit": 2})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"]["code"], "VALIDATION_ERROR")

    async def test_dataset_and_analysis_survive_application_restart(self) -> None:
        await self._generate()
        analysed = await self.client.post(
            "/api/v1/analyse", json={"application_id": "APP-N-000001"}
        )
        restarted = create_app(self.settings)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=restarted), base_url="http://restart"
        ) as client:
            health = await client.get("/health")
            self.assertTrue(health.json()["dataset_ready"])
            restored = await client.get("/api/v1/risk_score/APP-N-000001")
            self.assertEqual(restored.status_code, 200, restored.text)
            self.assertEqual(
                restored.json()["analysis_id"], analysed.json()["analysis_id"]
            )

    async def test_emerging_risk_demo_is_computed_and_repeatably_isolated(self) -> None:
        first = await self.client.post("/api/v1/demo/simulate", json={"seed": 2026})
        self.assertEqual(first.status_code, 201, first.text)
        body = first.json()
        self.assertEqual(body["customer_label"], "Customer A")
        self.assertEqual(body["before"]["risk_level"], "LOW")
        self.assertEqual(body["after"]["risk_level"], "HIGH")
        self.assertGreater(body["after"]["risk_score"], body["before"]["risk_score"])
        self.assertEqual(body["after"]["linked_applicant_count"], 5)
        self.assertEqual(body["after"]["shared_device_applicant_count"], 6)
        self.assertEqual(body["after"]["dealer_applications_2h"], 6)
        self.assertEqual(body["network"]["summary"]["applicant_count"], 6)
        self.assertEqual(len(body["created_entities"]), 5)
        self.assertEqual(len(body["created_edges"]), 10)
        codes = {item["code"] for item in body["explanations"]}
        self.assertTrue(
            {
                "SHARED_DEVICE_MANY_APPLICANTS",
                "RAPID_DEALER_APPLICATION_BURST",
                "RAPID_DEVICE_APPLICATION_BURST",
            }.issubset(codes)
        )
        self.assertEqual(
            body["recommended_action"]["code"], "ENHANCED_VERIFICATION"
        )

        repeated = await self.client.post("/api/v1/demo/simulate", json={"seed": 2026})
        repeated_body = repeated.json()
        self.assertNotEqual(repeated_body["scenario_id"], body["scenario_id"])
        self.assertEqual(repeated_body["before"], body["before"])
        self.assertEqual(repeated_body["after"], body["after"])
        self.assertEqual(repeated_body["network"], body["network"])

        invalid = await self.client.post("/api/v1/demo/simulate", json={"seed": -1})
        self.assertEqual(invalid.status_code, 422)
        self.assertEqual(invalid.json()["error"]["code"], "VALIDATION_ERROR")

    async def test_emerging_risk_demo_does_not_replace_active_dataset(self) -> None:
        generated = await self._generate()
        before = (await self.client.get("/api/v1/dashboard/summary")).json()
        simulated = await self.client.post("/api/v1/demo/simulate", json={"seed": 17})
        self.assertEqual(simulated.status_code, 201, simulated.text)
        after = (await self.client.get("/api/v1/dashboard/summary")).json()
        self.assertEqual(after["total_applications"], generated["counts"]["applications"])
        self.assertEqual(after["total_applications"], before["total_applications"])
        self.assertEqual(after["detected_networks"], before["detected_networks"])
        self.assertEqual(after["potential_exposure"], before["potential_exposure"])

    async def test_versioned_model_probability_reaches_http_response(self) -> None:
        model_path = Path(self.temporary_directory.name) / "test-model.joblib"
        joblib.dump(
            VersionedPredictor(
                name="test_supervised",
                model_version="test-supervised:1.0.0",
                feature_schema_version=ML_FEATURE_SCHEMA_VERSION,
                feature_names=MLFeatureMatrixBuilder().feature_names,
                threshold=0.5,
                estimator=ConstantProbabilityEstimator(0.8),
            ),
            model_path,
        )
        model_app = create_app(
            APISettings(
                database_path=Path(self.temporary_directory.name) / "model-api.db",
                model_path=model_path,
            )
        )
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=model_app), base_url="http://model"
        ) as client:
            generated = await client.post(
                "/api/v1/generate_demo_data",
                json={
                    "seed": 17,
                    "normal_application_count": 20,
                    "suspicious_ecosystem_count": 4,
                },
            )
            self.assertEqual(generated.status_code, 201, generated.text)
            analysed = await client.post(
                "/api/v1/analyse", json={"application_id": "APP-N-000001"}
            )
            self.assertEqual(analysed.status_code, 200, analysed.text)
            self.assertEqual(analysed.json()["score_components"]["ml_score"], 80.0)
            self.assertEqual(
                analysed.json()["versions"]["model"], "test-supervised:1.0.0"
            )


if __name__ == "__main__":
    unittest.main()
