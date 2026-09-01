# API Contract — Implemented in Phases 7, 9, and 10

The core contract below is implemented by `backend/app/main.py`. Interactive OpenAPI documentation is served at `/docs`; the JSON document is served at `/openapi.json`. Phase 9 adds the isolated `POST /api/v1/demo/simulate` journey; Phase 10 adds the scored activity feed used by the Live Monitor.

## Conventions

- Base path: `/api/v1`
- Content type: `application/json`
- Identifiers are opaque strings.
- Timestamps are ISO 8601 UTC strings.
- Successful mutations return a `request_id` for tracing.
- Errors use a stable machine code and a human-readable message.

```json
{
  "error": {
    "code": "APPLICATION_NOT_FOUND",
    "message": "No application exists for the supplied identifier.",
    "request_id": "req_01..."
  }
}
```

## Endpoint summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness and version |
| POST | `/api/v1/generate_demo_data` | Generate and persist a seeded synthetic dataset |
| POST | `/api/v1/analyse` | Run or refresh analysis for an application |
| GET | `/api/v1/risk_score/{application_id}` | Retrieve the latest versioned risk result |
| GET | `/api/v1/network/{customer_id}` | Retrieve a bounded network projection |
| GET | `/api/v1/explanation/{application_id}` | Retrieve ranked evidence and action |
| GET | `/api/v1/monitor/activity` | Retrieve recent scored activity for operational monitoring |
| GET | `/api/v1/dashboard/summary` | Retrieve executive metrics |
| GET | `/api/v1/analytics` | Retrieve risk, dealer, and temporal series |
| POST | `/api/v1/demo/simulate` | Materialize and analyse one emerging-risk scenario |

## Generate demo data

`POST /api/v1/generate_demo_data`

Request:

```json
{
  "seed": 2026,
  "normal_application_count": 5000,
  "suspicious_ecosystem_count": 100,
  "replace_existing": true
}
```

Response `201 Created`:

```json
{
  "dataset_id": "jaaldrishti-seed-2026",
  "seed": 2026,
  "counts": {
    "customers": 5588,
    "applications": 5588,
    "suspicious_ecosystems": 100
  },
  "generated_at": "2026-09-01T06:00:00Z",
  "generator_version": "1.0.0",
  "request_id": "req_01..."
}
```

The exact customer/application total above is illustrative; it is derived at runtime from scenario sizes and is never hardcoded in UI.

## Analyse an application

`POST /api/v1/analyse`

Request:

```json
{
  "application_id": "APP-S-005001",
  "force_refresh": false
}
```

Response `200 OK`:

```json
{
  "analysis_id": "analysis_01...",
  "application_id": "APP-S-005001",
  "customer_id": "CUS-S-005001",
  "risk_score": 72.0,
  "risk_level": "HIGH",
  "signals": [
    {
      "code": "SHARED_DEVICE_MANY_APPLICANTS",
      "message": "Device DEV-0004945 is linked to 8 applicants.",
      "severity": "HIGH",
      "category": "graph",
      "entity_ids": ["DEV-0004945"],
      "observed_value": 7,
      "threshold": 3,
      "points": 30.0,
      "score_floor": 72.0,
      "window": null
    }
  ],
  "recommended_action": {
    "code": "ENHANCED_VERIFICATION",
    "label": "Enhanced verification required",
    "rationale": "Validate shared-entity ownership and dealer evidence.",
    "human_review_required": true
  },
  "versions": {
    "feature_schema": "1.0.0",
    "temporal_feature_schema": "1.0.0",
    "risk_policy": "1.0.0",
    "model": "xgboost:1.0.0"
  },
  "analysed_at": "2026-09-01T06:05:00Z",
  "request_id": "req_01..."
}
```

## Get a risk score

`GET /api/v1/risk_score/{application_id}`

Returns the latest stored analysis using the same score, level, action, version, and timestamp fields as `/analyse`. It returns `404` when the application does not exist and `409 ANALYSIS_REQUIRED` when it exists but has not been analysed.

## Get a customer network

`GET /api/v1/network/{customer_id}?depth=2&max_nodes=150&as_of=2026-08-31T12:00:00Z`

`depth` is limited to 1–3 and `max_nodes` to 25–500. `as_of` defaults to the latest available snapshot.

Response `200 OK`:

