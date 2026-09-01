# TVS JaalDrishti

> Detect the network before it becomes the loss.

TVS JaalDrishti is an explainable risk-intelligence layer for lending teams. It augments an existing loan-origination or loan-management system by turning application ecosystem data into a temporal relationship graph, detecting emerging risky networks, and explaining the recommended action to an analyst.

The product is deliberately **not** a generic fraud detector or a banking application. Its core proposition is:

> Individual Risk != Ecosystem Risk

## Project status

Phase 0 is approved and Phase 1 synthetic data generation is complete. The repository can reproducibly generate and validate a full lending ecosystem with 5,000 normal applications and 100 suspicious networks.

- [System architecture](docs/architecture.md)
- [API contract](docs/api-contract.md)
- [Data model](docs/data-model.md)
- [Phase plan and approval record](docs/phase-plan.md)
- [Phase 1 implementation report](docs/phase-1-synthetic-data.md)

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
