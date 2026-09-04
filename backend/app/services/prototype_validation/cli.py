"""Terminal entry point for measured prototype validation."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator, validate_dataset

from .engine import PrototypeValidationEngine
from .models import PrototypeValidationReport


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Compare an application-only reference screen with JaalDrishti"
    )
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--normal-applications", type=int, default=5_000)
    parser.add_argument("--suspicious-ecosystems", type=int, default=100)
    parser.add_argument("--baseline-credit-score", type=int, default=600)
    parser.add_argument("--baseline-loan-to-income", type=float, default=0.75)
    parser.add_argument("--max-projected-group-size", type=int, default=80)
    parser.add_argument("--output", type=Path, help="optional JSON report path")
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--json", action="store_true", help="print JSON instead of a table")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    dataset = SyntheticDataGenerator(
        GenerationConfig(
            seed=args.seed,
            normal_application_count=args.normal_applications,
            suspicious_ecosystem_count=args.suspicious_ecosystems,
        )
    ).generate()
    validate_dataset(dataset)
    engine = PrototypeValidationEngine(
        baseline_credit_score_threshold=args.baseline_credit_score,
        baseline_loan_to_income_threshold=args.baseline_loan_to_income,
        max_projected_group_size=args.max_projected_group_size,
    )
    report = engine.evaluate(dataset)
    artifact = (
        engine.export_json(report, args.output, replace_existing=args.replace)
        if args.output
        else None
    )
    if args.json:
        payload = report.to_dict()
        payload["artifact"] = str(artifact) if artifact else None
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(_format_report(report, artifact))


def _format_report(report: PrototypeValidationReport, artifact: Path | None) -> str:
    baseline = report.baseline
    jaal = report.jaaldrishti
    detection = report.ecosystem_detection
    rows = (
        (
            "Suspicious-application recall",
            _percent_with_fraction(
                baseline.suspicious_application_recall,
                baseline.true_positives,
                baseline.suspicious_applications,
            ),
            _percent_with_fraction(
                jaal.suspicious_application_recall,
                jaal.true_positives,
                jaal.suspicious_applications,
            ),
        ),
        (
            "False-positive rate",
            _percent_with_fraction(
                baseline.false_positive_rate,
                baseline.false_positives,
                baseline.normal_applications,
            ),
            _percent_with_fraction(
                jaal.false_positive_rate,
                jaal.false_positives,
                jaal.normal_applications,
            ),
        ),
        (
            "Applications stepped up",
            _percent_with_fraction(
                baseline.step_up_rate,
                baseline.stepped_up_applications,
                baseline.suspicious_applications + baseline.normal_applications,
            ),
            _percent_with_fraction(
                jaal.step_up_rate,
                jaal.stepped_up_applications,
                jaal.suspicious_applications + jaal.normal_applications,
            ),
        ),
        (
            "High-confidence ecosystem recall",
            "N/A (no network model)",
            _percent_with_fraction(
                detection.ecosystem_recall,
                detection.detected_ecosystems,
                detection.total_ecosystems,
            ),
        ),
        (
            "Median ecosystem detection point",
            "N/A (no network model)",
            (
                f"Application {detection.median_detection_application:g}"
                if detection.median_detection_application is not None
                else "N/A"
            ),
        ),
    )
    metric_width = max(len(row[0]) for row in rows)
    baseline_width = max(len("Application-only baseline"), *(len(row[1]) for row in rows))
    jaal_width = max(len("JaalDrishti"), *(len(row[2]) for row in rows))
    divider = f"+-{'-' * metric_width}-+-{'-' * baseline_width}-+-{'-' * jaal_width}-+"
    lines = [
        "PROTOTYPE VALIDATION",
        f"Dataset: {report.dataset_id}",
        f"Decision threshold: {report.decision_threshold}",
        "",
        divider,
        (
            f"| {'Metric':<{metric_width}} | "
            f"{'Application-only baseline':<{baseline_width}} | "
            f"{'JaalDrishti':<{jaal_width}} |"
        ),
        divider,
    ]
    lines.extend(
        f"| {metric:<{metric_width}} | {baseline_value:<{baseline_width}} | "
        f"{jaal_value:<{jaal_width}} |"
        for metric, baseline_value, jaal_value in rows
    )
    lines.extend(
        [
            divider,
            "",
            f"Baseline: {report.baseline_definition}",
            f"JaalDrishti: {report.jaaldrishti_definition}",
            (
                "Detection replay: mean Application "
                f"{detection.mean_detection_application:g}; distribution "
                f"{detection.detection_point_distribution}."
                if detection.mean_detection_application is not None
                else "Detection replay: no ecosystems detected."
            ),
            f"Scope: {report.evaluation_scope}",
        ]
    )
    if artifact:
        lines.append(f"JSON artifact: {artifact}")
    return "\n".join(lines)


def _percent_with_fraction(rate: float, numerator: int, denominator: int) -> str:
    return f"{rate * 100:.2f}% ({numerator}/{denominator})"


if __name__ == "__main__":
    main()
