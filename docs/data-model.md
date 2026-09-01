# Phase 0 — Data Model and Feature Contract

## Design goals

The storage model retains source-like normalized records while derived graphs and feature tables remain reproducible outputs. Identifiers are synthetic opaque strings. All event timestamps are stored in UTC.

## Source tables

### customers

| Column | Type | Constraints / meaning |
|---|---|---|
| `customer_id` | string | Primary key |
| `age` | integer | 18–75 in generated data |
| `income` | decimal | Annual income, INR |
| `location_id` | string | Foreign key to locations |
| `credit_score` | integer | Generated bureau-like score |
| `created_at` | timestamp | Record creation time |

### applications

| Column | Type | Constraints / meaning |
|---|---|---|
| `application_id` | string | Primary key |
| `customer_id` | string | Foreign key to customers |
| `loan_amount` | decimal | Requested principal, INR |
| `loan_type` | enum | Two-wheeler, three-wheeler, used vehicle, consumer durable |
| `dealer_id` | string | Foreign key to dealers |
| `submitted_at` | timestamp | Event time used for point-in-time analysis |
| `scenario_id` | string/null | Synthetic ecosystem provenance; never exposed as a risk feature |

`scenario_id` is ground-truth metadata for generation and evaluation only. It must not enter model features or production analysis.

### devices

| Column | Type | Constraints / meaning |
|---|---|---|
| `device_id` | string | Primary key |
| `device_type` | enum | Android, iOS, web |
| `first_seen_at` | timestamp | First observed event |

### customer_devices

| Column | Type | Constraints / meaning |
|---|---|---|
| `customer_id` | string | Composite key, foreign key |
| `device_id` | string | Composite key, foreign key |
| `first_seen_at` | timestamp | Relationship validity start |
| `last_seen_at` | timestamp | Most recent observation |

### bank_accounts

| Column | Type | Constraints / meaning |
|---|---|---|
| `account_id` | string | Primary key; tokenized synthetic identifier |
| `bank_code` | string | Synthetic bank code |
| `opened_at` | date | Account age input |

### customer_accounts

| Column | Type | Constraints / meaning |
|---|---|---|
| `customer_id` | string | Composite key, foreign key |
| `account_id` | string | Composite key, foreign key |
| `relationship_type` | enum | primary, joint, observed repayment source |
| `first_seen_at` | timestamp | Relationship validity start |

### dealers

| Column | Type | Constraints / meaning |
|---|---|---|
| `dealer_id` | string | Primary key |
| `location_id` | string | Foreign key to locations |
| `dealer_type` | enum | Authorized, independent |

The application’s dealer association is stored on `applications`; there is no permanent customer ownership relation.

### locations

| Column | Type | Constraints / meaning |
|---|---|---|
| `location_id` | string | Primary key |
| `city` | string | Synthetic city |
| `state` | string | Synthetic state |
| `postal_zone` | string | Coarsened synthetic area; avoids street-level data |

### repayments

| Column | Type | Constraints / meaning |
|---|---|---|
| `repayment_id` | string | Primary key |
| `application_id` | string | Foreign key to applications |
| `due_at` | date | Installment due date |
| `paid_at` | date/null | Actual payment date |
| `amount_due` | decimal | Scheduled amount |
| `amount_paid` | decimal | Observed amount |
| `status` | enum | on_time, late, missed |

`payment_history` and `default_status` from the brief are derived customer/application summaries, while the normalized installment events above support temporal analysis without opaque list columns.

## Derived entity graph

### Node types

- `customer`
- `device`
- `account`
- `dealer`
- `location`

### Direct edge types

- `customer --uses_device--> device`
- `customer --linked_account--> account`
- `customer --applied_via--> dealer` (time-stamped by application)
- `customer --located_in--> location`

### Customer projection edge types

Two customers can be connected by one projected edge containing a set of evidence types:

- `shared_device`
- `shared_account`
- `same_dealer`
- `same_location`

The projection retains evidence IDs, first/last observation time, event count, and connection strength. Same location alone receives low weight because it is common; exact weights are configured and calibrated in the risk phase.

## Suspicious ecosystem generation

At least 100 ecosystems are generated across composable patterns:

- one device shared by several otherwise unrelated customers;
- one bank account observed across multiple customers;
- unusual concentration through a dealer;
- five or more applications in a short dealer/device window;
- mixed rings combining shared entities and repayment stress.

Normal data includes limited benign sharing (for example joint accounts or household devices) so the task is not trivial. Population distributions, ecosystem size, timing, and noise rates are controlled by a seeded configuration.

## Ground truth

Separate evaluation metadata stores:

| Column | Meaning |
|---|---|
| `application_id` | Labelled unit |
| `is_suspicious` | Synthetic target |
| `scenario_id` | Ring/group used for split isolation |
| `pattern_types` | Generator patterns that created the label |

Ground truth is inaccessible to scoring services and appears only in training/evaluation code.

## Graph feature contract

Each application gets point-in-time features calculated with `event_time <= submitted_at`:

- `customer_degree_centrality`
- `linked_applicant_count`
- `connected_component_size`
- `shared_device_applicant_count`
- `shared_account_applicant_count`
- `dealer_applicant_count`
- `location_applicant_count`
- `component_density`
- `community_size`
- `connection_strength_max`
- `connection_strength_mean`

## Temporal feature contract

- `applications_same_device_2h`
- `applications_same_dealer_2h`
- `applications_same_account_24h`
- `customer_applications_30d`
- `component_new_nodes_24h`
- `component_growth_rate_7d`
- `hours_since_latest_link`
- `recency_score`

Window durations will live in versioned configuration and appear in explanation evidence.

## Customer and repayment feature contract

- `age`
- `annual_income`
- `loan_to_income_ratio`
- `credit_score`
- `account_age_days`
- `late_payment_ratio`
- `missed_payment_count_12m`

Protected or proxy-sensitive attributes are excluded from scoring. Age is included because the supplied brief requires it, but evaluation will report its impact and it can be removed from model inputs without changing the API.

## Analysis result tables

`analysis_runs` stores the application, as-of time, final score/level, action code, snapshot and version identifiers. `analysis_signals` stores ranked structured evidence. Feature vectors are stored separately so an auditor can reproduce a score without scraping prose.

## Data quality checks

- primary and foreign keys are valid;
- income, age, amount, score, and timestamps respect allowed ranges;
- relationship validity has `first_seen_at <= last_seen_at`;
- application analysis never reads future events;
- normal/suspicious counts meet the generation request;
- scenario IDs never appear in the model feature matrix;
- generated distributions and label balance are recorded in a manifest.
