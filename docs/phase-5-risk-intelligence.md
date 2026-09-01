# Phase 5 — Explainable Hybrid Risk Intelligence

## Outcome

Phase 5 converts borrower, graph, and temporal evidence into a versioned 0–100 ecosystem risk assessment. Every result includes structured signals, component scores, an enforced rule floor where applicable, a non-overlapping risk level, and a human-oriented recommended action.

The full seed-2026 population produced:

| Measure | Result |
|---|---:|
| Total assessments | 5,588 |
| LOW | 5,049 |
| MEDIUM | 51 |
| HIGH | 488 |
| Applications requiring review | 539 |
| MEDIUM/HIGH potential exposure | ₹111,700,000 |
| Mean score, normal applications | 2.5112 |
| Mean score, suspicious applications | 67.9568 |

The installed CLI completed data generation, validation, entity resolution, graph intelligence, temporal intelligence, scoring, and artifact export in 2.10 seconds on the development machine. This is a local observation, not a production SLO.

## Scoring architecture

### Explainable rule score

The rule engine emits `RiskSignal` objects rather than unexplained point totals. Every signal contains:

- a stable code and category;
- severity and human-readable message;
- observed value and configured threshold;
- points and optional minimum score floor;
- contributing entity IDs;
- time window where relevant.

Rules cover shared devices/accounts, rapid dealer/device bursts, emerging concentration, application velocity, network growth, strong multi-entity connections, multiple identity signals, credit score, and loan-to-income ratio.

### Continuous graph score

The graph component is capped at 100 and combines:

```text
min(40, maximum shared-device applicants × 10)
+ min(35, maximum shared-account applicants × 9)
+ min(10, distinct identity signals × 5)
+ maximum connection strength × 10
+ min(5, linked applicants ÷ 10)
```

Dealer degree alone has little weight because normal dealer groups also create legitimate connections.

### Continuous temporal score

The temporal component is capped at 100 and combines:

```text
min(35, excess two-hour velocity × 8.75)
+ min(25, linked applicants in 24 hours × 6.25)
+ min(20, network growth rate × 10)
+ recency score × 10
+ 10 when a rapid burst is detected
```

### Hybrid weights

Without a trained model, the current policy uses:

```text
50% rule score + 30% graph score + 20% temporal score
```

When Phase 6 supplies a probability and non-empty model version, the policy automatically uses:

```text
40% rule + 20% graph + 15% temporal + 25% ML probability
```

Probabilities outside `[0, 1]` and unversioned ML inputs are rejected. The Phase 5 CLI deliberately supplies no pseudo-model probability.

## High-confidence score floors

Weighted averaging must not erase direct evidence. The policy therefore applies transparent minimum floors:

| Signal | Floor |
|---|---:|
| Device linked to at least three other applicants | 72 |
| Account linked to at least three other applicants | 70 |
| Five-applicant dealer burst | 70 |
| Five-applicant device burst | 75 |
| Emerging 3–4 application concentration | 40 |

The final score is `max(weighted score, strongest triggered floor)`, capped at 100. The assessment exposes both values.

## Risk levels and actions

| Score | Level | Action |
|---|---|---|
| `0 <= score < 40` | LOW | Continue standard processing |
| `40 <= score < 70` | MEDIUM | Manual review recommended |
| `70 <= score <= 100` | HIGH | Enhanced verification required |

No result instructs an automated credit rejection. MEDIUM and HIGH actions explicitly require human review.

## Emerging-risk progression

The calibrated dealer-burst policy demonstrates time-aware escalation:

```text
First applicants -> LOW while evidence is insufficient
3–4 linked applicants -> MEDIUM manual review
5+ unique applicants in two hours -> HIGH enhanced verification
```

The engine does not retroactively raise earlier historical rows using future applications.

## Offline calibration

Ground truth was joined only after scoring. It never enters rules or feature inputs.

| Decision threshold | Precision | Recall |
|---|---:|---:|
| HIGH | 1.0000 | 0.8299 |
| MEDIUM or HIGH review | 0.9981 | 0.9150 |

Pattern results:

| Pattern | Applications | LOW | MEDIUM | HIGH | Mean score |
|---|---:|---:|---:|---:|---:|
| Dealer burst | 148 | 50 | 50 | 48 | 37.92 |
| Mixed ring | 140 | 0 | 0 | 140 | 86.00 |
| Shared account | 142 | 0 | 0 | 142 | 71.92 |
| Shared device | 158 | 0 | 0 | 158 | 76.54 |

One normal application entered MEDIUM review and none entered HIGH. These synthetic results validate the prototype logic but are not claims about production fraud performance.

## Repayment leakage control

Repayment events occur after origination, so the current application-time score does not use future payment outcomes. A later loan-management analysis can incorporate repayments only with an explicit later `as_of` cutoff. Ground-truth labels, ecosystem IDs, and generator segments remain inaccessible to the scorer.

## Output artifacts

`RiskAssessmentBatch.export_artifacts` writes atomically and refuses overwrite unless explicitly authorized:

- `risk-assessments.csv` for concise integrations;
- `risk-assessments.json` for complete structured explanations;
- `risk-intelligence-summary.json` with schema `1.0.0`, distribution, potential exposure, top signals, and both SHA-256 checksums.

All 5,588 exported CSV/JSON assessment rows and both recorded checksums were verified after the full run.

## Files created or modified

- `backend/app/services/risk_intelligence/config.py`
- `backend/app/services/risk_intelligence/models.py`
- `backend/app/services/risk_intelligence/rules.py`
- `backend/app/services/risk_intelligence/engine.py`
- `backend/app/services/risk_intelligence/cli.py`
- `backend/scripts/score_risk.py`
- `tests/backend/test_risk_intelligence.py`
- CLI registration and project/data/phase documentation

## Verification

```bash
.venv/bin/ruff check backend tests
.venv/bin/ruff format --check backend tests
PYTHONPATH=backend .venv/bin/python -m compileall -q backend/app backend/scripts tests/backend
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests/backend -v
.venv/bin/jaal-score-risk \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --max-projected-group-size 80 \
  --output-dir data/processed \
  --replace
```

The combined backend suite has 35 passing tests. Ten Phase 5 tests cover entity-specific explanations, HIGH and MEDIUM floors, LOW handling, ML input validation and weights, risk-band boundaries, end-to-end batch separation, unknown applications, and protected structured exports.

## Phase exit criteria

- Explainable rule engine: passed.
- Graph and temporal feature integration: passed.
- 0–100 score and LOW/MEDIUM/HIGH levels: passed.
- Structured reasons and entity evidence: passed.
- Recommended analyst action: passed.
- Versioned ML integration contract: passed; training remains Phase 6.
- Full dataset calibration and artifact verification: passed.
