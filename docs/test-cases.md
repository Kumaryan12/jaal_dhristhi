# Test-Case Catalog

## Purpose

This catalog maps the automated suite to product behavior and risk controls. Exact tests remain executable specifications in `tests/backend`, `tests/e2e`, and `frontend/tests`.

## Backend and cross-layer coverage

| Area | Representative cases | Expected behavior |
|---|---|---|
| Synthetic generation | deterministic seed, table contract, ecosystem mix, plausibility, protected export | Same seed reproduces the same normalized records; ground truth stays outside source features |
| Entity resolution | direct links, shared evidence, linked applicants, high-cardinality suppression | Customers remain distinct while shared devices/accounts/dealers create weighted evidence |
| Graph intelligence | heterogeneous graph, projection, density, centrality, identity signals, communities | Features are finite, deterministic, versioned, and unaffected by evaluation labels |
| Temporal intelligence | dealer/device bursts, growth, recency, repeat applicants, future leakage | Windows use only events at or before each application timestamp |
| Risk intelligence | low baseline, emerging medium band, high-confidence floors, actions, optional ML | Scores stay in `0–100`; bands do not overlap; evidence floors cannot be erased by model output |
| ML foundation | finite features, grouped split, class coverage, provenance | Ecosystem members never cross split boundaries and labels never enter features |
| ML training | RF, XGBoost, Isolation Forest, selection, reproducibility | All candidates are evaluated; selection uses validation metrics; probabilities are finite |
| Model artifacts | checksum, round trip, schema compatibility, hybrid propagation | Only a compatible versioned artifact enters scoring |
| SQLite | transactional replace, ordered round trip, scoped analysis upsert | Partial state cannot become active and analyses remain dataset-scoped |
| API contract | OpenAPI paths, request IDs, validation, stable errors, bounded reads | Invalid input returns safe machine-readable envelopes without echoing sensitive values |
| Live monitor | bounded event count, scored records, entity identifiers, operational statuses | The activity feed is backend-derived and rejects out-of-range limits |
| Demo mode | LOW-to-HIGH transition, evidence codes, unique namespaces, active-state isolation | Each run is computed, repeatable by seed, separately namespaced, and non-mutating |
| End-to-end journey | populated portfolio plus Phase 9 mutation through ASGI | The demo escalates Customer A while portfolio metrics remain unchanged |

Backend/cross-layer count at the Phase 10 candidate: **62 passing tests**.

## Frontend coverage

| Area | Representative cases | Expected behavior |
|---|---|---|
| Typed API client | dashboard GET, stable errors, encoded network query, simulation POST | Requests use the configured base URL, bounded parameters, and deterministic seed body |
| Shared UI | risk labels and metric presentation | Risk semantics and portfolio figures render consistently |
| Live monitor | activity stream, graph projection, review status, portfolio context, investigation handoff | The operational workspace renders only returned API state and uses the focus customer for network context |
| Investigation | honest empty state, submit, explanation, action, network handoff | No result is invented before the API responds; evidence and navigation use returned identifiers |
| Network Intelligence | Signal view, low-specificity noise suppression, evidence narrative, Full graph control | The default graph prioritizes shared device/account/dealer context while preserving access to every returned node |
| Demo mode | explicit initial action, presentation view, LOW-to-HIGH rendering, process trace, evidence, network, isolation notice | One click renders the backend response, exposes the complete intelligence path, and never substitutes browser-side scoring |

Frontend count at the Phase 10 candidate: **14 passing tests**.

## Verification commands

```bash
PYTHONPATH=backend .venv/bin/ruff check backend tests
PYTHONPATH=backend .venv/bin/python -m compileall -q backend/app tests
PYTHONPATH=backend .venv/bin/python -W error::ResourceWarning \
  -m unittest discover -s tests -v

cd frontend
npm run lint
npm test
npm run build
npm audit
```

## Manual release checks

| Check | Acceptance |
|---|---|
| Live Monitor | Recent applications, relationship graph, intelligence queue, and computed portfolio snapshot load together |
| Investigation | `APP-S-005001` returns profile, HIGH evidence, and an action |
| Network | `CUS-S-005001` renders a bounded traversable graph |
| Dealer Intelligence | Dealer table supports selection and exposes concentration, exposure, and risk context |
| Analytics | Valid date range updates all charts; reversed range produces an actionable error |
| Demo | Presentation view hides navigation; one click renders the live process trace, LOW before, HIGH after, network evidence, and isolation notice |
| Responsive navigation | All six routes remain reachable at desktop and mobile widths |
| Keyboard | Inputs, buttons, links, and graph controls have visible focus and logical order |
| Reduced motion | The interface honors `prefers-reduced-motion` |
| Social metadata | Root title, description, Open Graph, and X card match TVS JaalDrishti |

Real browser screenshots and visual checks require the in-app browser capture surface; they must not be replaced with fabricated images.
