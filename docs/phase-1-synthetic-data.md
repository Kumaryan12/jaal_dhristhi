# Phase 1 — Synthetic Data Generation

## Outcome

Phase 1 provides a deterministic Python generator for a realistic lending ecosystem. The verified seed-2026 dataset contains:

| Measure | Result |
|---|---:|
| Normal applications | 5,000 |
| Suspicious applications | 588 |
| Suspicious ecosystems | 100 |
| Customers | 5,588 |
| Devices | 5,284 |
| Bank accounts | 5,309 |
| Dealers | 200 |
| Locations | 24 |
| Repayment events | 23,987 |

Each suspicious pattern family appears in 25 ecosystems. Ecosystem sizes range from four to eight applicants.

## Architecture implemented

- `GenerationConfig` validates the seed, population sizes, sharing rates, ecosystem sizes, dealer pools, and timezone-aware snapshot date.
- `SyntheticDataGenerator` creates normalized source tables and isolated evaluation tables in a stable order.
- `SyntheticDataset` provides deterministic manifests, SHA-256 checksums, atomic CSV writes, and overwrite protection.
- `validate_dataset` enforces uniqueness, foreign keys, value ranges, timezone correctness, ownership coverage, label coverage, pattern evidence, dealer concentration, and two-hour burst bounds.
- The CLI generates, validates, and exports in one operation. Invalid data is never exported.

The implementation uses only the Python standard library in this phase, keeping generation portable and fast. Future graph and ML dependencies remain isolated from data generation.

## Population design

Normal applications have mostly independent devices and bank accounts, a broad dealer distribution, realistic loan-type/amount ranges, varied timestamps, credit profiles, and repayment histories. Small benign household device and joint-account sharing rates ensure shared identity is not automatically treated as suspicious.

Suspicious applicants remain individually plausible: in the verified dataset, their average credit score is 706.43 versus 711.64 for normal applicants. Ecosystem membership is revealed through relationships and timing rather than an obviously poor individual profile.

The 100 suspicious ecosystems rotate evenly through:

1. Shared-device clusters.
2. Shared-account clusters.
3. Dealer-concentrated application bursts.
4. Mixed rings combining multiple shared signals.

Every suspicious ecosystem includes a concentrated dealer and completes its application burst within two hours. Shared-device/account evidence is added according to the pattern family.

## Leakage controls

`ground_truth.csv` and `ecosystems.csv` are the only tables containing scenario membership or pattern labels. Operational-looking tables contain no `is_suspicious`, `pattern_type`, `scenario_id`, or generator-segment column. A dedicated automated test guards this boundary.

The ground-truth scenario identifier will later be used only to keep entire ecosystems within one train/validation/test split, preventing members of the same ring from leaking across evaluation partitions.

## Files created or modified

- `backend/pyproject.toml`
- `backend/app/services/synthetic_data/`
- `backend/scripts/generate_demo_data.py`
- `tests/backend/test_synthetic_data.py`
- `data/README.md`
- `data/raw/manifest.json`
- project status and data-model documentation

Bulk generated CSV files are ignored by Git. They can be reproduced byte-for-byte from the committed code, seed, and parameters; their checksums are retained in the manifest.

## Verification

```bash
PYTHONPATH=backend python3 -m compileall -q backend/app backend/scripts tests/backend
PYTHONPATH=backend python3 -m unittest discover -s tests/backend -v
.venv/bin/ruff check backend tests
.venv/bin/ruff format --check backend tests
PYTHONPATH=backend python3 -m app.services.synthetic_data.cli \
  --output-dir data/raw \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --replace
```

Six tests cover deterministic generation, full cross-table validation, individual plausibility, pattern coverage, label isolation, and atomic export/overwrite protection.

## Phase exit criteria

- At least 5,000 normal applications: passed.
- At least 100 suspicious ecosystems: passed.
- Required customer/application/device/account/dealer/location/repayment data: passed.
- Device, dealer, account, and temporal-burst suspicious patterns: passed.
- Deterministic generation and inspectable output: passed.
- Automated data quality tests: passed.