```json
{
  "customer_id": "CUS-004281",
  "as_of": "2026-09-01T06:00:00Z",
  "summary": {
    "node_count": 19,
    "edge_count": 24,
    "linked_applicant_count": 8,
    "component_density": 0.14,
    "community_id": "community-17",
    "truncated": false
  },
  "nodes": [
    {
      "id": "CUS-004281",
      "type": "customer",
      "label": "Customer 4281",
      "risk_level": "HIGH",
      "is_focus": true
    },
    {
      "id": "DEV-0102",
      "type": "device",
      "label": "Device 0102",
      "risk_level": null,
      "is_focus": false
    }
  ],
  "edges": [
    {
      "id": "edge-01",
      "source": "CUS-004281",
      "target": "DEV-0102",
      "type": "uses_device",
      "strength": 1.0,
      "first_seen": "2026-08-31T10:00:00Z",
      "last_seen": "2026-09-01T05:00:00Z"
    }
  ],
  "request_id": "req_01..."
}
```

## Get an explanation

`GET /api/v1/explanation/{application_id}`

Returns the application/customer profile, ranked signal objects, graph and temporal evidence summaries, policy/model versions, and recommended action. Signal text is generated from its evidence object, not stored as an unexplained score label.

## Live monitor activity

`GET /api/v1/monitor/activity?limit=20`

`limit` is constrained to 5–100. The response returns the current `dataset_id`, recent applications in event-time order, and a `focus_customer_id` suitable for the relationship graph. Every event includes its application, customer, dealer, device, and account identifiers; amount; computed score and risk level; operational status; and highest-ranked signal code when one exists.

```json
{
  "dataset_id": "jaaldrishti-seed-2026",
  "events": [
    {
      "timestamp": "2026-08-31T10:00:00Z",
      "application_id": "APP-S-005001",
      "customer_id": "CUS-S-005001",
      "dealer_id": "DLR-0181",
      "device_id": "DEV-0004945",
      "account_id": "ACC-0005001",
      "loan_amount_inr": 95000,
      "risk_score": 82.0,
      "risk_level": "HIGH",
      "status": "Requires Review",
      "primary_signal": "SHARED_DEVICE_MANY_APPLICANTS"
    }
  ],
  "focus_customer_id": "CUS-S-005001",
  "data_timestamp": "2026-08-31T10:00:00Z",
  "request_id": "req_01..."
}
```

## Dashboard summary

`GET /api/v1/dashboard/summary?as_of=2026-09-01T06:00:00Z`

Returns computed `total_applications`, `detected_networks`, `high_risk_ecosystems`, and `potential_exposure`, including the currency code and data timestamp.

## Analytics

`GET /api/v1/analytics?from=2026-08-01&to=2026-09-01`

Returns risk-level distribution, top dealer clusters, and daily application/high-risk counts. Server-side limits prevent unbounded time-series responses.

## Simulate emerging risk

`POST /api/v1/demo/simulate`

Request:

```json
{
  "seed": 2026
}
```

Response `201 Created` contains a unique `scenario_id`, a before snapshot, an after snapshot, newly created entities/edges, the scenario network, ranked explanations, and the computed action. The standard seed produces the required Customer A transition from LOW to HIGH as five linked applicants emerge around one shared device and concentrated dealer within two hours.

Repeating the same seed reproduces the same source records, scores, evidence, and network inside a new scenario namespace. The simulation is computed in memory and neither reads nor overwrites the active baseline dataset or stored analyses.

Abridged standard-seed response:

```json
{
  "seed": 2026,
  "customer_label": "Customer A",
  "before": {
    "risk_score": 0.0,
    "risk_level": "LOW",
    "linked_applicant_count": 0,
    "shared_device_applicant_count": 1,
    "dealer_applications_2h": 1
  },
  "after": {
    "risk_score": 85.43,
    "risk_level": "HIGH",
    "linked_applicant_count": 5,
    "shared_device_applicant_count": 6,
    "dealer_applications_2h": 6
  },
  "recommended_action": {
    "code": "ENHANCED_VERIFICATION",
    "label": "Enhanced verification required",
    "human_review_required": true
  }
}
```

The complete response additionally includes a unique `scenario_id`, source identifiers, the full renderable network, created entities and edges, ranked signal objects, rationale, generation timestamp, and request ID.

## Status codes

- `200`: successful read or analysis
- `201`: generated a new dataset/scenario
- `400`: invalid generation or time-range parameters
- `404`: entity not found
- `409`: dataset/analysis state conflict
- `422`: schema validation failure
- `500`: unexpected internal error with a request ID, without leaking internals
