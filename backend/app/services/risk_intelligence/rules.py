"""Deterministic explainable rules over graph, temporal, and borrower evidence."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.services.entity_resolution.models import SharedEntityEvidence
from app.services.graph_intelligence.models import GraphFeatureVector
from app.services.temporal_intelligence.models import TemporalFeatureVector

from .config import RiskPolicy
from .models import RiskSignal


@dataclass(frozen=True, slots=True)
class RiskAnalysisContext:
    application: dict[str, Any]
    customer: dict[str, Any]
    graph_features: GraphFeatureVector
    temporal_features: TemporalFeatureVector
    shared_evidence: dict[str, tuple[SharedEntityEvidence, ...]]


class ExplainableRuleEngine:
    def __init__(self, policy: RiskPolicy | None = None) -> None:
        self.policy = policy or RiskPolicy()

    def evaluate(self, context: RiskAnalysisContext) -> tuple[RiskSignal, ...]:
        graph = context.graph_features
        temporal = context.temporal_features
        policy = self.policy
        signals: list[RiskSignal] = []

        device = self._strongest_evidence(context, "shared_device")
        if graph.shared_device_applicant_count_max >= policy.shared_device_applicant_threshold:
            signals.append(
                RiskSignal(
                    code="SHARED_DEVICE_MANY_APPLICANTS",
                    category="IDENTITY",
                    severity="HIGH",
                    message=(
                        f"Device {device.entity_id if device else 'unknown'} is linked to "
                        f"{graph.shared_device_applicant_count_max + 1} applicants."
                    ),
                    observed_value=graph.shared_device_applicant_count_max,
                    threshold=policy.shared_device_applicant_threshold,
                    points=policy.shared_device_points,
                    score_floor=policy.shared_device_floor,
                    entity_ids=(device.entity_id,) if device else (),
                )
            )

        account = self._strongest_evidence(context, "shared_account")
        if graph.shared_account_applicant_count_max >= policy.shared_account_applicant_threshold:
            signals.append(
                RiskSignal(
                    code="SHARED_ACCOUNT_MANY_APPLICANTS",
                    category="IDENTITY",
                    severity="HIGH",
                    message=(
                        f"Account {account.entity_id if account else 'unknown'} is linked to "
                        f"{graph.shared_account_applicant_count_max + 1} applicants."
                    ),
                    observed_value=graph.shared_account_applicant_count_max,
                    threshold=policy.shared_account_applicant_threshold,
                    points=policy.shared_account_points,
                    score_floor=policy.shared_account_floor,
                    entity_ids=(account.entity_id,) if account else (),
                )
            )

        dealer_id = str(context.application["dealer_id"])
        if "dealer_2h" in temporal.burst_signal_types:
            signals.append(
                RiskSignal(
                    code="RAPID_DEALER_APPLICATION_BURST",
                    category="TEMPORAL",
                    severity="HIGH",
                    message=(
                        f"Dealer {dealer_id} received {temporal.applications_same_dealer_2h} "
                        "applications within two hours."
                    ),
                    observed_value=temporal.applications_same_dealer_2h,
                    threshold=policy.application_velocity_threshold,
                    points=policy.rapid_dealer_burst_points,
                    score_floor=policy.rapid_dealer_burst_floor,
                    entity_ids=(dealer_id,),
                    window="2h",
                )
            )

        if "device_2h" in temporal.burst_signal_types:
            signals.append(
                RiskSignal(
                    code="RAPID_DEVICE_APPLICATION_BURST",
                    category="TEMPORAL",
                    severity="HIGH",
                    message=(
                        f"{temporal.applications_same_device_2h} applications used the same "
                        "device within two hours."
                    ),
                    observed_value=temporal.applications_same_device_2h,
                    threshold=policy.application_velocity_threshold,
                    points=policy.rapid_device_burst_points,
                    score_floor=policy.rapid_device_burst_floor,
                    entity_ids=(device.entity_id,) if device else (),
                    window="2h",
                )
            )

        if temporal.application_velocity_2h >= policy.application_velocity_threshold:
            signals.append(
                RiskSignal(
                    code="HIGH_APPLICATION_VELOCITY",
                    category="TEMPORAL",
                    severity="MEDIUM",
                    message=(
                        f"{temporal.application_velocity_2h} linked applications occurred "
                        "within two hours."
                    ),
                    observed_value=temporal.application_velocity_2h,
                    threshold=policy.application_velocity_threshold,
                    points=policy.velocity_points,
                    score_floor=0.0,
                    entity_ids=(dealer_id,),
                    window="2h",
                )
            )

        if (
            temporal.network_growth_rate_24h >= policy.network_growth_rate_threshold
            and temporal.linked_applicants_24h >= policy.linked_applicant_threshold
        ):
            signals.append(
                RiskSignal(
                    code="RAPID_NETWORK_GROWTH",
                    category="TEMPORAL",
                    severity="MEDIUM",
                    message=(
                        f"The linked network added {temporal.linked_applicants_24h} applicants "
                        "in 24 hours."
                    ),
                    observed_value=temporal.network_growth_rate_24h,
                    threshold=policy.network_growth_rate_threshold,
                    points=policy.growth_points,
                    score_floor=0.0,
                    window="24h",
                )
            )

        if graph.max_connection_strength >= policy.strong_connection_threshold:
            entity_ids = self._top_entity_ids(context, limit=3)
            signals.append(
                RiskSignal(
                    code="STRONG_MULTI_ENTITY_CONNECTION",
                    category="GRAPH",
                    severity="MEDIUM",
                    message=(
                        f"Maximum customer connection strength is "
                        f"{graph.max_connection_strength:.2f}."
                    ),
                    observed_value=graph.max_connection_strength,
                    threshold=policy.strong_connection_threshold,
                    points=policy.strong_connection_points,
                    score_floor=0.0,
                    entity_ids=entity_ids,
                )
            )

        if graph.shared_identity_signal_count >= policy.identity_signal_threshold:
            signals.append(
                RiskSignal(
                    code="MULTIPLE_SHARED_IDENTITY_SIGNALS",
                    category="GRAPH",
                    severity="MEDIUM",
                    message=(
                        f"Customer has {graph.shared_identity_signal_count} distinct shared "
                        "device/account signals."
                    ),
                    observed_value=graph.shared_identity_signal_count,
                    threshold=policy.identity_signal_threshold,
                    points=policy.multiple_identity_points,
                    score_floor=0.0,
                    entity_ids=self._top_entity_ids(context, limit=3),
                )
            )

        credit_score = int(context.customer["credit_score"])
        if credit_score < policy.low_credit_score_threshold:
            signals.append(
                RiskSignal(
                    code="LOW_CREDIT_SCORE",
                    category="CUSTOMER",
                    severity="MEDIUM",
                    message=f"Customer credit score is {credit_score}.",
                    observed_value=credit_score,
                    threshold=policy.low_credit_score_threshold,
                    points=policy.low_credit_points,
                    score_floor=0.0,
                    entity_ids=(str(context.customer["customer_id"]),),
                )
            )

        annual_income = max(1, int(context.customer["annual_income_inr"]))
        loan_to_income = int(context.application["loan_amount_inr"]) / annual_income
        if loan_to_income >= policy.loan_to_income_threshold:
            signals.append(
                RiskSignal(
                    code="HIGH_LOAN_TO_INCOME",
                    category="CUSTOMER",
                    severity="LOW",
                    message=f"Requested loan is {loan_to_income:.2f} times annual income.",
                    observed_value=round(loan_to_income, 4),
                    threshold=policy.loan_to_income_threshold,
                    points=policy.high_loan_to_income_points,
                    score_floor=0.0,
                    entity_ids=(str(context.application["application_id"]),),
                )
            )

        return tuple(sorted(signals, key=lambda item: (-item.points, item.code)))

    @staticmethod
    def _strongest_evidence(
        context: RiskAnalysisContext, relationship_type: str
    ) -> SharedEntityEvidence | None:
        evidence = context.shared_evidence.get(relationship_type, ())
        return evidence[0] if evidence else None

    @staticmethod
    def _top_entity_ids(context: RiskAnalysisContext, *, limit: int) -> tuple[str, ...]:
        evidence = [
            item
            for relationship_type in ("shared_device", "shared_account", "same_dealer")
            for item in context.shared_evidence.get(relationship_type, ())
        ]
        ordered = sorted(
            evidence,
            key=lambda item: (-item.weight, -item.linked_customer_count, item.entity_id),
        )
        return tuple(dict.fromkeys(item.entity_id for item in ordered))[:limit]
