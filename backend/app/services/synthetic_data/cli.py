"""Command-line entry point for generating the Phase 1 demo dataset."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .config import GenerationConfig
from .generator import SyntheticDataGenerator
from .validation import validate_dataset


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate TVS JaalDrishti demo data")
    parser.add_argument("--output-dir", type=Path, default=Path("data/raw"))
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--normal-applications", type=int, default=5_000)
    parser.add_argument("--suspicious-ecosystems", type=int, default=100)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="replace only known generated dataset files in the output directory",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    config = GenerationConfig(
        seed=args.seed,
        normal_application_count=args.normal_applications,
        suspicious_ecosystem_count=args.suspicious_ecosystems,
    )
    dataset = SyntheticDataGenerator(config).generate()
    validation = validate_dataset(dataset)
    manifest_path = dataset.export_csv(args.output_dir, replace_existing=args.replace)
    print(
        json.dumps(
            {"manifest": str(manifest_path), "validation": validation},
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
