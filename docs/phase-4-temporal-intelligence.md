# Phase 4 — Temporal Intelligence

## Outcome

Phase 4 adds leakage-safe application velocity, emerging-network growth, recency, and burst detection. On the full seed-2026 population it produced:

| Measure | Result |
|---|---:|
| Application feature rows | 5,588 |
| Rapid-burst application flags | 188 |
| Rapid-burst rate | 3.3644% |
| Peak two-hour application velocity | 8 |
| Peak dealer applications in two hours | 8 |
| Peak device applications in two hours | 8 |
| Peak account applications in 24 hours | 8 |
| Mean network growth rate | 0.1825 |
| Mean recency score | 0.183474 |

The installed CLI completed generation, validation, entity resolution, temporal analysis, and artifact export in 1.15 seconds on the development machine. This is a local observation, not a production SLO.

## Point-in-time architecture

Every feature row uses the application’s `submitted_at` value as its cutoff. Indexed range queries use only events whose timestamps are less than or equal to that cutoff. Device and account relationships are usable only when their own `first_seen_at` is also less than or equal to the cutoff.

This produces the intended emerging-risk sequence:

```text
Applicant 1 -> dealer count 1 -> no burst
Applicant 2 -> dealer count 2 -> no burst
Applicant 3 -> dealer count 3 -> no burst
Applicant 4 -> dealer count 4 -> no burst
Applicant 5 -> dealer count 5 -> rapid dealer burst
```

The engine cannot use applicants 2–5 to raise applicant 1’s historical score. This constraint is enforced by tests.

## Rolling indexes

Applications are sorted by timestamp and indexed independently by dealer, device, account, and customer. Window queries use binary search over timestamp arrays rather than scanning all applications for every feature row.

Resolved entity relationships feed the device/account indexes. The temporal engine never reads `ground_truth` or `ecosystems`.

## Feature contract

| Feature | Definition |
|---|---|
| `applications_same_device_2h` | Maximum applications on any valid customer device in the trailing two hours |
| `applications_same_dealer_2h` | Applications through the dealer in the trailing two hours |
| `applications_same_account_24h` | Maximum applications linked to an account in the trailing 24 hours |
| `customer_applications_30d` | Focus customer’s applications in the trailing 30 days |
| `application_velocity_2h` | Unique applications sharing dealer, device, or account in two hours |
| `linked_applicants_24h` | Other unique applicants on shared entities in 24 hours |
| `network_prior_applicants_30d` | Other unique linked applicants in the earlier baseline window |
| `network_growth_rate_24h` | Recent linked applicants divided by `max(1, prior applicants)` |
| `hours_since_latest_link` | Hours since the latest other linked applicant, or null when none exists |
| `recency_score` | Half-life decay `2^(-hours / 24)` |
| `rapid_burst_detected` | Whether a qualifying unique-applicant burst exists |
| `burst_signal_types` | Stable evidence codes such as `dealer_2h` and `device_2h` |

All durations, half-life, and burst thresholds live in `TemporalIntelligenceConfig`.

## Unique-applicant burst rule

A rapid burst requires at least five unique applicants at one dealer or on one device within two hours. Five repeat submissions by one customer increase customer velocity but do not trigger a coordinated-network burst.

Account activity is measured over 24 hours and contributes to general velocity/growth features. It is not labelled a two-hour rapid burst unless future policy explicitly adds an account-specific threshold.

## Offline evaluation observation

Ground truth was joined only after feature generation. With a five-applicant rapid-burst threshold:

| Evaluation measure | Result |
|---|---:|
| True-positive application flags | 188 |
| False-positive application flags | 0 |
| Precision | 1.0000 |
| Application-level recall | 0.3197 |

The lower application-level recall is expected for point-in-time detection: early members of a ring precede the evidence that makes the burst visible, and four-member ecosystems never reach a five-applicant rule. Continuous temporal features still provide earlier supporting evidence:

| Mean feature | Normal | Suspicious |
|---|---:|---:|
| Two-hour application velocity | 1.0080 | 3.6395 |
| Linked applicants in 24 hours | 0.0840 | 2.8435 |
| Network growth rate | 0.0490 | 1.3173 |
| Recency score | 0.1073 | 0.8314 |

This demonstrates why Phase 5 should combine rules, graph relationships, and continuous temporal signals rather than rely on one burst flag.

## Output artifacts

`TemporalIntelligenceResult.export_artifacts` writes atomically and refuses overwrite unless explicitly authorized:

- `data/processed/temporal-features.csv` with one row per application;
- `data/processed/temporal-intelligence-summary.json` with schema `1.0.0`, row count, SHA-256 checksum, and aggregate metrics.

The full run exported 5,588 rows and its recorded checksum matched the feature CSV after export.

## Files created or modified

- `backend/app/services/temporal_intelligence/config.py`
- `backend/app/services/temporal_intelligence/models.py`
- `backend/app/services/temporal_intelligence/engine.py`
- `backend/app/services/temporal_intelligence/cli.py`
- `backend/scripts/analyze_temporal.py`
- `tests/backend/test_temporal_intelligence.py`
- CLI registration, data contract, and phase documentation

## Verification

```bash
.venv/bin/ruff check backend tests
.venv/bin/ruff format --check backend tests
PYTHONPATH=backend .venv/bin/python -m compileall -q backend/app backend/scripts tests/backend
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests/backend -v
.venv/bin/jaal-analyze-temporal \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --max-projected-group-size 80 \
  --rapid-burst-min-applicants 5 \
  --output-dir data/processed \
  --replace
```

The combined backend suite has 25 passing tests. Seven Phase 4 tests cover point-in-time burst detection, no-future-event guarantees, shared device/account windows, growth and recency math, repeated-customer protection, deterministic and empty inputs, and protected versioned artifact export.

## Phase exit criteria

- Rapid application burst detection: passed.
- Application velocity: passed.
- Emerging-network growth rate: passed.
- Recency score: passed.
- Point-in-time leakage prevention: passed.
- Versioned temporal risk feature output: passed.
