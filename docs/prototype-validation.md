# Prototype Validation Benchmark

## Purpose

This benchmark provides a repeatable terminal comparison between an application-only reference screen and JaalDrishti. It exists to replace unverified presentation figures with measurements that can be regenerated from source.

The benchmark uses only synthetic records. It is an implementation validation, not a production fraud-performance study and not a representation of TVS Credit's current decision policy.

## Run it

After installing the backend from the repository root:

```bash
.venv/bin/jaal-validate-prototype \
  --output data/processed/prototype-validation-summary.json \
  --replace
```

The command prints a human-readable table to the terminal. Add `--json` for machine-readable standard output. The optional output artifact records the benchmark version, definitions, cohort counts, confusion-matrix counts, rates, and staged-detection distribution.

## Compared policies

### Application-only baseline

The reference baseline steps up an application when either:

- credit score is below `600`; or
- requested loan divided by annual income is at least `0.75`.

It uses only the individual borrower and application fields already represented in the JaalDrishti policy. It does not use shared entities, graph features, timing, repayment outcomes, ML output, or ground-truth fields. It is a transparent comparison policy, not a claim about an incumbent production system.

### JaalDrishti

The evaluated JaalDrishti decision is the existing `HIGH / enhanced verification` threshold. It combines explainable rules, graph features, and application-time temporal features. Model probability is deliberately omitted so the benchmark can be regenerated without fitting on or consulting the evaluated portfolio.

Ground truth is joined only after both policies have produced their flags.

## Metric definitions

| Metric | Definition |
|---|---|
| Suspicious-application recall | Flagged suspicious applications divided by all suspicious applications |
| False-positive rate | Flagged normal applications divided by all normal applications |
| Applications stepped up | All flagged applications divided by all applications |
| High-confidence ecosystem recall | Labelled ecosystems that reach a graph or burst HIGH-confidence trigger during staged replay |
| Detection point | Ordinal application at which a labelled ecosystem first reaches that HIGH-confidence trigger |

The individual-only baseline has no ecosystem model, so ecosystem recall and detection point are reported as not applicable instead of assigning it an invented detection capability.

## Seed-2026 result

| Metric | Application-only baseline | JaalDrishti |
|---|---:|---:|
| Suspicious-application recall | 23.30% (137/588) | **82.99% (488/588)** |
| False-positive rate | 18.26% (913/5,000) | **0.00% (0/5,000)** |
| Applications stepped up | 18.79% (1,050/5,588) | **8.73% (488/5,588)** |
| High-confidence ecosystem recall | N/A | **93.00% (93/100)** |
| Median ecosystem detection point | N/A | **Application 4** |

The mean staged detection point is application `4.19`: 75 ecosystems first trigger at application 4 and 18 first trigger at application 5. Seven four-member dealer-only ecosystems do not reach the five-application HIGH burst threshold; they can enter the MEDIUM review band but are correctly excluded from this HIGH-threshold comparison.

## Why these differ from the proposed slide values

The proposed `51% / 82% / 9.2% / 4.8% / 18% / 7%` figures did not have a defined cohort, baseline policy, decision threshold, or saved confusion matrix. On this portfolio, 51% recall and 9.2% false-positive rate would imply an overall step-up rate of about 13.6%, not 18%, if all figures used the same application-level denominator.

The repository therefore reports the measured results above and preserves every numerator and denominator. New values should be published only by changing a documented policy or dataset and regenerating the artifact.

## Leakage and interpretation boundaries

- `ground_truth` and `scenario_id` group results only after scoring; they never enter either policy.
- Repayment events occur after origination and are not used.
- Temporal features use events at or before the application timestamp.
- Staged detection reconstructs each labelled ecosystem in event order and applies the versioned HIGH-confidence shared-device, shared-account, dealer-burst, and device-burst thresholds.
- The generated population intentionally makes ecosystem members individually plausible, so an application-only policy has limited discriminatory value.
- Synthetic separation can be much cleaner than real lending data. Production claims require prospective validation, calibrated thresholds, fairness analysis, and independent model-risk review.
