# TVS JaalDrishti

> Detect the network before it becomes the loss.

TVS JaalDrishti is an explainable risk-intelligence layer for lending teams. It augments an existing loan-origination or loan-management system by turning application ecosystem data into a temporal relationship graph, detecting emerging risky networks, and explaining the recommended action to an analyst.

The product is deliberately **not** a generic fraud detector or a banking application. Its core proposition is:

> Individual Risk != Ecosystem Risk

## Project status

Phases 0–4 are complete. The repository can generate a lending ecosystem, resolve hidden relationships, calculate NetworkX graph features, and detect emerging time-aware application patterns without reading future events.

- [System architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [Data model](docs/data-model.md)
- [Phase plan and approval record](docs/phase-plan.md)
- [Phase 1 implementation report](docs/phase-1-synthetic-data.md)
- [Phase 2 implementation report](docs/phase-2-entity-resolution.md)
- [Phase 3 implementation report](docs/phase-3-graph-intelligence.md)
- [Phase 4 implementation report](docs/phase-4-temporal-intelligence.md)

## Proposed technology

- React, TypeScript, Tailwind CSS, React Flow, and Recharts for the analyst console
- FastAPI and Pydantic for the HTTP API and typed contracts
- Python, pandas, NetworkX, scikit-learn, and optional XGBoost for intelligence modules
- SQLite for portable demo persistence, with generated CSV snapshots for inspection
- Pytest and Vitest/Testing Library for automated verification

## Generate Phase 1 data

```bash
PYTHONPATH=backend python3 -m app.services.synthetic_data.cli \
  --output-dir data/raw \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100
```

See [data/README.md](data/README.md) for the generated table contract and overwrite behavior.

## Resolve the relationship graph

```bash
PYTHONPATH=backend python3 -m app.services.entity_resolution.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --graph-output data/processed/relationship-graph.json
```

Omit `--graph-output` to calculate and print only the graph summary.

## Generate graph intelligence features

```bash
PYTHONPATH=backend python3 -m app.services.graph_intelligence.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --output-dir data/processed
```

This writes a versioned customer feature table and compact checksum summary. The engine calculates graph features only; final risk scoring begins in Phase 5.

## Generate temporal intelligence features

```bash
PYTHONPATH=backend python3 -m app.services.temporal_intelligence.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --output-dir data/processed
```

Each row is calculated as of its application submission timestamp. Later applications never contribute to earlier feature rows.
