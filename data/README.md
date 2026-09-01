# Synthetic Data

Phase 1 generates normalized synthetic lending ecosystem tables under `data/raw/`. Bulk outputs are ignored by Git; this documentation and small future fixtures remain versioned.

## Generate the full dataset

From the repository root:

```bash
PYTHONPATH=backend python3 -m app.services.synthetic_data.cli \
  --output-dir data/raw \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100
```

Use `--replace` to overwrite only the known generated CSV and manifest files. The exporter does not delete the output directory or unrelated files.

## Outputs

- `customers.csv`
- `applications.csv`
- `devices.csv` and `customer_devices.csv`
- `bank_accounts.csv` and `customer_accounts.csv`
- `dealers.csv`
- `locations.csv`
- `repayments.csv` and `repayment_summaries.csv`
- `ecosystems.csv`
- `ground_truth.csv`
- `manifest.json` with seed, version, counts, patterns, and SHA-256 checksums

`ground_truth.csv` and `ecosystems.csv` are generator/evaluation provenance. Scenario membership and generator segments are deliberately absent from operational-looking source tables, preventing label leakage into future feature matrices.

## Population design

Normal applications use broadly independent devices and accounts, distributed dealers, varied submission times, and low-rate benign household sharing. Suspicious ecosystems contain 4–8 individually plausible customers linked through shared infrastructure, a concentrated dealer, and a two-hour application burst. Pattern families cover shared devices, shared accounts, dealer bursts, and mixed rings.

All names, identifiers, locations, and financial records are synthetic. No TVS or real customer data is present.

## Resolve relationships

Phase 2 can materialize a complete heterogeneous graph and customer projection:

```bash
PYTHONPATH=backend python3 -m app.services.entity_resolution.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --graph-output data/processed/relationship-graph.json
```

The large graph JSON is reproducible and ignored by Git. It includes typed nodes, direct customer–entity edges, aggregated customer connections, per-customer resolution metrics, and any high-cardinality entities suppressed from pairwise projection.

## Generate graph intelligence features

```bash
PYTHONPATH=backend python3 -m app.services.graph_intelligence.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --output-dir data/processed
```

Outputs:

- `graph-features.csv`: one point-in-time-ready feature row per customer;
- `graph-intelligence-summary.json`: feature schema version, row count, CSV checksum, and graph-level metrics.

The bulk feature CSV is ignored by Git. The compact summary is committed as reproducibility evidence.
