"""End-to-end Phase 6 model training, evaluation, and hybrid scoring CLI."""

from __future__ import annotations

import argparse
import json
from dataclasses import asdict
from pathlib import Path

from app.services.entity_resolution import EntityResolutionEngine, ResolutionConfig
from app.services.graph_intelligence import GraphIntelligenceEngine
from app.services.risk_intelligence import RiskAssessmentBatch, RiskIntelligenceEngine
from app.services.synthetic_data import GenerationConfig, SyntheticDataGenerator, validate_dataset
from app.services.temporal_intelligence import TemporalIntelligenceEngine

from .artifacts import MLArtifactStore
from .feature_builder import MLFeatureMatrixBuilder
from .splitting import EcosystemGroupedSplitter
from .trainer import MLModelTrainer


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train JaalDrishti ecosystem-risk ML models")
    parser.add_argument("--seed", type=int, default=2026)
    parser.add_argument("--normal-applications", type=int, default=5_000)
    parser.add_argument("--suspicious-ecosystems", type=int, default=100)
    parser.add_argument("--max-projected-group-size", type=int, default=80)
    parser.add_argument("--output-dir", type=Path, default=Path("models"))
    parser.add_argument("--risk-output-dir", type=Path)
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
    graph_result = GraphIntelligenceEngine().analyze(relationships)
    temporal_result = TemporalIntelligenceEngine().analyze(dataset, relationships)
    feature_dataset = MLFeatureMatrixBuilder().build(dataset, graph_result, temporal_result)
    split = EcosystemGroupedSplitter().split(feature_dataset)
    training = MLModelTrainer().train(feature_dataset, split)

    probabilities = training.predictor.predict_probabilities(feature_dataset.values)
    probabilities_by_application = dict(
        zip(feature_dataset.application_ids, map(float, probabilities), strict=True)
    )
    assessments = RiskIntelligenceEngine().analyze_all(
        dataset,
        relationships,
        graph_result,
        temporal_result,
        model_probabilities=probabilities_by_application,
        model_version=training.predictor.model_version,
    )
    risk_batch = RiskAssessmentBatch.from_assessments(assessments)
    risk_artifacts = (
        risk_batch.export_artifacts(args.risk_output_dir, replace_existing=args.replace)
        if args.risk_output_dir
        else {}
    )
    artifacts = MLArtifactStore().save(
        training,
        args.output_dir,
        dataset_id=dataset.dataset_id,
        dataset_rows=len(feature_dataset.application_ids),
        hybrid_risk_summary=asdict(risk_batch.summary),
        replace_existing=args.replace,
    )
    print(
        json.dumps(
            {
                "artifacts": {name: str(path) for name, path in artifacts.items()},
                "risk_artifacts": {name: str(path) for name, path in risk_artifacts.items()},
                "training": training.summary_dict(),
                "hybrid_risk_summary": asdict(risk_batch.summary),
            },
            indent=2,
            sort_keys=True,
        )
    )


if __name__ == "__main__":
    main()
