# Phase 8 — Enterprise Analyst Dashboard

## Outcome

Phase 8 delivers a responsive React and TypeScript analyst console backed by the Phase 7 API. It presents portfolio health, individual application evidence, traversable customer relationships, and bounded analytics without duplicating risk logic in the browser.

The interface is decision support only: it explains the intelligence service's score and recommended action, but it does not execute a lending decision.

## Implemented routes

| Route | Purpose | Primary API reads |
|---|---|---|
| `/` | Executive dashboard with the four requested metrics, 45-day activity trend, and risk-band mix | `/dashboard/summary`, `/analytics` |
| `/investigate` | Application lookup, borrower context, risk score, ranked signals, graph/temporal evidence, and recommended action | `/analyse`, `/explanation/{application_id}` |
| `/network` | Interactive, zoomable, draggable customer-device-dealer-account graph with bounded depth and node count | `/network/{customer_id}` |
| `/analytics` | Date-filtered risk distribution, dealer clusters, temporal trend, and dealer detail table | `/analytics` |

## Product and architecture decisions

### One typed API boundary

`frontend/lib/api.ts` owns request construction, error normalization, and typed response handling. Pages render backend outputs rather than recalculating risk, exposure, network counts, or recommendations. The API base URL is configured through `NEXT_PUBLIC_API_BASE_URL`.

### Honest operational states

Every data-backed view includes loading, empty, and actionable failure states. Investigation and network pages begin with explicit inputs instead of showing invented results. The standard seed identifiers are presented only as demo helpers.

### Analyst-oriented information hierarchy

The persistent deep-navy shell keeps the four workflows visible on desktop and exposes the same navigation on smaller screens. Risk levels share a consistent green/amber/red language, while blue and aqua identify neutral intelligence and graph context.

### Bounded graph and analytics interactions

The network explorer constrains depth to 1–3 and maximum output to 150 nodes in the UI. React Flow supplies pan, zoom, minimap, fit-to-view, and selectable relationships. Analytics date filters are sent to the server, preserving the Phase 7 validation and 366-day bound.

### Accessibility and responsive behavior

Inputs are labelled, interactive elements have visible keyboard focus, chart meaning is reinforced by labels and tables, and reduced-motion preferences are honored. Layouts collapse from the desktop sidebar/grid treatment into mobile-safe stacked views and bottom navigation.

## Run locally

Start a populated Phase 7 API on `127.0.0.1:8000`, then:

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`. For the standard seed-2026 dataset, use application `APP-S-005001` and customer `CUS-S-005001` to exercise a suspicious ecosystem.

## Verification

```bash
cd frontend
npm run lint
npm test
npm run build
npm audit
```

Phase 8 includes seven frontend tests covering API query/response behavior, stable error normalization, investigation loading/result states, risk labels, and metric presentation. The production build emits all four routes. The final dependency audit reports zero known vulnerabilities.

The local live smoke test returned HTTP 200 for `/`, `/investigate`, `/network`, and `/analytics` against a Phase 7 API populated with the full 5,588-application seed-2026 dataset.

## Deferred to later phases

- Phase 9 owns the one-click, isolated emerging-risk simulation and its computed before/after journey.
- Phase 10 owns release screenshots, final diagrams, complete end-to-end verification, and production deployment guidance.
- Enterprise OIDC/RBAC, masking, audit retention, and an externally hosted API remain production integration work; the browser client does not pretend those controls exist.
