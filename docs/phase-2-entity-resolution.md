# Phase 2 — Entity Resolution Engine

## Outcome

Phase 2 converts normalized lending records into a typed heterogeneous graph and a derived customer projection. On the complete seed-2026 dataset, the resolver produced:

| Measure | Result |
|---|---:|
| Entity nodes | 16,405 |
| Customer nodes | 5,588 |
| Device nodes | 5,284 |
| Account nodes | 5,309 |
| Dealer nodes | 200 |
| Location nodes | 24 |
| Direct customer–entity edges | 22,352 |
| Derived customer connections | 78,609 |
| Maximum linked applicants for one customer | 48 |
| High-cardinality projections suppressed | 24 |

The resolver completed the full in-memory analysis in 0.39 seconds on the development machine. Exporting and reparsing the complete 43.4 MiB JSON graph succeeded in 1.42 seconds. These timings are local verification observations, not production SLO claims.

## Architecture implemented

### Heterogeneous evidence graph

The resolver creates five typed node classes:

- customer;
- device;
- account;
- dealer;
- location.

It creates four direct, evidence-preserving edge types:

- `customer --uses_device--> device`;
- `customer --linked_account--> account`;
- `customer --applied_via--> dealer`;
- `customer --located_in--> location`.

Each direct edge has a deterministic identifier, first/last observation timestamps, event count, source application IDs where applicable, and relation-specific attributes. Repeated observations of the same customer/entity relation merge into one edge rather than producing duplicates.

### Customer projection

An inverted entity index discovers customers connected through the same entity. All shared evidence for a pair is aggregated into one `CustomerConnection` containing:

- source and target customer IDs;
- shared entity count;
- normalized connection strength;
- typed evidence entries and linked-customer count for each entity.

The transparent default strength formula is:

```text
strength = min(1.0,
    0.45 × shared devices
  + 0.35 × shared accounts
  + 0.15 × same dealers
  + 0.05 × same locations)
```

Weights live in `ResolutionConfig`; they are not UI constants. This score expresses relationship strength, not fraud/risk. Risk calibration remains a later phase.

### Per-customer metrics

The resolver calculates:

- unique linked-applicant count;
- distinct shared-entity count;
- maximum connection strength.

These become inputs to the Phase 3 graph-intelligence engine.

### High-cardinality control

Common entities remain in the heterogeneous graph but are excluded from pairwise projection when they connect more than 80 customers. This prevents one popular location or enterprise-scale dealer from creating a quadratic volume of weak customer edges.

The full dataset suppressed 24 location projections while retaining all 5,588 customer–location direct edges. Dealer, device, and account connections remained below the threshold. Suppressed entries are recorded with entity ID, type, group size, and reason, so the control is auditable rather than silent.

## Privacy and leakage controls

The resolver never reads `ground_truth` or `ecosystems`. Node attributes use explicit per-entity allowlists; unknown columns and fields such as `scenario_id`, `pattern_type`, and `is_suspicious` cannot flow into graph payloads. Tests inject evaluation labels and unrecognized metadata into source rows to verify this boundary.

## Files created or modified

- `backend/app/services/entity_resolution/config.py`
- `backend/app/services/entity_resolution/models.py`
- `backend/app/services/entity_resolution/resolver.py`
- `backend/app/services/entity_resolution/cli.py`
- `backend/scripts/resolve_entities.py`
- `tests/backend/test_entity_resolution.py`
- CLI registration and project/data documentation

## Verification

```bash
.venv/bin/ruff check backend tests
.venv/bin/ruff format --check backend tests
PYTHONPATH=backend python3 -m compileall -q backend/app backend/scripts tests/backend
PYTHONPATH=backend python3 -m unittest discover -s tests/backend -v
PYTHONPATH=backend python3 -m app.services.entity_resolution.cli \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --max-projected-group-size 80 \
  --graph-output data/processed/relationship-graph.json \
  --replace
```

The combined suite has 12 passing tests. Six Phase 2 tests cover evidence aggregation, connection strength, linked-applicant counts, high-cardinality suppression, label isolation, suspicious ecosystem resolution, and protected atomic graph export.

## Phase exit criteria

- Customer, device, account, dealer, and location nodes: passed.
- Customer-to-entity relationship edges: passed.
- Shared entity count and connection strength: passed.
- Number of linked applicants: passed.
- Relationship graph output: passed.
- Deterministic, explainable, and leakage-safe resolution: passed.
