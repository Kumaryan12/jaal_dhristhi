"""Command-line pipeline for graph-intelligence feature generation."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from app.services.entity_resolution import EntityResolutionEngine, ResolutionConfig
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator, validate_dataset

from .config import GraphIntelligenceConfig
from .engine import GraphIntelligenceEngine


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate JaalDrishti graph intelligence features")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--normal-applications", type=int, default=5_000)
    parser.add_argument("--suspicious-ecosystems", type=int, default=100)
    parser.add_argument("--max-projected-group-size", type=int, default=80)
    parser.add_argument("--minimum-connection-strength", type=float, default=0.0)
    parser.add_argument("--community-seed", type=int, default=2026)
    parser.add_argument("--output-dir", type=Path)
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
    relationships = EntityResolutionEngine(
        ResolutionConfig(max_projected_group_size=args.max_projected_group_size)
    ).resolve(dataset)
    result = GraphIntelligenceEngine(
        GraphIntelligenceConfig(
            minimum_connection_strength=args.minimum_connection_strength,
            community_seed=args.community_seed,
        )
    ).analyze(relationships)
    artifacts = (
        result.export_artifacts(args.output_dir, replace_existing=args.replace)
        if args.output_dir
        else {}
    )
    print(
        json.dumps(
            {
                "artifacts": {name: str(path) for name, path in artifacts.items()},
                "dataset_id": dataset.dataset_id,
                "summary": asdict(result.summary),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
