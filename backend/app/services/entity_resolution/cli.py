"""Command-line entry point for resolving the generated lending ecosystem."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator, validate_dataset

from .config import ResolutionConfig
from .resolver import EntityResolutionEngine


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Resolve TVS JaalDrishti entity relationships")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--normal-applications", type=int, default=5_000)
    parser.add_argument("--suspicious-ecosystems", type=int, default=100)
    parser.add_argument("--max-projected-group-size", type=int, default=80)
    parser.add_argument(
        "--graph-output",
        type=Path,
        help="optional path for the complete relationship graph JSON",
    )
    parser.add_argument("--replace", action="store_true")
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
    graph = EntityResolutionEngine(
        ResolutionConfig(max_projected_group_size=args.max_projected_group_size)
    ).resolve(dataset)
    if args.graph_output:
        graph.export_json(args.graph_output, replace_existing=args.replace)
    print(
        json.dumps(
            {
                "dataset_id": dataset.dataset_id,
                "graph_output": str(args.graph_output.resolve()) if args.graph_output else None,
                "summary": graph.summary(),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
