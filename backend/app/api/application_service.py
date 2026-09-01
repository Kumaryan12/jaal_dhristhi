"""Application orchestration over generation, graph, temporal, ML, and risk services."""

from __future__ import annotations

import uuid
from collections import Counter, defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from threading import RLock
from typing import Any

from app.core import APIError
from app.repositories import SQLiteDemoStore, StoredAnalysis
from app.services.demo_simulation import EmergingRiskSimulationService
from app.services.entity_resolution import EntityResolutionEngine, RelationshipGraph
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.graph_intelligence.models import GraphIntelligenceResult
from app.services.ml import MLArtifactStore, MLFeatureDataset, MLFeatureMatrixBuilder
from app.services.ml.models import VersionedPredictor
from app.services.risk_intelligence import RiskAssessment, RiskIntelligenceEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator, validate_dataset
from app.services.synthetic_data.dataset import GENERATOR_VERSION, SyntheticDataset
from app.services.temporal_intelligence import TemporalIntelligenceEngine
from app.services.temporal_intelligence.models import TemporalIntelligenceResult


@dataclass(slots=True)
class IntelligenceSnapshot:
    dataset: SyntheticDataset
    generated_at: str
    relationships: RelationshipGraph
    graph: GraphIntelligenceResult
    temporal: TemporalIntelligenceResult
    ml_features: MLFeatureDataset | None
    predictor: VersionedPredictor | None
    probabilities: dict[str, float] | None = None
    assessments: dict[str, RiskAssessment] | None = None


