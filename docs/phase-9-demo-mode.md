# Phase 9 — One-Click Emerging-Risk Demo

## Outcome

Phase 9 delivers the requested **Simulate Emerging Risk Ecosystem** journey. One click creates a fresh synthetic scenario, scores Customer A before network emergence, adds five connected applicants around a shared device and concentrated dealer, reruns entity resolution plus graph, temporal, and risk intelligence, and presents the resulting explanation and action.

For seed 2026, the computed transition is:

| State | Risk | Linked applicants | Shared-device applicants | Dealer applications in 2h |
|---|---:|---:|---:|---:|
| Before | 0.00 LOW | 0 | 1 | 1 |
| After | 85.43 HIGH | 5 | 6 | 6 |

These values are engine outputs, not browser constants.

## Backend journey

`POST /api/v1/demo/simulate` accepts an optional deterministic seed. `EmergingRiskSimulationService` generates one six-member shared-device ecosystem and selects its final application as Customer A. It then computes two datasets:

1. The before dataset contains the unchanged focus application, customer, device, account, dealer, and location context only.
2. The after dataset contains the complete connected ecosystem, with the five peer applications observed no later than Customer A's submission timestamp.

Both states pass through the existing `EntityResolutionEngine`, `GraphIntelligenceEngine`, `TemporalIntelligenceEngine`, and `RiskIntelligenceEngine`. No result is hardcoded and future applications never enter the focus application's temporal features.

The response includes the unique scenario namespace, before/after snapshots, newly introduced customers and relationships, a renderable network, ranked signal evidence, and the recommended action. Repeating a seed reproduces the evidence while returning a new namespace.

## Isolation guarantee

Simulation state is built and analysed in memory. It does not require an active portfolio, use the SQLite repository, write cached analyses, replace the current dataset, or alter dashboard metrics. Contract and journey tests compare the active summary before and after a simulation.

## Analyst experience

The `/demo` route provides:

- one explicit simulation control and an honest pre-run state;
- side-by-side LOW-to-HIGH risk cards;
- shared-device, linked-applicant, and dealer-burst evidence summaries;
- a React Flow rendering of the generated customers, device, dealer, and relationships;
- ranked explanations generated from evidence objects; and
- the computed enhanced-verification action plus the isolated scenario identifier.

The app-wide navigation now exposes Demo mode on desktop and mobile. The generated branded social card and Open Graph/X metadata reflect the product's established visual system and tagline.

## Verification

Backend verification covers the route schema, validation errors, deterministic evidence, unique namespaces, LOW-to-HIGH transition, expected relationship deltas, explanation codes, recommended action, and unchanged active state. A dedicated journey test exercises the full ASGI boundary with a live baseline dataset.

Frontend verification covers the typed mutation client, honest initial state, one-click interaction, rendered transition, key evidence, network handoff, explanation, and isolation notice.

At the Phase 9 checkpoint:

- 61 backend and cross-layer tests pass;
- 10 frontend tests pass;
- Python lint and compilation pass;
- frontend lint and the five-route production build pass; and
- the dependency audit reports zero known vulnerabilities.

## Deferred to Phase 10

Phase 10 owns the final README restructuring, release screenshots, system diagram, consolidated API examples, test-case catalog, and release-candidate verification.
