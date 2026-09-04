"""Measured application-screening and ecosystem-detection validation."""

from __future__ import annotations

import json
import os
import tempfile
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from statistics import fmean, median
from typing import Any

from app.services.entity_resolution import EntityResolutionEngine, ResolutionConfig
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.risk_intelligence import RiskIntelligenceEngine, RiskPolicy
from app.services.synthetic_data import SyntheticDataset
from app.services.temporal_intelligence import TemporalIntelligenceEngine

from .models import (
    EcosystemDetectionMetrics,
    PrototypeValidationReport,
    ScreeningMetrics,
)

BENCHMARK_VERSION = "1.0.0"
EVALUATION_SCOPE = (
    "Deterministic synthetic benchmark; ground truth is used only after scoring and the "
    "results are not production fraud-performance claims."
)


class PrototypeValidationEngine:
    """Compare an individual-only screen with JaalDrishti on one seeded portfolio."""

    def __init__(
        self,
        *,
        baseline_credit_score_threshold: int = 600,
        baseline_loan_to_income_threshold: float = 0.75,
        max_projected_group_size: int = 80,
    ) -> None:
        if not 300 <= baseline_credit_score_threshold <= 900:
            raise ValueError("baseline credit-score threshold must be between 300 and 900")
        if baseline_loan_to_income_threshold <= 0:
            raise ValueError("baseline loan-to-income threshold must be positive")
        self.baseline_credit_score_threshold = baseline_credit_score_threshold
        self.baseline_loan_to_income_threshold = baseline_loan_to_income_threshold
        self.max_projected_group_size = max_projected_group_size

    def evaluate(self, dataset: SyntheticDataset) -> PrototypeValidationReport:
        applications = dataset.tables["applications"]
        truth = {
            str(row["application_id"]): self._as_bool(row["is_suspicious"])
            for row in dataset.tables["ground_truth"]
        }
        if set(truth) != {str(row["application_id"]) for row in applications}:
            raise ValueError("ground truth must contain exactly one row per application")

        baseline_flags = self._baseline_flags(dataset)
        relationships = EntityResolutionEngine(
            ResolutionConfig(max_projected_group_size=self.max_projected_group_size)
        ).resolve(dataset)
        graph_result = GraphIntelligenceEngine().analyze(relationships)
        temporal_result = TemporalIntelligenceEngine().analyze(dataset, relationships)
        assessments = RiskIntelligenceEngine().analyze_all(
            dataset,
            relationships,
            graph_result,
            temporal_result,
        )
        jaaldrishti_flags = {
            assessment.application_id
            for assessment in assessments
            if assessment.risk_level == "HIGH"
        }

        policy = RiskPolicy()
        return PrototypeValidationReport(
            benchmark_version=BENCHMARK_VERSION,
            dataset_id=dataset.dataset_id,
            seed=dataset.config.seed,
            evaluation_scope=EVALUATION_SCOPE,
            decision_threshold="HIGH / enhanced verification",
            baseline_definition=(
                "Application-only reference screen: credit score below "
                f"{self.baseline_credit_score_threshold} OR loan-to-income at least "
                f"{self.baseline_loan_to_income_threshold:.2f}."
            ),
            jaaldrishti_definition=(
                "Explainable rules plus graph and point-in-time temporal intelligence; "
                "no repayment outcomes, model probability, or ground-truth fields are inputs."
            ),
            baseline=self._screening_metrics(applications, truth, baseline_flags),
            jaaldrishti=self._screening_metrics(applications, truth, jaaldrishti_flags),
            ecosystem_detection=self._ecosystem_detection_metrics(dataset, policy),
        )

    def export_json(
        self,
        report: PrototypeValidationReport,
        output_path: Path,
        *,
        replace_existing: bool = False,
    ) -> Path:
        target = output_path.resolve()
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists() and not replace_existing:
            raise FileExistsError(
                f"validation artifact already exists ({target.name}); pass replace_existing=True"
            )
        with tempfile.NamedTemporaryFile(
            "w", encoding="utf-8", dir=target.parent, delete=False
        ) as handle:
            json.dump(report.to_dict(), handle, indent=2, sort_keys=True)
            handle.write("\n")
            temporary_name = handle.name
        os.replace(temporary_name, target)
        return target

    def _baseline_flags(self, dataset: SyntheticDataset) -> set[str]:
        customers = {
            str(row["customer_id"]): row for row in dataset.tables["customers"]
        }
        flags = set()
        for application in dataset.tables["applications"]:
            customer = customers[str(application["customer_id"])]
            annual_income = max(1, int(customer["annual_income_inr"]))
            loan_to_income = int(application["loan_amount_inr"]) / annual_income
            if (
                int(customer["credit_score"])
                < self.baseline_credit_score_threshold
                or loan_to_income >= self.baseline_loan_to_income_threshold
            ):
                flags.add(str(application["application_id"]))
        return flags

    @staticmethod
    def _screening_metrics(
        applications: list[dict[str, Any]],
        truth: dict[str, bool],
        flags: set[str],
    ) -> ScreeningMetrics:
        suspicious_ids = {
            str(row["application_id"])
            for row in applications
            if truth[str(row["application_id"])]
        }
        normal_ids = {str(row["application_id"]) for row in applications} - suspicious_ids
        true_positives = len(flags & suspicious_ids)
        false_positives = len(flags & normal_ids)
        false_negatives = len(suspicious_ids) - true_positives
        true_negatives = len(normal_ids) - false_positives
        return ScreeningMetrics(
            suspicious_applications=len(suspicious_ids),
            normal_applications=len(normal_ids),
            true_positives=true_positives,
            false_positives=false_positives,
            false_negatives=false_negatives,
            true_negatives=true_negatives,
            stepped_up_applications=len(flags),
            suspicious_application_recall=PrototypeValidationEngine._rate(
                true_positives, len(suspicious_ids)
            ),
            false_positive_rate=PrototypeValidationEngine._rate(
                false_positives, len(normal_ids)
            ),
            step_up_rate=PrototypeValidationEngine._rate(len(flags), len(applications)),
        )

    @staticmethod
    def _ecosystem_detection_metrics(
        dataset: SyntheticDataset, policy: RiskPolicy
    ) -> EcosystemDetectionMetrics:
        """Replay each labelled ecosystem and record its first HIGH-confidence trigger.

        Labels group rows only for evaluation. The trigger itself uses application-time entity
        counts and the same shared-entity and burst thresholds as the scoring policy.
        """

        applications = {
            str(row["application_id"]): row for row in dataset.tables["applications"]
        }
        device_ids_by_customer: dict[str, tuple[str, ...]] = defaultdict(tuple)
        account_ids_by_customer: dict[str, tuple[str, ...]] = defaultdict(tuple)
        mutable_devices: dict[str, list[str]] = defaultdict(list)
        mutable_accounts: dict[str, list[str]] = defaultdict(list)
        for row in dataset.tables["customer_devices"]:
            mutable_devices[str(row["customer_id"])].append(str(row["device_id"]))
        for row in dataset.tables["customer_accounts"]:
            mutable_accounts[str(row["customer_id"])].append(str(row["account_id"]))
        device_ids_by_customer.update(
            {customer_id: tuple(sorted(ids)) for customer_id, ids in mutable_devices.items()}
        )
        account_ids_by_customer.update(
            {customer_id: tuple(sorted(ids)) for customer_id, ids in mutable_accounts.items()}
        )

        rows_by_scenario: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for row in dataset.tables["ground_truth"]:
            if PrototypeValidationEngine._as_bool(row["is_suspicious"]):
                rows_by_scenario[str(row["scenario_id"])].append(
                    applications[str(row["application_id"])]
                )

        detection_points: list[int] = []
        for scenario_rows in rows_by_scenario.values():
            ordered = sorted(
                scenario_rows,
                key=lambda row: (str(row["submitted_at"]), str(row["application_id"])),
            )
            customers_by_device: dict[str, set[str]] = defaultdict(set)
            customers_by_account: dict[str, set[str]] = defaultdict(set)
            dealer_events: dict[str, list[tuple[datetime, str]]] = defaultdict(list)
            device_events: dict[str, list[tuple[datetime, str]]] = defaultdict(list)
            first_detection: int | None = None
            for application_number, application in enumerate(ordered, start=1):
                customer_id = str(application["customer_id"])
                submitted_at = PrototypeValidationEngine._parse_timestamp(
                    str(application["submitted_at"])
                )
                device_ids = device_ids_by_customer[customer_id]
                account_ids = account_ids_by_customer[customer_id]
                for device_id in device_ids:
                    customers_by_device[device_id].add(customer_id)
                    device_events[device_id].append((submitted_at, customer_id))
                for account_id in account_ids:
                    customers_by_account[account_id].add(customer_id)
                dealer_id = str(application["dealer_id"])
                dealer_events[dealer_id].append((submitted_at, customer_id))

                shared_device_others = max(
                    (len(customers_by_device[item]) - 1 for item in device_ids), default=0
                )
                shared_account_others = max(
                    (len(customers_by_account[item]) - 1 for item in account_ids), default=0
                )
                window_start = submitted_at - timedelta(hours=2)
                dealer_customers = {
                    item_customer
                    for event_time, item_customer in dealer_events[dealer_id]
                    if window_start <= event_time <= submitted_at
                }
                device_customer_counts = [
                    len(
                        {
                            item_customer
                            for event_time, item_customer in device_events[device_id]
                            if window_start <= event_time <= submitted_at
                        }
                    )
                    for device_id in device_ids
                ]
                high_confidence = (
                    shared_device_others >= policy.shared_device_applicant_threshold
                    or shared_account_others >= policy.shared_account_applicant_threshold
                    or len(dealer_customers) >= policy.application_velocity_threshold
                    or max(device_customer_counts, default=0)
                    >= policy.application_velocity_threshold
                )
                if high_confidence:
                    first_detection = application_number
                    break
            if first_detection is not None:
                detection_points.append(first_detection)

        distribution = {
            str(point): detection_points.count(point) for point in sorted(set(detection_points))
        }
        total = len(rows_by_scenario)
        detected = len(detection_points)
        return EcosystemDetectionMetrics(
            total_ecosystems=total,
            detected_ecosystems=detected,
            ecosystem_recall=PrototypeValidationEngine._rate(detected, total),
            median_detection_application=(
                round(float(median(detection_points)), 2) if detection_points else None
            ),
            mean_detection_application=(
                round(float(fmean(detection_points)), 2) if detection_points else None
            ),
            detection_point_distribution=distribution,
        )

    @staticmethod
    def _rate(numerator: int, denominator: int) -> float:
        return round(numerator / denominator, 6) if denominator else 0.0

    @staticmethod
    def _as_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        return str(value).strip().lower() in {"true", "1", "yes"}

    @staticmethod
    def _parse_timestamp(value: str) -> datetime:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError(f"timestamp must be timezone-aware: {value}")
        return parsed
