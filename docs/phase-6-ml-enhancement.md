# Phase 6 — ML Enhancement and Model Comparison

## Outcome

Phase 6 adds a reproducible ML challenger pipeline to the existing explainable risk engine. It builds a versioned application-level feature matrix, isolates suspicious ecosystems across train/validation/test partitions, trains Random Forest, XGBoost, and Isolation Forest, evaluates all candidates under class imbalance, persists the selected predictor, and supplies its probabilities to Phase 5 hybrid scoring.

The checked-in metrics are deterministic synthetic benchmark evidence, not a production performance claim.

## Feature contract and leakage controls

Feature schema `1.0.0` contains 38 numeric features from four approved families:

- borrower/application context: age, log income, credit score, log loan amount, loan-to-income ratio, and loan-type indicators;
- graph structure: centrality, component/community size, density, shared-identity counts, linked-applicant counts, and connection strength;
- temporal behavior: application velocity, device/dealer/account windows, network growth, link recency, and burst flags;
- explicit missing-recency indicators instead of non-finite sentinel values.

Scenario IDs, suspicious flags, pattern names, repayment outcome labels, and ground-truth fields are forbidden from the feature name contract. Tests enforce finite dimensions and reject evaluation-provenance fragments. Ground truth is read only to create the target vector and split-group metadata.

Suspicious rows are grouped by ecosystem ID before splitting, so members of one generated ring cannot appear in more than one partition. Normal applications are singleton groups. With seed 2026, the full dataset splits as follows:

| Split | Normal | Suspicious | Total |
|---|---:|---:|---:|
| Train | 3,000 | 347 | 3,347 |
| Validation | 1,000 | 112 | 1,112 |
| Test | 1,000 | 129 | 1,129 |

Model selection and threshold tuning use validation data only. Held-out test labels are evaluated after selection and do not influence the chosen model or threshold.

## Candidate models

- Random Forest uses balanced subsampling and deterministic tree construction.
- XGBoost uses training-split class weighting (`scale_pos_weight`) and the `aucpr` objective metric.
- Isolation Forest is fit only on normal training rows. Its anomaly score is mapped into `[0, 1]` using normal-training quantiles; labels are used only for validation threshold selection and evaluation.

Each classification threshold maximizes validation F1, breaking ties by precision, recall, and then the stricter threshold. Model selection is the highest validation PR-AUC, then validation F1, then a deterministic model-name tie-break.

PR-AUC is the primary ranking metric because suspicious applications are the minority class. Accuracy could appear strong while missing most suspicious networks; precision, recall, F1, confusion counts, and PR-AUC expose that trade-off directly.

## Full deterministic benchmark

Dataset: `jaaldrishti-seed-2026`, 5,588 applications, 38 features.

| Model | Validation PR-AUC | Test precision | Test recall | Test F1 | Test PR-AUC |
|---|---:|---:|---:|---:|---:|
| Random Forest | 0.9843 | 0.9474 | 0.9767 | 0.9618 | 0.9866 |
| XGBoost | **0.9908** | **0.9843** | **0.9690** | **0.9766** | **0.9949** |
| Isolation Forest | 0.8372 | 0.6816 | 0.9457 | 0.7922 | 0.8507 |

XGBoost `1.0.0` is selected. Its held-out confusion counts are 125 true positives, 2 false positives, 998 true negatives, and 4 false negatives at validation-selected threshold `0.59238714`.

The strongest XGBoost importances are temporal link recency, maximum graph connection strength, the temporal recency score, graph density, and shared-identity signal count. These are diagnostic importances, not causal explanations; the structured Phase 5 rule evidence remains the analyst explanation surface.

## Hybrid integration and artifacts

The selected predictor produces an application-ID-to-probability mapping. `RiskIntelligenceEngine` records `xgboost:1.0.0` on every enriched assessment and combines the ML probability with versioned rule, graph, and temporal scores. High-confidence rules retain their score floors, so a model probability cannot erase direct shared-entity evidence.

The full hybrid run produced 5,049 LOW, 51 MEDIUM, and 488 HIGH assessments, with 539 routed for human review. This distribution matches the calibrated Phase 5 action policy; Phase 6 adds the model component and version traceability.

`models/ecosystem-risk-model.joblib` is atomically written and intentionally ignored by Git. `models/ml-training-summary.json` is committed and records the binary checksum, model version, feature schema, splits, complete metrics, and evaluation scope. Existing artifacts are protected unless `--replace` is explicit.

## Reproduce

```bash
.venv/bin/python -m pip install -e 'backend[ml-xgboost]'
.venv/bin/jaal-train-ml \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --output-dir models \
  --risk-output-dir data/processed \
  --replace
```

Verification:

```bash
.venv/bin/ruff check backend tests/backend
.venv/bin/python -m unittest discover -s tests/backend -v
```

The combined backend suite has 47 passing tests. Twelve Phase 6 tests cover feature determinism, evaluation-field exclusion, group isolation, class coverage, three-model evaluation, normal-only anomaly training, validation-only selection, probability bounds, reproducibility, binary round-trip equivalence, checksum metadata, overwrite protection, and hybrid-score integration.

## Limitations before production

- All results use synthetic labels and generated network patterns; external and temporal out-of-sample validation is still required.
- Temporal features are calculated as of each submission. Graph features represent the analysis snapshot, so this is an ecosystem-detection benchmark rather than a historical graph backtest. Production training requires timestamped graph snapshots to guarantee point-in-time joins.
- Age is included because it is part of the approved brief. Fairness, legal, proxy, and subgroup-impact review must occur before any production use, and the feature can be removed without changing the scoring API.
- Native tree probabilities are not calibrated against real-world base rates. Production promotion requires probability calibration, drift monitoring, registry signatures, access controls, approval gates, and rollback support.
- Feature importance is global association, not a borrower-level reason or proof of wrongdoing. Human review remains mandatory for MEDIUM and HIGH actions.
