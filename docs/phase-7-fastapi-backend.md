# Phase 7 — FastAPI Backend

## Outcome

Phase 7 exposes the completed intelligence pipeline as a versioned FastAPI service. It validates requests with Pydantic, persists the active synthetic dataset and explicit application analyses in SQLite, rebuilds graph/temporal read models after restart, applies the trusted Phase 6 predictor when available, returns stable error envelopes, and publishes an OpenAPI contract.

This remains an intelligence layer beside a future LOS/LMS. It does not make or execute a credit decision.

## Implemented routes

| Method | Route | Behavior |
|---|---|---|
| GET | `/health` | Liveness, API version, and dataset readiness |
| POST | `/api/v1/generate_demo_data` | Generate, validate, persist, and compile a seeded ecosystem |
| POST | `/api/v1/analyse` | Analyse or explicitly refresh one application and persist the result |
| GET | `/api/v1/risk_score/{application_id}` | Return the latest stored versioned analysis |
| GET | `/api/v1/network/{customer_id}` | Return a time-filtered, depth-limited, node-capped heterogeneous projection |
| GET | `/api/v1/explanation/{application_id}` | Return borrower context, ranked signals, graph/temporal evidence, and action |
| GET | `/api/v1/dashboard/summary` | Return computed executive metrics with optional `as_of` cutoff |
| GET | `/api/v1/analytics` | Return bounded risk, dealer, and daily activity analytics |

The approved `POST /api/v1/demo/simulate` mutation is reserved for Phase 9 because it creates the isolated before/after scenario used by the one-click demo.

## Architecture decisions

### Thin HTTP boundary

Route handlers validate and map HTTP concerns only. `APIApplicationService` orchestrates the existing generator, entity resolution, graph intelligence, temporal intelligence, ML adapter, and hybrid risk engine. No authoritative score is recalculated in a response schema or future browser client.

### Transactional SQLite state

The active dataset metadata, every ordered source-table record, and explicit analyses are stored transactionally. A partial replacement cannot become active. `replace_existing=false` returns `409 DATASET_EXISTS`; replacement deletes the previous dataset and its analyses through foreign-key cascades in one transaction.

SQLite connections enable foreign keys and WAL, commit or roll back explicitly, and always close. The intelligence snapshot is an in-process read cache only: a new application instance reloads the ordered records and deterministically rebuilds relationships and features.

### Optional, contract-checked ML

The API attempts to load the configured trusted Joblib artifact. It enables ML only when both the feature schema version and exact ordered feature names match. Missing, unavailable, or incompatible artifacts fall back to versioned rule/graph/temporal scoring instead of fabricating a probability. Successful ML responses include the model version and component probability-derived score.

Joblib must never be used for untrusted uploads; production deployment should retrieve a signed artifact from a model registry.

### Stable failures and request tracing

Every request receives an `X-Request-ID`; a valid incoming correlation ID is preserved. Mutation responses and all error envelopes include that ID. Known state/entity failures use stable machine codes. Validation failures expose safe location/message/type records without echoing raw input values. Unexpected failures return a generic `500 INTERNAL_ERROR` and log only request metadata and exception type.

### Bounded reads

Network depth is limited to 1–3 and output to 25–500 nodes. Traversal and ordering are deterministic, and edges first observed after `as_of` are excluded. Analytics rejects reversed ranges and spans greater than 366 days; dealer output is limited to ten rows.

## Run locally

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e 'backend[ml-xgboost,test]'
.venv/bin/jaal-api --host 127.0.0.1 --port 8000
```

Useful locations:

- API explorer: `http://127.0.0.1:8000/docs`
- OpenAPI JSON: `http://127.0.0.1:8000/openapi.json`
- health: `http://127.0.0.1:8000/health`

The defaults are configurable with `JAALDRISHTI_DB_PATH`, `JAALDRISHTI_MODEL_PATH`, and comma-separated `JAALDRISHTI_CORS_ORIGINS`.

## Run with Docker

```bash
docker compose up --build backend
```

Compose mounts a named SQLite state volume and the local `models/` directory read-only. If the ignored Phase 6 binary has not been generated, the container remains operational without ML.

## Verification

```bash
.venv/bin/ruff check backend tests/backend
.venv/bin/python -m compileall -q backend/app
.venv/bin/python -W error::ResourceWarning -m unittest discover -s tests/backend -v
```

The combined backend suite has 58 passing tests. Eleven Phase 7 tests cover SQLite transactions/round trips, dataset replacement, analysis upserts, OpenAPI paths, request IDs, validation and conflict envelopes, explicit analysis/cache refresh, risk and explanation consistency, missing state/entities, bounded network traversal, dashboard/analytics computation, process restart, and versioned ML probability propagation.

## Measured full-data smoke test

On the development machine, a live in-process ASGI run used the real `xgboost:1.0.0` artifact and the standard seed-2026 dataset:

| Operation | Result |
|---|---:|
| Generate, persist, and compile 5,588 applications | 1.237 s |
| Analyse one suspicious application with ML | 21 ms |
| Return a capped 150-node network | 10 ms |
| Compute dashboard summary | 73 ms |
| Compute 354-day analytics response | 6 ms |

These are single-machine observations, not service-level guarantees. The analysed ecosystem member returned HIGH risk, included an ML component, and recorded `xgboost:1.0.0`.

## Production gaps

- Authentication and authorization are intentionally deferred to enterprise OIDC/RBAC integration.
- SQLite supports the single-instance demo; PostgreSQL and migration tooling are required for concurrent production writers.
- Expensive generation/retraining should move to authenticated background jobs with idempotency controls.
- Historical graph snapshotting remains necessary for true point-in-time backtests.
- Rate limiting, audit retention, structured telemetry, secrets management, signed artifacts, and deployment health/readiness separation remain release requirements.
- The API exposes synthetic demo borrower attributes. Real deployments require field-level authorization, masking, retention rules, and privacy review.
