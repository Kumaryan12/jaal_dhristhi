"""Hybrid explainable risk score orchestration."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Mapping
from datetime import UTC, datetime

from app.services.entity_resolution.models import RelationshipGraph, SharedEntityEvidence
from app.services.graph_intelligence.models import (
    FEATURE_SCHEMA_VERSION,
    GraphFeatureVector,
    GraphIntelligenceResult,
)
from app.services.synthetic_data.dataset import SyntheticDataset
from app.services.temporal_intelligence.models import (
    TEMPORAL_FEATURE_SCHEMA_VERSION,
    TemporalFeatureVector,
    TemporalIntelligenceResult,
)

from .config import RISK_POLICY_VERSION, RiskPolicy
from .models import (
    BorrowerSnapshot,
    RecommendedAction,
    RiskAssessment,
    RiskAssessmentVersions,
    ScoreComponents,
)
from .rules import ExplainableRuleEngine, RiskAnalysisContext


class RiskIntelligenceEngine:
    def __init__(self, policy: RiskPolicy | None = None) -> None:
        self.policy = policy or RiskPolicy()
        self.rules = ExplainableRuleEngine(self.policy)

    def score_context(
        self,
        context: RiskAnalysisContext,
        *,
        model_probability: float | None = None,
        model_version: str | None = None,
        analysed_at: str | None = None,
    ) -> RiskAssessment:
        if model_probability is not None and not 0 <= model_probability <= 1:
            raise ValueError("model_probability must be between 0 and 1")
        if model_probability is not None and not model_version:
            raise ValueError("model_version is required when model probability is supplied")

        signals = self.rules.evaluate(context)
        rule_score = round(min(100.0, sum(signal.points for signal in signals)), 4)
        graph_score = self._graph_score(context.graph_features)
        temporal_score = self._temporal_score(context.temporal_features)
        ml_score = round(model_probability * 100, 4) if model_probability is not None else None
        weights = self.policy.weights(ml_available=ml_score is not None)
        weighted_score = (
            rule_score * weights["rule"]
            + graph_score * weights["graph"]
            + temporal_score * weights["temporal"]
            + ((ml_score or 0.0) * weights.get("ml", 0.0))
        )
        enforced_floor = max((signal.score_floor for signal in signals), default=0.0)
        final_score = round(min(100.0, max(weighted_score, enforced_floor)), 2)
        risk_level = self.policy.risk_level(final_score)
        return RiskAssessment(
            application_id=str(context.application["application_id"]),
            customer_id=str(context.customer["customer_id"]),
            risk_score=final_score,
            risk_level=risk_level,
            signals=signals,
            recommended_action=self._recommended_action(risk_level, signals),
            score_components=ScoreComponents(
                rule_score=rule_score,
                graph_score=graph_score,
                temporal_score=temporal_score,
                ml_score=ml_score,
                weights=weights,
                weighted_score=round(weighted_score, 4),
                enforced_floor=enforced_floor,
                final_score=final_score,
            ),
            borrower=BorrowerSnapshot(
                age=int(context.customer["age"]),
                annual_income_inr=int(context.customer["annual_income_inr"]),
                credit_score=int(context.customer["credit_score"]),
                location_id=str(context.customer["location_id"]),
                loan_amount_inr=int(context.application["loan_amount_inr"]),
                loan_type=str(context.application["loan_type"]),
                dealer_id=str(context.application["dealer_id"]),
            ),
            versions=RiskAssessmentVersions(
                risk_policy=RISK_POLICY_VERSION,
                graph_feature_schema=FEATURE_SCHEMA_VERSION,
                temporal_feature_schema=TEMPORAL_FEATURE_SCHEMA_VERSION,
                model=model_version,
            ),
            analysed_at=analysed_at or datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        )

    def analyze_all(
        self,
        dataset: SyntheticDataset,
        relationship_graph: RelationshipGraph,
        graph_result: GraphIntelligenceResult,
        temporal_result: TemporalIntelligenceResult,
        *,
        model_probabilities: Mapping[str, float] | None = None,
        model_version: str | None = None,
    ) -> tuple[RiskAssessment, ...]:
        customers = {str(row["customer_id"]): row for row in dataset.tables["customers"]}
        graph_features = {item.customer_id: item for item in graph_result.features}
        temporal_features = {item.application_id: item for item in temporal_result.features}
        evidence_catalog = self._evidence_catalog(relationship_graph)
        batch_analysed_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        assessments = []
        for application in dataset.tables["applications"]:
            application_id = str(application["application_id"])
            customer_id = str(application["customer_id"])
            try:
                context = RiskAnalysisContext(
                    application=application,
                    customer=customers[customer_id],
                    graph_features=graph_features[customer_id],
                    temporal_features=temporal_features[application_id],
                    shared_evidence=evidence_catalog.get(customer_id, {}),
                )
            except KeyError as error:
                raise ValueError(
                    f"risk analysis inputs are incomplete for application {application_id}"
                ) from error
            probability = (
                model_probabilities.get(application_id) if model_probabilities is not None else None
            )
            assessments.append(
                self.score_context(
                    context,
                    model_probability=probability,
                    model_version=model_version if probability is not None else None,
                    analysed_at=batch_analysed_at,
                )
            )
        return tuple(assessments)

    def analyze_application(
        self,
        application_id: str,
        dataset: SyntheticDataset,
        relationship_graph: RelationshipGraph,
        graph_result: GraphIntelligenceResult,
        temporal_result: TemporalIntelligenceResult,
        *,
        model_probability: float | None = None,
        model_version: str | None = None,
    ) -> RiskAssessment:
        application = next(
            (
                row
                for row in dataset.tables["applications"]
                if str(row["application_id"]) == application_id
            ),
            None,
        )
        if application is None:
            raise KeyError(f"application not found: {application_id}")
        customer_id = str(application["customer_id"])
        customer = next(
            row for row in dataset.tables["customers"] if str(row["customer_id"]) == customer_id
        )
        context = RiskAnalysisContext(
            application=application,
            customer=customer,
            graph_features=graph_result.feature_for(customer_id),
            temporal_features=temporal_result.feature_for(application_id),
            shared_evidence=self._evidence_catalog(relationship_graph).get(customer_id, {}),
        )
        return self.score_context(
            context,
            model_probability=model_probability,
            model_version=model_version,
        )

    @staticmethod
    def _evidence_catalog(
        relationship_graph: RelationshipGraph,
    ) -> dict[str, dict[str, tuple[SharedEntityEvidence, ...]]]:
        mutable: dict[str, dict[str, dict[str, SharedEntityEvidence]]] = defaultdict(
            lambda: defaultdict(dict)
        )
        for connection in relationship_graph.customer_connections:
            for customer_id in (
                connection.source_customer_id,
                connection.target_customer_id,
            ):
                for evidence in connection.evidence:
                    mutable[customer_id][evidence.relationship_type][evidence.entity_id] = evidence
        return {
            customer_id: {
                relationship_type: tuple(
                    sorted(
                        evidence_by_id.values(),
                        key=lambda item: (
                            -item.linked_customer_count,
                            -item.weight,
                            item.entity_id,
                        ),
                    )
                )
                for relationship_type, evidence_by_id in relationships.items()
            }
            for customer_id, relationships in mutable.items()
        }

    @staticmethod
    def _graph_score(features: GraphFeatureVector) -> float:
        score = (
            min(40.0, features.shared_device_applicant_count_max * 10.0)
            + min(35.0, features.shared_account_applicant_count_max * 9.0)
            + min(10.0, features.shared_identity_signal_count * 5.0)
            + features.max_connection_strength * 10.0
            + min(5.0, features.connected_applicant_count / 10.0)
        )
        return round(min(100.0, score), 4)

    @staticmethod
    def _temporal_score(features: TemporalFeatureVector) -> float:
        score = (
            min(35.0, max(0, features.application_velocity_2h - 1) * 8.75)
            + min(25.0, features.linked_applicants_24h * 6.25)
            + min(20.0, features.network_growth_rate_24h * 10.0)
            + features.recency_score * 10.0
            + (10.0 if features.rapid_burst_detected else 0.0)
        )
        return round(min(100.0, score), 4)

    @staticmethod
    def _recommended_action(risk_level: str, signals: tuple) -> RecommendedAction:
        top_codes = ", ".join(signal.code for signal in signals[:2])
        if risk_level == "HIGH":
            return RecommendedAction(
                code="ENHANCED_VERIFICATION",
                label="Enhanced verification required",
                rationale=(
                    f"Validate shared-entity ownership and dealer evidence ({top_codes})."
                    if top_codes
                    else "Validate ecosystem evidence before proceeding."
                ),
                human_review_required=True,
            )
        if risk_level == "MEDIUM":
            return RecommendedAction(
                code="MANUAL_REVIEW",
                label="Manual review recommended",
                rationale=(
                    f"Review the leading ecosystem signals ({top_codes})."
                    if top_codes
                    else "Review the application context before proceeding."
                ),
                human_review_required=True,
            )
        return RecommendedAction(
            code="STANDARD_PROCESSING",
            label="Continue standard processing",
            rationale="No high-confidence ecosystem risk signal is currently present.",
            human_review_required=False,
        )
