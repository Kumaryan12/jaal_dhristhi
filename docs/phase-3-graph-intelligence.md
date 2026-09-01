# Phase 3 — Graph Intelligence Engine

## Outcome

Phase 3 converts the Phase 2 relationship output into NetworkX graph structures and a versioned customer feature table. On the full seed-2026 population it produced:

| Measure | Result |
|---|---:|
| Heterogeneous nodes | 16,405 |
| Heterogeneous edges | 22,352 |
| Customer projection nodes | 5,588 |
| Customer projection edges | 78,609 |
| Connected components | 98 |
| Largest component | 908 customers |
| Weighted Louvain communities | 177 |
| Largest community | 54 customers |
| Overall customer graph density | 0.00503579 |
| Average linked applicants | 28.1349 |

The installed CLI completed generation, entity resolution, graph analysis, community detection, and artifact export in 1.39 seconds on the development machine. This is a local verification observation, not a production SLO.

## Architecture implemented

### Heterogeneous evidence graph

The NetworkX heterogeneous graph preserves customer, device, account, dealer, and location nodes together with the direct evidence edges created in Phase 2. Node and edge attributes remain available for network traversal and explainability.

### Weighted customer projection

The customer graph contains one node per applicant and one edge per resolved customer connection. Edge weight is the transparent Phase 2 connection strength; edge attributes retain all shared-entity evidence and relationship types:

- `shared_device`;
- `shared_account`;
- `same_dealer`;
- `same_location` when the entity is below the configured projection limit.

High-cardinality locations remain in the heterogeneous graph but do not create pairwise customer edges. The full dataset therefore avoids low-signal location cliques while preserving the original location evidence.

## Feature contract

Each customer receives the following graph feature vector:

| Feature | Definition |
|---|---|
| `degree_centrality` | Linked applicants divided by all other customer nodes |
| `connected_applicant_count` | Unique neighboring customers in the projection |
| `heterogeneous_degree` | Direct device/account/dealer/location relationships |
| `cluster_id` | Deterministic connected-component identifier |
| `cluster_size` | Customers in the connected component |
| `network_density` | Actual versus possible edges inside that component |
| `community_id` | Deterministic weighted Louvain community identifier |
| `community_size` | Customers in the detected community |
| `shared_identity_signal_count` | Distinct shared devices plus shared accounts |
| `shared_device_count` | Distinct shared devices |
| `shared_account_count` | Distinct shared accounts |
| `same_dealer_count` | Distinct shared dealers |
| `same_location_count` | Distinct projected shared locations |
| `shared_device_applicant_count_max` | Largest number of other applicants on one shared device |
| `shared_account_applicant_count_max` | Largest number of other applicants on one shared account |
| `max_connection_strength` | Strongest incident customer connection |
| `mean_connection_strength` | Mean incident connection strength |

Connected-component size and density are calculated once per component and mapped to its members. Degree centrality is calculated on the customer projection, so owning four ordinary entities does not artificially increase applicant centrality.

## Community detection

The engine uses NetworkX weighted Louvain community detection with configurable resolution and a fixed seed. Communities and components are sorted by their smallest customer identifier before stable IDs are assigned. Repeated analysis of the same relationship graph therefore produces identical feature rows.

## Evaluation observation

Ground truth is joined only after feature generation for offline verification; it is not available to the graph engine. The seed-2026 population showed:

| Mean feature | Normal | Suspicious |
|---|---:|---:|
| Connected applicants | 28.0648 | 28.7313 |
| Shared identity signals | 0.0410 | 0.9864 |
| Maximum shared-device applicants | 0.0228 | 2.7245 |
| Maximum shared-account applicants | 0.0188 | 2.4014 |
| Maximum connection strength | 0.1604 | 0.5459 |

Simple degree alone does not separate the populations because legitimate dealer groups also connect many applicants. Shared identity and connection-strength features expose a much clearer difference. This supports the planned hybrid scoring approach rather than treating any single graph metric as a fraud decision.

## Output artifacts

`GraphIntelligenceResult.export_artifacts` writes atomically and refuses accidental overwrite unless explicitly authorized:

- `data/processed/graph-features.csv` with one row per customer;
- `data/processed/graph-intelligence-summary.json` with feature schema `1.0.0`, row count, SHA-256 checksum, and graph summary.

The full run exported 5,588 rows and the recorded SHA-256 checksum matched the feature CSV after export.

## Files created or modified

- `backend/app/services/graph_intelligence/config.py`
- `backend/app/services/graph_intelligence/models.py`
- `backend/app/services/graph_intelligence/engine.py`
- `backend/app/services/graph_intelligence/cli.py`
- `backend/scripts/analyze_graph.py`
- `tests/backend/test_graph_intelligence.py`
- `backend/pyproject.toml` for NetworkX and the installed CLI
- project, data, and phase documentation

## Verification

```bash
.venv/bin/ruff check backend tests
.venv/bin/ruff format --check backend tests
PYTHONPATH=backend .venv/bin/python -m compileall -q backend/app backend/scripts tests/backend
PYTHONPATH=backend .venv/bin/python -m unittest discover -s tests/backend -v
.venv/bin/jaal-analyze-graph \
  --seed 2026 \
  --normal-applications 5000 \
  --suspicious-ecosystems 100 \
  --max-projected-group-size 80 \
  --output-dir data/processed \
  --replace
```

The combined backend suite has 18 passing tests. Six Phase 3 tests cover graph construction, exact centrality/component/density values, shared-identity features, deterministic communities, minimum-strength filtering, and protected versioned artifact export.

## Phase exit criteria

- NetworkX graph processing: passed.
- Degree centrality: passed.
- Connected-applicant and component size: passed.
- Shared identity signals: passed.
- Network density: passed.
- Deterministic community detection: passed.
- Versioned graph-based risk feature output: passed.
