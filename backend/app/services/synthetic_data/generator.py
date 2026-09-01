"""Generate realistic, deterministic synthetic lending ecosystem records."""

from __future__ import annotations

import json
import math
import random
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Any

from .catalogs import (
    ECOSYSTEM_PATTERNS,
    LOAN_AMOUNT_RANGES,
    LOAN_TYPE_WEIGHTS,
    LOAN_TYPES,
    LOCATION_CATALOG,
)
from .config import GenerationConfig
from .dataset import SyntheticDataset


class SyntheticDataGenerator:
    """Seeded generator for normal applications and suspicious ecosystems."""

    def __init__(self, config: GenerationConfig | None = None) -> None:
        self.config = config or GenerationConfig()
        self.random = random.Random(self.config.seed)
        self.tables: dict[str, list[dict[str, Any]]] = {
            "locations": [],
            "dealers": [],
            "customers": [],
            "applications": [],
            "devices": [],
            "customer_devices": [],
            "bank_accounts": [],
            "customer_accounts": [],
            "repayments": [],
            "repayment_summaries": [],
            "ecosystems": [],
            "ground_truth": [],
        }
        self._counters = {
            "customer": 0,
            "application": 0,
            "device": 0,
            "account": 0,
            "repayment": 0,
        }

    def generate(self) -> SyntheticDataset:
        """Create a complete dataset in a stable row order."""

        self._create_locations()
        self._create_dealers()
        self._create_normal_population()
        self._create_suspicious_ecosystems()
        return SyntheticDataset(config=self.config, tables=self.tables)

    def _create_locations(self) -> None:
        for index, (city, state, postal_zone) in enumerate(LOCATION_CATALOG, start=1):
            self.tables["locations"].append(
                {
                    "location_id": f"LOC-{index:03d}",
                    "city": city,
                    "state": state,
                    "postal_zone": postal_zone,
                }
            )

    def _create_dealers(self) -> None:
        total = self.config.normal_dealer_count + self.config.suspicious_dealer_count
        for index in range(1, total + 1):
            self.tables["dealers"].append(
                {
                    "dealer_id": f"DLR-{index:04d}",
                    "location_id": self._choice(self.tables["locations"])["location_id"],
                    "dealer_type": self.random.choices(
                        ("authorized", "independent"), weights=(0.72, 0.28), k=1
                    )[0],
                }
            )

    def _create_normal_population(self) -> None:
        previous_device_id: str | None = None
        previous_account_id: str | None = None
        normal_dealers = self.tables["dealers"][: self.config.normal_dealer_count]

        for index in range(self.config.normal_application_count):
            customer_id = self._next_id("customer", "CUS-N", 6)
            application_id = self._next_id("application", "APP-N", 6)
            location_id = self._choice(self.tables["locations"])["location_id"]
            submitted_at = self._random_datetime(
                self.config.as_of - timedelta(days=365),
                self.config.as_of - timedelta(days=30),
            )
            customer = self._new_customer(customer_id, location_id, submitted_at, suspicious=False)
            self.tables["customers"].append(customer)

            share_device = (
                index > 0 and self.random.random() < self.config.benign_shared_device_rate
            )
            if share_device and previous_device_id is not None:
                device_id = previous_device_id
            else:
                device_id = self._create_device(submitted_at)
            self._link_device(customer_id, device_id, submitted_at)
            previous_device_id = device_id

            share_account = (
                index > 0 and self.random.random() < self.config.benign_shared_account_rate
            )
            if share_account and previous_account_id is not None:
                account_id = previous_account_id
                relationship_type = "joint"
            else:
                account_id = self._create_account(submitted_at)
                relationship_type = "primary"
            self._link_account(customer_id, account_id, submitted_at, relationship_type)
            previous_account_id = account_id

            dealer_id = self._choice(normal_dealers)["dealer_id"]
            application = self._new_application(
                application_id,
                customer_id,
                dealer_id,
                submitted_at,
            )
            self.tables["applications"].append(application)
            self._create_repayment_history(application, customer, stress=0.0)
            self._add_ground_truth(application_id, customer_id, False, "", "normal")

    def _create_suspicious_ecosystems(self) -> None:
        dealer_pool = self.tables["dealers"][self.config.normal_dealer_count :]
        for ecosystem_index in range(1, self.config.suspicious_ecosystem_count + 1):
            scenario_id = f"ECO-{ecosystem_index:04d}"
            pattern = ECOSYSTEM_PATTERNS[(ecosystem_index - 1) % len(ECOSYSTEM_PATTERNS)]
            size = self.random.randint(
                self.config.min_ecosystem_size, self.config.max_ecosystem_size
            )
            dealer_id = dealer_pool[(ecosystem_index - 1) % len(dealer_pool)]["dealer_id"]
            burst_start = self._random_datetime(
                self.config.as_of - timedelta(days=90),
                self.config.as_of - timedelta(days=2),
            )
            shared_device_id = (
                self._create_device(burst_start)
                if pattern in {"shared_device", "mixed_ring"}
                else None
            )
            shared_account_id = (
                self._create_account(burst_start)
                if pattern in {"shared_account", "mixed_ring"}
                else None
            )
            burst_span_minutes = self.random.randint(70, 110)

            self.tables["ecosystems"].append(
                {
                    "scenario_id": scenario_id,
                    "pattern_type": pattern,
                    "applicant_count": size,
                    "burst_started_at": self._iso(burst_start),
                    "shared_device_id": shared_device_id or "",
                    "shared_account_id": shared_account_id or "",
                    "concentrated_dealer_id": dealer_id,
                }
            )

            for member_index in range(size):
                customer_id = self._next_id("customer", "CUS-S", 6)
                application_id = self._next_id("application", "APP-S", 6)
                # Distribute the ring across a variable span that remains under two hours.
                submitted_at = burst_start + timedelta(
                    minutes=round(burst_span_minutes * member_index / max(1, size - 1))
                )
                dealer = next(
                    row for row in self.tables["dealers"] if row["dealer_id"] == dealer_id
                )
                location_id = (
                    dealer["location_id"]
                    if pattern in {"dealer_burst", "mixed_ring"}
                    else self._choice(self.tables["locations"])["location_id"]
                )
                customer = self._new_customer(
                    customer_id, location_id, submitted_at, suspicious=True
                )
                self.tables["customers"].append(customer)

                device_id = shared_device_id or self._create_device(submitted_at)
                self._link_device(customer_id, device_id, submitted_at)
                account_id = shared_account_id or self._create_account(submitted_at)
                self._link_account(
                    customer_id,
                    account_id,
                    submitted_at,
                    "observed_repayment_source" if shared_account_id else "primary",
                )

                application = self._new_application(
                    application_id,
                    customer_id,
                    dealer_id,
                    submitted_at,
                )
                self.tables["applications"].append(application)
                stress = 0.18 if pattern in {"shared_account", "mixed_ring"} else 0.08
                self._create_repayment_history(application, customer, stress=stress)
                self._add_ground_truth(application_id, customer_id, True, scenario_id, pattern)

    def _new_customer(
        self, customer_id: str, location_id: str, created_at: datetime, *, suspicious: bool
    ) -> dict[str, Any]:
        age = round(self.random.triangular(21, 62, 34))
        income = self._rounded_amount(
            min(max(self.random.lognormvariate(math.log(480_000), 0.55), 140_000), 3_600_000),
            1_000,
        )
        # Ecosystem members intentionally remain individually plausible.
        score_mean = 704 if suspicious else 712
        credit_score = round(min(max(self.random.gauss(score_mean, 52), 420), 850))
        return {
            "customer_id": customer_id,
            "age": age,
            "annual_income_inr": income,
            "location_id": location_id,
            "credit_score": credit_score,
            "created_at": self._iso(created_at - timedelta(days=self.random.randint(1, 45))),
        }

    def _new_application(
        self,
        application_id: str,
        customer_id: str,
        dealer_id: str,
        submitted_at: datetime,
    ) -> dict[str, Any]:
        loan_type = self.random.choices(LOAN_TYPES, weights=LOAN_TYPE_WEIGHTS, k=1)[0]
        minimum, maximum = LOAN_AMOUNT_RANGES[loan_type]
        loan_amount = self._rounded_amount(self.random.triangular(minimum, maximum, minimum), 1_000)
        return {
            "application_id": application_id,
            "customer_id": customer_id,
            "loan_amount_inr": loan_amount,
            "loan_type": loan_type,
            "dealer_id": dealer_id,
            "submitted_at": self._iso(submitted_at),
        }

    def _create_device(self, first_seen_at: datetime) -> str:
        device_id = self._next_id("device", "DEV", 7)
        self.tables["devices"].append(
            {
                "device_id": device_id,
                "device_type": self.random.choices(
                    ("android", "ios", "web"), weights=(0.78, 0.14, 0.08), k=1
                )[0],
                "first_seen_at": self._iso(first_seen_at),
            }
        )
        return device_id

    def _link_device(self, customer_id: str, device_id: str, observed_at: datetime) -> None:
        self.tables["customer_devices"].append(
            {
                "customer_id": customer_id,
                "device_id": device_id,
                "first_seen_at": self._iso(observed_at),
                "last_seen_at": self._iso(observed_at + timedelta(minutes=15)),
            }
        )

    def _create_account(self, first_seen_at: datetime) -> str:
        account_id = self._next_id("account", "ACC", 7)
        self.tables["bank_accounts"].append(
            {
                "account_id": account_id,
                "bank_code": f"BANK-{self.random.randint(1, 24):02d}",
                "opened_at": (
                    first_seen_at.date() - timedelta(days=self.random.randint(180, 4_500))
                ).isoformat(),
            }
        )
        return account_id

    def _link_account(
        self,
        customer_id: str,
        account_id: str,
        observed_at: datetime,
        relationship_type: str,
    ) -> None:
        self.tables["customer_accounts"].append(
            {
                "customer_id": customer_id,
                "account_id": account_id,
                "relationship_type": relationship_type,
                "first_seen_at": self._iso(observed_at),
            }
        )

    def _create_repayment_history(
        self, application: dict[str, Any], customer: dict[str, Any], *, stress: float
    ) -> None:
        submitted_at = datetime.fromisoformat(
            str(application["submitted_at"]).replace("Z", "+00:00")
        )
        score = int(customer["credit_score"])
        base_late_probability = max(0.025, min(0.24, (700 - score) / 900 + 0.07))
        late_probability = min(0.55, base_late_probability + stress)
        missed_probability = min(0.28, 0.012 + stress * 0.42 + max(0, 650 - score) / 2_500)
        installment = max(1_500, round(int(application["loan_amount_inr"]) / 24 / 100) * 100)
        statuses: list[str] = []

        for installment_number in range(1, 7):
            due_at = submitted_at + timedelta(days=30 * installment_number)
            if due_at > self.config.as_of:
                break
            draw = self.random.random()
            if draw < missed_probability:
                status = "missed"
                paid_at = ""
                amount_paid = 0
            elif draw < missed_probability + late_probability:
                status = "late"
                paid_at = (due_at + timedelta(days=self.random.randint(3, 24))).date().isoformat()
                amount_paid = installment
            else:
                status = "on_time"
                paid_at = (due_at - timedelta(days=self.random.randint(0, 3))).date().isoformat()
                amount_paid = installment
            statuses.append(status)
            self.tables["repayments"].append(
                {
                    "repayment_id": self._next_id("repayment", "PAY", 8),
                    "application_id": application["application_id"],
                    "due_at": due_at.date().isoformat(),
                    "paid_at": paid_at,
                    "amount_due_inr": installment,
                    "amount_paid_inr": amount_paid,
                    "status": status,
                }
            )

        default_status = statuses.count("missed") >= 2 or (
            bool(statuses) and statuses[-1] == "missed" and statuses.count("missed") >= 1
        )
        self.tables["repayment_summaries"].append(
            {
                "customer_id": customer["customer_id"],
                "application_id": application["application_id"],
                "payment_history": json.dumps(statuses, separators=(",", ":")),
                "default_status": default_status,
            }
        )

    def _add_ground_truth(
        self,
        application_id: str,
        customer_id: str,
        is_suspicious: bool,
        scenario_id: str,
        pattern_type: str,
    ) -> None:
        self.tables["ground_truth"].append(
            {
                "application_id": application_id,
                "customer_id": customer_id,
                "is_suspicious": is_suspicious,
                "scenario_id": scenario_id,
                "pattern_type": pattern_type,
            }
        )

    def _next_id(self, counter: str, prefix: str, width: int) -> str:
        self._counters[counter] += 1
        return f"{prefix}-{self._counters[counter]:0{width}d}"

    def _random_datetime(self, start: datetime, end: datetime) -> datetime:
        span_seconds = int((end - start).total_seconds())
        return start + timedelta(seconds=self.random.randint(0, span_seconds))

    def _choice(self, rows: Iterable[dict[str, Any]]) -> dict[str, Any]:
        materialized = tuple(rows)
        return materialized[self.random.randrange(len(materialized))]

    @staticmethod
    def _rounded_amount(value: float, quantum: int) -> int:
        return max(quantum, round(value / quantum) * quantum)

    @staticmethod
    def _iso(value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=UTC)
        return value.astimezone(UTC).isoformat().replace("+00:00", "Z")