class APIApplicationService:
    """Own state transitions while domain services remain HTTP-agnostic."""

    def __init__(self, store: SQLiteDemoStore, model_path: Path | None = None) -> None:
        self.store = store
        self.model_path = model_path
        self._snapshot: IntelligenceSnapshot | None = None
        self._lock = RLock()

    def generate_demo_data(
        self,
        *,
        seed: int,
        normal_application_count: int,
        suspicious_ecosystem_count: int,
        replace_existing: bool,
    ) -> dict[str, Any]:
        generated_at = self._now()
        dataset = SyntheticDataGenerator(
            GenerationConfig(
                seed=seed,
                normal_application_count=normal_application_count,
                suspicious_ecosystem_count=suspicious_ecosystem_count,
            )
        ).generate()
        validate_dataset(dataset)
        try:
            self.store.save_dataset(
                dataset,
                generated_at=generated_at,
                replace_existing=replace_existing,
            )
        except FileExistsError as error:
            raise APIError(
                409,
                "DATASET_EXISTS",
                "An active demo dataset already exists; set replace_existing to replace it.",
            ) from error
        with self._lock:
            self._snapshot = self._compile_snapshot(dataset, generated_at)
        return {
            "dataset_id": dataset.dataset_id,
            "seed": seed,
            "counts": {
                "customers": len(dataset.tables["customers"]),
                "applications": len(dataset.tables["applications"]),
                "suspicious_ecosystems": len(dataset.tables["ecosystems"]),
            },
            "generated_at": generated_at,
            "generator_version": GENERATOR_VERSION,
        }

    def simulate_emerging_risk(self, seed: int) -> dict[str, Any]:
        """Run an isolated scenario without reading or mutating the active dataset."""

        return EmergingRiskSimulationService().simulate(seed)

    def analyse(self, application_id: str, *, force_refresh: bool) -> StoredAnalysis:
        snapshot = self._require_snapshot()
        self._application(snapshot, application_id)
        if not force_refresh:
            cached = self.store.get_analysis(snapshot.dataset.dataset_id, application_id)
            if cached is not None:
                return cached
        assessment = self._score_application(snapshot, application_id)
        stored = StoredAnalysis(
            analysis_id=f"analysis_{uuid.uuid4().hex}",
            application_id=application_id,
            assessment=assessment.to_dict(),
            analysed_at=assessment.analysed_at,
        )
        self.store.save_analysis(snapshot.dataset.dataset_id, stored)
        return stored

    def risk_score(self, application_id: str) -> StoredAnalysis:
        snapshot = self._require_snapshot()
        self._application(snapshot, application_id)
        cached = self.store.get_analysis(snapshot.dataset.dataset_id, application_id)
        if cached is None:
            raise APIError(
                409,
                "ANALYSIS_REQUIRED",
                "The application exists but has not been analysed.",
            )
        return cached

    def analysis_payload(self, analysis: StoredAnalysis, request_id: str) -> dict[str, Any]:
        assessment = analysis.assessment
        versions = assessment["versions"]
        return {
            "analysis_id": analysis.analysis_id,
            "application_id": assessment["application_id"],
            "customer_id": assessment["customer_id"],
            "risk_score": assessment["risk_score"],
            "risk_level": assessment["risk_level"],
            "signals": assessment["signals"],
            "recommended_action": assessment["recommended_action"],
            "score_components": assessment["score_components"],
            "versions": self._public_versions(versions),
            "analysed_at": analysis.analysed_at,
            "request_id": request_id,
        }

    def explanation(self, application_id: str, request_id: str) -> dict[str, Any]:
        snapshot = self._require_snapshot()
        stored = self.risk_score(application_id)
        assessment = stored.assessment
        application = self._application(snapshot, application_id)
        customer = self._customer(snapshot, str(application["customer_id"]))
        graph = snapshot.graph.feature_for(str(application["customer_id"]))
        temporal = snapshot.temporal.feature_for(application_id)
        return {
            "application_id": application_id,
            "customer_id": str(application["customer_id"]),
            "risk_score": assessment["risk_score"],
            "risk_level": assessment["risk_level"],
            "borrower": {
                "application_id": application_id,
                "customer_id": str(application["customer_id"]),
                "age": int(customer["age"]),
                "annual_income_inr": int(customer["annual_income_inr"]),
                "credit_score": int(customer["credit_score"]),
                "location_id": str(customer["location_id"]),
                "loan_amount_inr": int(application["loan_amount_inr"]),
                "loan_type": str(application["loan_type"]),
                "dealer_id": str(application["dealer_id"]),
            },
            "signals": assessment["signals"],
            "graph_evidence": {
                "connected_applicant_count": graph.connected_applicant_count,
                "cluster_size": graph.cluster_size,
                "network_density": graph.network_density,
                "community_id": graph.community_id,
                "shared_identity_signal_count": graph.shared_identity_signal_count,
                "max_connection_strength": graph.max_connection_strength,
            },
            "temporal_evidence": {
                "as_of": temporal.as_of,
                "application_velocity_2h": temporal.application_velocity_2h,
                "linked_applicants_24h": temporal.linked_applicants_24h,
                "network_growth_rate_24h": temporal.network_growth_rate_24h,
                "recency_score": temporal.recency_score,
                "rapid_burst_detected": temporal.rapid_burst_detected,
                "burst_signal_types": list(temporal.burst_signal_types),
            },
            "recommended_action": assessment["recommended_action"],
            "versions": self._public_versions(assessment["versions"]),
            "analysed_at": stored.analysed_at,
            "request_id": request_id,
        }

    def network(
        self,
        customer_id: str,
        *,
        depth: int,
        max_nodes: int,
        as_of: datetime | None,
        request_id: str,
    ) -> dict[str, Any]:
        snapshot = self._require_snapshot()
        self._customer(snapshot, customer_id)
        cutoff = as_of or snapshot.dataset.config.as_of
        if cutoff.tzinfo is None or cutoff.utcoffset() is None:
            raise APIError(400, "INVALID_AS_OF", "as_of must include a timezone offset.")
        eligible_edges = tuple(
            edge
            for edge in snapshot.relationships.direct_edges
            if self._parse_timestamp(edge.first_seen_at) <= cutoff
        )
        adjacency: dict[str, set[str]] = defaultdict(set)
        for edge in eligible_edges:
            adjacency[edge.customer_id].add(edge.entity_id)
            adjacency[edge.entity_id].add(edge.customer_id)

        selected = {customer_id}
        frontier = deque([(customer_id, 0)])
        truncated = False
        while frontier:
            node_id, level = frontier.popleft()
            if level >= depth:
                continue
            for neighbor in sorted(adjacency.get(node_id, ())):
                if neighbor in selected:
                    continue
                if len(selected) >= max_nodes:
                    truncated = True
                    continue
                selected.add(neighbor)
                frontier.append((neighbor, level + 1))

        node_catalog = {node.entity_id: node for node in snapshot.relationships.nodes}
        analysed_risk = {
            str(item.assessment["customer_id"]): str(item.assessment["risk_level"])
            for item in self.store.list_analyses(snapshot.dataset.dataset_id)
        }
        nodes = [
            {
                "id": node_id,
                "type": node_catalog[node_id].entity_type,
                "label": node_catalog[node_id].label,
                "risk_level": analysed_risk.get(node_id),
                "is_focus": node_id == customer_id,
            }
            for node_id in sorted(
                selected,
                key=lambda item: (item != customer_id, node_catalog[item].entity_type, item),
            )
        ]
        edges = [
            {
                "id": edge.edge_id,
                "source": edge.customer_id,
                "target": edge.entity_id,
                "type": edge.relationship_type,
                "strength": 1.0,
                "first_seen": edge.first_seen_at,
                "last_seen": edge.last_seen_at,
            }
            for edge in eligible_edges
            if edge.customer_id in selected and edge.entity_id in selected
        ]
        graph = snapshot.graph.feature_for(customer_id)
        return {
            "customer_id": customer_id,
            "as_of": cutoff.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            "summary": {
                "node_count": len(nodes),
                "edge_count": len(edges),
                "linked_applicant_count": graph.connected_applicant_count,
                "component_density": graph.network_density,
                "community_id": graph.community_id,
                "truncated": truncated,
            },
            "nodes": nodes,
            "edges": edges,
            "request_id": request_id,
        }

    def dashboard_summary(self, request_id: str, as_of: datetime | None = None) -> dict[str, Any]:
        snapshot = self._require_snapshot()
        assessments = self._all_assessments(snapshot)
        cutoff = as_of or snapshot.dataset.config.as_of
        if cutoff.tzinfo is None or cutoff.utcoffset() is None:
            raise APIError(400, "INVALID_AS_OF", "as_of must include a timezone offset.")
        applications = {
            str(row["application_id"]): row
            for row in snapshot.dataset.tables["applications"]
            if self._parse_timestamp(str(row["submitted_at"])) <= cutoff
        }
        high_clusters = {
            snapshot.graph.feature_for(item.customer_id).cluster_id
            for application_id, item in assessments.items()
            if application_id in applications and item.risk_level == "HIGH"
        }
        detected_networks = len(
            {feature.cluster_id for feature in snapshot.graph.features if feature.cluster_size > 1}
        )
        cached_count = len(self.store.list_analyses(snapshot.dataset.dataset_id))
        exposure = sum(
            int(applications[application_id]["loan_amount_inr"])
            for application_id, assessment in assessments.items()
            if assessment.risk_level in {"MEDIUM", "HIGH"}
        )
        return {
            "total_applications": len(applications),
            "analysed_applications": cached_count,
            "detected_networks": detected_networks,
            "high_risk_ecosystems": len(high_clusters),
            "potential_exposure": exposure,
            "currency": "INR",
            "data_timestamp": cutoff.astimezone(UTC).isoformat().replace("+00:00", "Z"),
            "request_id": request_id,
        }

    def analytics(
        self, from_date: date | None, to_date: date | None, request_id: str
    ) -> dict[str, Any]:
        snapshot = self._require_snapshot()
        rows = snapshot.dataset.tables["applications"]
        available_dates = [self._parse_timestamp(str(row["submitted_at"])).date() for row in rows]
        start = from_date or min(available_dates)
        end = to_date or max(available_dates)
        if start > end:
            raise APIError(400, "INVALID_DATE_RANGE", "from must not be after to.")
        if end - start > timedelta(days=366):
            raise APIError(400, "DATE_RANGE_TOO_LARGE", "Analytics is limited to 366 days.")

        assessments = self._all_assessments(snapshot)
        selected_rows = [
            row
            for row in rows
            if start <= self._parse_timestamp(str(row["submitted_at"])).date() <= end
        ]
        distribution = Counter(
            assessments[str(row["application_id"])].risk_level for row in selected_rows
        )
        dealer_stats: dict[str, dict[str, int]] = defaultdict(
            lambda: {"application_count": 0, "high_risk_count": 0, "total_exposure_inr": 0}
        )
        daily_stats: dict[date, dict[str, int]] = defaultdict(
            lambda: {"application_count": 0, "high_risk_count": 0}
        )
        for row in selected_rows:
            application_id = str(row["application_id"])
            assessment = assessments[application_id]
            dealer = dealer_stats[str(row["dealer_id"])]
            dealer["application_count"] += 1
            dealer["total_exposure_inr"] += int(row["loan_amount_inr"])
            submitted_date = self._parse_timestamp(str(row["submitted_at"])).date()
            daily_stats[submitted_date]["application_count"] += 1
            if assessment.risk_level == "HIGH":
                dealer["high_risk_count"] += 1
                daily_stats[submitted_date]["high_risk_count"] += 1

        top_dealers = [
            {"dealer_id": dealer_id, **values}
            for dealer_id, values in sorted(
                dealer_stats.items(),
                key=lambda item: (
                    -item[1]["high_risk_count"],
                    -item[1]["application_count"],
                    item[0],
                ),
            )[:10]
        ]
        return {
            "from_date": start.isoformat(),
            "to_date": end.isoformat(),
            "risk_distribution": [
                {"risk_level": level, "count": distribution[level]}
                for level in ("LOW", "MEDIUM", "HIGH")
            ],
            "top_dealer_clusters": top_dealers,
            "daily_activity": [
                {"date": day.isoformat(), **daily_stats[day]} for day in sorted(daily_stats)
            ],
            "request_id": request_id,
        }

    def _require_snapshot(self) -> IntelligenceSnapshot:
        with self._lock:
            if self._snapshot is not None:
                return self._snapshot
            stored = self.store.load_active_dataset()
            if stored is None:
                raise APIError(
                    409,
                    "DATASET_REQUIRED",
                    "Generate a demo dataset before requesting intelligence.",
                )
            dataset, generated_at = stored
            self._snapshot = self._compile_snapshot(dataset, generated_at)
            return self._snapshot

    def _compile_snapshot(
        self, dataset: SyntheticDataset, generated_at: str
    ) -> IntelligenceSnapshot:
        relationships = EntityResolutionEngine().resolve(dataset)
        graph = GraphIntelligenceEngine().analyze(relationships)
        temporal = TemporalIntelligenceEngine().analyze(dataset, relationships)
        predictor = self._load_predictor()
        ml_features = None
        if predictor is not None:
            candidate = MLFeatureMatrixBuilder().build(dataset, graph, temporal)
            if (
                candidate.feature_schema_version == predictor.feature_schema_version
                and candidate.feature_names == predictor.feature_names
            ):
                ml_features = candidate
            else:
                predictor = None
        return IntelligenceSnapshot(
            dataset=dataset,
            generated_at=generated_at,
            relationships=relationships,
            graph=graph,
            temporal=temporal,
            ml_features=ml_features,
            predictor=predictor,
        )

    def _load_predictor(self) -> VersionedPredictor | None:
        if self.model_path is None or not self.model_path.exists():
            return None
        try:
            return MLArtifactStore.load(self.model_path)
        except (ImportError, ModuleNotFoundError, OSError, TypeError, ValueError):
            return None

    def _probabilities(self, snapshot: IntelligenceSnapshot) -> dict[str, float] | None:
        if snapshot.predictor is None or snapshot.ml_features is None:
            return None
        if snapshot.probabilities is None:
            values = snapshot.predictor.predict_probabilities(snapshot.ml_features.values)
            snapshot.probabilities = dict(
                zip(snapshot.ml_features.application_ids, map(float, values), strict=True)
            )
        return snapshot.probabilities

    def _score_application(
        self, snapshot: IntelligenceSnapshot, application_id: str
    ) -> RiskAssessment:
        probabilities = self._probabilities(snapshot)
        probability = probabilities.get(application_id) if probabilities is not None else None
        return RiskIntelligenceEngine().analyze_application(
            application_id,
            snapshot.dataset,
            snapshot.relationships,
            snapshot.graph,
            snapshot.temporal,
            model_probability=probability,
            model_version=(
                snapshot.predictor.model_version
                if probability is not None and snapshot.predictor is not None
                else None
            ),
        )

    def _all_assessments(self, snapshot: IntelligenceSnapshot) -> dict[str, RiskAssessment]:
        if snapshot.assessments is None:
            probabilities = self._probabilities(snapshot)
            results = RiskIntelligenceEngine().analyze_all(
                snapshot.dataset,
                snapshot.relationships,
                snapshot.graph,
                snapshot.temporal,
                model_probabilities=probabilities,
                model_version=(snapshot.predictor.model_version if probabilities else None),
            )
            snapshot.assessments = {item.application_id: item for item in results}
        return snapshot.assessments

    @staticmethod
    def _application(snapshot: IntelligenceSnapshot, application_id: str) -> dict[str, Any]:
        application = next(
            (
                row
                for row in snapshot.dataset.tables["applications"]
                if str(row["application_id"]) == application_id
            ),
            None,
        )
        if application is None:
            raise APIError(
                404,
                "APPLICATION_NOT_FOUND",
                "No application exists for the supplied identifier.",
            )
        return application

    @staticmethod
    def _customer(snapshot: IntelligenceSnapshot, customer_id: str) -> dict[str, Any]:
        customer = next(
            (
                row
                for row in snapshot.dataset.tables["customers"]
                if str(row["customer_id"]) == customer_id
            ),
            None,
        )
        if customer is None:
            raise APIError(
                404,
                "CUSTOMER_NOT_FOUND",
                "No customer exists for the supplied identifier.",
            )
        return customer

    @staticmethod
    def _public_versions(versions: dict[str, Any]) -> dict[str, Any]:
        return {
            "feature_schema": versions["graph_feature_schema"],
            "temporal_feature_schema": versions["temporal_feature_schema"],
            "risk_policy": versions["risk_policy"],
            "model": versions["model"],
        }

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    @staticmethod
    def _now() -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")
