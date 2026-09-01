"""Cross-table and scenario quality checks for generated datasets."""

from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime
from typing import Any

from .dataset import SyntheticDataset


class DatasetValidationError(ValueError):
    """Raised when a generated dataset violates its contract."""


def validate_dataset(dataset: SyntheticDataset) -> dict[str, Any]:
    """Validate identities, foreign keys, counts, ranges, and ecosystem evidence."""

    tables = dataset.tables
    required = {
        "locations",
        "dealers",
        "customers",
        "applications",
        "devices",
        "customer_devices",
        "bank_accounts",
        "customer_accounts",
        "repayments",
        "repayment_summaries",
        "ecosystems",
        "ground_truth",
    }
    _require(required <= tables.keys(), f"missing tables: {sorted(required - tables.keys())}")
    for name in required:
        _require(bool(tables[name]), f"table {name} must not be empty")

    customer_ids = _unique_ids(tables["customers"], "customer_id", "customers")
    application_ids = _unique_ids(tables["applications"], "application_id", "applications")
    device_ids = _unique_ids(tables["devices"], "device_id", "devices")
    account_ids = _unique_ids(tables["bank_accounts"], "account_id", "bank_accounts")
    dealer_ids = _unique_ids(tables["dealers"], "dealer_id", "dealers")
    location_ids = _unique_ids(tables["locations"], "location_id", "locations")

    for row in tables["customers"]:
        _require(row["location_id"] in location_ids, "customer has unknown location")
        _require(18 <= int(row["age"]) <= 75, "customer age is out of range")
        _require(int(row["annual_income_inr"]) > 0, "customer income must be positive")
        _require(300 <= int(row["credit_score"]) <= 900, "credit score is out of range")

    for row in tables["applications"]:
        _require(row["customer_id"] in customer_ids, "application has unknown customer")
        _require(row["dealer_id"] in dealer_ids, "application has unknown dealer")
        _require(int(row["loan_amount_inr"]) > 0, "loan amount must be positive")
        _parse_timestamp(row["submitted_at"])

    device_links = Counter()
    for row in tables["customer_devices"]:
        _require(row["customer_id"] in customer_ids, "device link has unknown customer")
        _require(row["device_id"] in device_ids, "device link has unknown device")
        _require(
            _parse_timestamp(row["first_seen_at"]) <= _parse_timestamp(row["last_seen_at"]),
            "device relationship has invalid validity window",
        )
        device_links[row["customer_id"]] += 1

    account_links = Counter()
    for row in tables["customer_accounts"]:
        _require(row["customer_id"] in customer_ids, "account link has unknown customer")
        _require(row["account_id"] in account_ids, "account link has unknown account")
        account_links[row["customer_id"]] += 1

    _require(set(device_links) == customer_ids, "every customer must have a device")
    _require(set(account_links) == customer_ids, "every customer must have an account")

    labels = {row["application_id"]: row for row in tables["ground_truth"]}
    _require(set(labels) == application_ids, "every application must have one ground-truth row")
    normal_count = sum(not bool(row["is_suspicious"]) for row in labels.values())
    suspicious_count = len(labels) - normal_count
    _require(
        normal_count >= dataset.config.normal_application_count,
        "normal application count is below the requested minimum",
    )

    ecosystem_ids = _unique_ids(tables["ecosystems"], "scenario_id", "ecosystems")
    _require(
        len(ecosystem_ids) >= dataset.config.suspicious_ecosystem_count,
        "suspicious ecosystem count is below the requested minimum",
    )
    suspicious_labels = [row for row in labels.values() if row["is_suspicious"]]
    _require(
        all(row["scenario_id"] in ecosystem_ids for row in suspicious_labels), "bad scenario label"
    )
    _require(
        all(not row["scenario_id"] for row in labels.values() if not row["is_suspicious"]),
        "normal labels must not carry scenario IDs",
    )

    _validate_ecosystem_evidence(tables)
    _require(
        {row["application_id"] for row in tables["repayment_summaries"]} == application_ids,
        "every application must have a repayment summary",
    )
    _require(
        all(row["application_id"] in application_ids for row in tables["repayments"]),
        "repayment has unknown application",
    )

    return {
        "valid": True,
        "normal_applications": normal_count,
        "suspicious_applications": suspicious_count,
        "suspicious_ecosystems": len(ecosystem_ids),
        "customers": len(customer_ids),
        "tables": dataset.row_counts(),
    }


def _validate_ecosystem_evidence(tables: dict[str, list[dict[str, Any]]]) -> None:
    scenario_by_application = {
        row["application_id"]: row["scenario_id"]
        for row in tables["ground_truth"]
        if row["is_suspicious"]
    }
    applications_by_scenario: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in tables["applications"]:
        scenario_id = scenario_by_application.get(row["application_id"])
        if scenario_id:
            applications_by_scenario[scenario_id].append(row)

    device_by_customer = {
        row["customer_id"]: row["device_id"] for row in tables["customer_devices"]
    }
    account_by_customer = {
        row["customer_id"]: row["account_id"] for row in tables["customer_accounts"]
    }

    for ecosystem in tables["ecosystems"]:
        scenario_id = ecosystem["scenario_id"]
        applications = applications_by_scenario[scenario_id]
        _require(
            len(applications) == int(ecosystem["applicant_count"]),
            f"{scenario_id} applicant count does not match",
        )
        submitted = sorted(_parse_timestamp(row["submitted_at"]) for row in applications)
        _require(
            (submitted[-1] - submitted[0]).total_seconds() <= 2 * 60 * 60,
            f"{scenario_id} is not a two-hour application burst",
        )
        _require(
            len({row["dealer_id"] for row in applications}) == 1,
            f"{scenario_id} does not have dealer concentration",
        )
        pattern = ecosystem["pattern_type"]
        customer_ids = [row["customer_id"] for row in applications]
        if pattern in {"shared_device", "mixed_ring"}:
            _require(
                len({device_by_customer[customer_id] for customer_id in customer_ids}) == 1,
                f"{scenario_id} does not share its declared device",
            )
        if pattern in {"shared_account", "mixed_ring"}:
            _require(
                len({account_by_customer[customer_id] for customer_id in customer_ids}) == 1,
                f"{scenario_id} does not share its declared account",
            )


def _unique_ids(rows: list[dict[str, Any]], key: str, table_name: str) -> set[str]:
    values = [str(row[key]) for row in rows]
    _require(len(values) == len(set(values)), f"duplicate {key} in {table_name}")
    return set(values)


def _parse_timestamp(value: Any) -> datetime:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as error:
        raise DatasetValidationError(f"invalid timestamp: {value}") from error
    _require(parsed.tzinfo is not None, f"timestamp is not timezone-aware: {value}")
    return parsed


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise DatasetValidationError(message)
