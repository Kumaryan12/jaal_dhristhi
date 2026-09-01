"""Create a stable application-level ML matrix without evaluation-label leakage."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray

from app.services.graph_intelligence.models import GraphIntelligenceResult
from app.services.synthetic_data.dataset import SyntheticDataset
from app.services.temporal_intelligence.models import TemporalIntelligenceResult

from .config import ML_FEATURE_SCHEMA_VERSION, MLTrainingConfig

LOAN_TYPES = ("two_wheeler", "three_wheeler", "used_vehicle", "consumer_durable")

FORBIDDEN_FEATURE_FRAGMENTS = (
    "is_suspicious",
    "scenario",
    "pattern",
    "ground_truth",
    "default_status",
)


@dataclass(frozen=True, slots=True)
class MLFeatureDataset:
    feature_schema_version: str
    feature_names: tuple[str, ...]
    application_ids: tuple[str, ...]
    customer_ids: tuple[str, ...]
    groups: tuple[str, ...]
    values: NDArray[np.float64]
    labels: NDArray[np.int64]

    def __post_init__(self) -> None:
        row_count = len(self.application_ids)
        if self.values.shape != (row_count, len(self.feature_names)):
            raise ValueError("feature matrix dimensions do not match IDs and feature names")
        if self.labels.shape != (row_count,):
            raise ValueError("label vector dimensions do not match feature rows")
        if len(self.customer_ids) != row_count or len(self.groups) != row_count:
            raise ValueError("customer/group metadata does not match feature rows")
        if not np.isfinite(self.values).all():
            raise ValueError("feature matrix contains non-finite values")
        lowered = tuple(name.lower() for name in self.feature_names)
        for fragment in FORBIDDEN_FEATURE_FRAGMENTS:
            if any(fragment in name for name in lowered):
                raise ValueError(f"forbidden evaluation field entered features: {fragment}")

    def row_for(self, application_id: str) -> NDArray[np.float64]:
        try:
            index = self.application_ids.index(application_id)
        except ValueError as error:
            raise KeyError(f"application has no ML feature row: {application_id}") from error
        return self.values[index]


class MLFeatureMatrixBuilder:
    """Join approved customer, application, graph, and temporal numeric features."""

    def __init__(self, config: MLTrainingConfig | None = None) -> None:
        self.config = config or MLTrainingConfig()

    @property
    def feature_names(self) -> tuple[str, ...]:
        return (
            "customer_age",
            "customer_log_annual_income",
            "customer_credit_score",
            "application_log_loan_amount",
            "application_loan_to_income_ratio",
            *(f"application_loan_type_{loan_type}" for loan_type in LOAN_TYPES),
            "graph_degree_centrality",
            "graph_connected_applicant_count",
            "graph_heterogeneous_degree",
            "graph_cluster_size",
            "graph_network_density",
            "graph_community_size",
            "graph_shared_identity_signal_count",
            "graph_shared_device_count",
            "graph_shared_account_count",
            "graph_same_dealer_count",
            "graph_same_location_count",
            "graph_shared_device_applicant_count_max",
            "graph_shared_account_applicant_count_max",
            "graph_max_connection_strength",
            "graph_mean_connection_strength",
            "temporal_applications_same_device_2h",
            "temporal_applications_same_dealer_2h",
            "temporal_applications_same_account_24h",
            "temporal_customer_applications_30d",
            "temporal_application_velocity_2h",
            "temporal_linked_applicants_24h",
            "temporal_network_prior_applicants_30d",
            "temporal_network_growth_rate_24h",
            "temporal_hours_since_latest_link",
            "temporal_has_recent_link",
            "temporal_recency_score",
            "temporal_rapid_burst_detected",
            "temporal_dealer_burst_detected",
            "temporal_device_burst_detected",
        )

    def build(
        self,
        dataset: SyntheticDataset,
        graph_result: GraphIntelligenceResult,
        temporal_result: TemporalIntelligenceResult,
    ) -> MLFeatureDataset:
        customers = {str(row["customer_id"]): row for row in dataset.tables["customers"]}
        graph_features = {feature.customer_id: feature for feature in graph_result.features}
        temporal_features = {
            feature.application_id: feature for feature in temporal_result.features
        }
        labels = {str(row["application_id"]): row for row in dataset.tables["ground_truth"]}

        values: list[list[float]] = []
        output_labels: list[int] = []
        application_ids: list[str] = []
        customer_ids: list[str] = []
        groups: list[str] = []
        for application in dataset.tables["applications"]:
            application_id = str(application["application_id"])
            customer_id = str(application["customer_id"])
            try:
                customer = customers[customer_id]
                graph = graph_features[customer_id]
                temporal = temporal_features[application_id]
                truth = labels[application_id]
            except KeyError as error:
                raise ValueError(
                    f"incomplete ML inputs for application {application_id}"
                ) from error

            income = max(1, int(customer["annual_income_inr"]))
            loan_amount = int(application["loan_amount_inr"])
            loan_type = str(application["loan_type"])
            if loan_type not in LOAN_TYPES:
                raise ValueError(f"unsupported loan type: {loan_type}")
            burst_types = set(temporal.burst_signal_types)
            hours_since_link = (
                temporal.hours_since_latest_link
                if temporal.hours_since_latest_link is not None
                else self.config.missing_recency_hours
            )
            row = [
                float(customer["age"]),
                float(np.log1p(income)),
                float(customer["credit_score"]),
                float(np.log1p(loan_amount)),
                loan_amount / income,
                *(1.0 if loan_type == candidate else 0.0 for candidate in LOAN_TYPES),
                graph.degree_centrality,
                float(graph.connected_applicant_count),
                float(graph.heterogeneous_degree),
                float(graph.cluster_size),
                graph.network_density,
                float(graph.community_size),
                float(graph.shared_identity_signal_count),
                float(graph.shared_device_count),
                float(graph.shared_account_count),
                float(graph.same_dealer_count),
                float(graph.same_location_count),
                float(graph.shared_device_applicant_count_max),
                float(graph.shared_account_applicant_count_max),
                graph.max_connection_strength,
                graph.mean_connection_strength,
                float(temporal.applications_same_device_2h),
                float(temporal.applications_same_dealer_2h),
                float(temporal.applications_same_account_24h),
                float(temporal.customer_applications_30d),
                float(temporal.application_velocity_2h),
                float(temporal.linked_applicants_24h),
                float(temporal.network_prior_applicants_30d),
                temporal.network_growth_rate_24h,
                float(hours_since_link),
                1.0 if temporal.hours_since_latest_link is not None else 0.0,
                temporal.recency_score,
                1.0 if temporal.rapid_burst_detected else 0.0,
                1.0 if "dealer_2h" in burst_types else 0.0,
                1.0 if "device_2h" in burst_types else 0.0,
            ]
            is_suspicious = self._as_bool(truth["is_suspicious"])
            scenario_id = str(truth["scenario_id"])
            application_ids.append(application_id)
            customer_ids.append(customer_id)
            values.append(row)
            output_labels.append(int(is_suspicious))
            groups.append(scenario_id if is_suspicious else f"NORMAL::{application_id}")

        return MLFeatureDataset(
            feature_schema_version=ML_FEATURE_SCHEMA_VERSION,
            feature_names=self.feature_names,
            application_ids=tuple(application_ids),
            customer_ids=tuple(customer_ids),
            groups=tuple(groups),
            values=np.asarray(values, dtype=np.float64),
            labels=np.asarray(output_labels, dtype=np.int64),
        )

    @staticmethod
    def _as_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"true", "1", "yes"}
