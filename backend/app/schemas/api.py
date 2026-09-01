"""Versioned request and response models for the JaalDrishti HTTP API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

Identifier = str
RiskLevel = Literal["LOW", "MEDIUM", "HIGH"]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorDetail(ContractModel):
    code: str
    message: str
    request_id: str
    details: dict[str, Any] | None = None


class ErrorResponse(ContractModel):
    error: ErrorDetail


class HealthResponse(ContractModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    dataset_ready: bool


class GenerateDemoDataRequest(ContractModel):
    seed: int = Field(default=2026, ge=0, le=2_147_483_647)
    normal_application_count: int = Field(default=5_000, ge=1, le=25_000)
    suspicious_ecosystem_count: int = Field(default=100, ge=1, le=2_000)
    replace_existing: bool = False


class DatasetCounts(ContractModel):
    customers: int = Field(ge=0)
    applications: int = Field(ge=0)
    suspicious_ecosystems: int = Field(ge=0)


class GenerateDemoDataResponse(ContractModel):
    dataset_id: Identifier
    seed: int
    counts: DatasetCounts
    generated_at: str
    generator_version: str
    request_id: str


class AnalyseRequest(ContractModel):
    application_id: Identifier = Field(min_length=1, max_length=80, pattern=r"^[A-Za-z0-9_.:-]+$")
    force_refresh: bool = False


class SignalResponse(ContractModel):
    code: str
    category: str
    severity: str
    message: str
    entity_ids: list[Identifier]
    observed_value: Any
    threshold: Any
    points: float
    score_floor: float
    window: str | None


class RecommendedActionResponse(ContractModel):
    code: str
    label: str
    rationale: str
    human_review_required: bool


class AnalysisVersionsResponse(ContractModel):
    feature_schema: str
    temporal_feature_schema: str
    risk_policy: str
    model: str | None


class ScoreComponentsResponse(ContractModel):
    rule_score: float
    graph_score: float
    temporal_score: float
    ml_score: float | None
    weights: dict[str, float]
    weighted_score: float
    enforced_floor: float
    final_score: float


class AnalysisResponse(ContractModel):
    analysis_id: Identifier
    application_id: Identifier
    customer_id: Identifier
    risk_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    signals: list[SignalResponse]
    recommended_action: RecommendedActionResponse
    score_components: ScoreComponentsResponse
    versions: AnalysisVersionsResponse
    analysed_at: str
    request_id: str


class NetworkSummaryResponse(ContractModel):
    node_count: int
    edge_count: int
    linked_applicant_count: int
    component_density: float
    community_id: str
    truncated: bool


class NetworkNodeResponse(ContractModel):
    id: Identifier
    type: str
    label: str
    risk_level: RiskLevel | None
    is_focus: bool


class NetworkEdgeResponse(ContractModel):
    id: Identifier
    source: Identifier
    target: Identifier
    type: str
    strength: float
    first_seen: str
    last_seen: str


class NetworkResponse(ContractModel):
    customer_id: Identifier
    as_of: str
    summary: NetworkSummaryResponse
    nodes: list[NetworkNodeResponse]
    edges: list[NetworkEdgeResponse]
    request_id: str


class BorrowerProfileResponse(ContractModel):
    application_id: Identifier
    customer_id: Identifier
    age: int
    annual_income_inr: int
    credit_score: int
    location_id: Identifier
    loan_amount_inr: int
    loan_type: str
    dealer_id: Identifier


class GraphEvidenceResponse(ContractModel):
    connected_applicant_count: int
    cluster_size: int
    network_density: float
    community_id: str
    shared_identity_signal_count: int
    max_connection_strength: float


class TemporalEvidenceResponse(ContractModel):
    as_of: str
    application_velocity_2h: int
    linked_applicants_24h: int
    network_growth_rate_24h: float
    recency_score: float
    rapid_burst_detected: bool
    burst_signal_types: list[str]


class ExplanationResponse(ContractModel):
    application_id: Identifier
    customer_id: Identifier
    risk_score: float
    risk_level: RiskLevel
    borrower: BorrowerProfileResponse
    signals: list[SignalResponse]
    graph_evidence: GraphEvidenceResponse
    temporal_evidence: TemporalEvidenceResponse
    recommended_action: RecommendedActionResponse
    versions: AnalysisVersionsResponse
    analysed_at: str
    request_id: str


class DashboardSummaryResponse(ContractModel):
    total_applications: int
    analysed_applications: int
    detected_networks: int
    high_risk_ecosystems: int
    potential_exposure: int
    currency: Literal["INR"] = "INR"
    data_timestamp: str
    request_id: str


class ActivityEventResponse(ContractModel):
    timestamp: str
    application_id: Identifier
    customer_id: Identifier
    dealer_id: Identifier
    device_id: Identifier
    account_id: Identifier
    loan_amount_inr: int = Field(ge=0)
    risk_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    status: Literal["Analysed", "Relationship Found", "Requires Review"]
    primary_signal: str | None


class LiveMonitorResponse(ContractModel):
    dataset_id: Identifier
    events: list[ActivityEventResponse]
    focus_customer_id: Identifier
    data_timestamp: str
    request_id: str


class RiskDistributionItem(ContractModel):
    risk_level: RiskLevel
    count: int


class DealerClusterItem(ContractModel):
    dealer_id: Identifier
    application_count: int
    high_risk_count: int
    total_exposure_inr: int


class DailyRiskItem(ContractModel):
    date: str
    application_count: int
    high_risk_count: int


class AnalyticsResponse(ContractModel):
    from_date: str
    to_date: str
    risk_distribution: list[RiskDistributionItem]
    top_dealer_clusters: list[DealerClusterItem]
    daily_activity: list[DailyRiskItem]
    request_id: str


class DemoSimulationRequest(ContractModel):
    seed: int = Field(default=2026, ge=0, le=2_147_483_647)


class DemoRiskSnapshotResponse(ContractModel):
    risk_score: float = Field(ge=0, le=100)
    risk_level: RiskLevel
    linked_applicant_count: int = Field(ge=0)
    cluster_size: int = Field(ge=1)
    shared_device_applicant_count: int = Field(ge=1)
    application_velocity_2h: int = Field(ge=1)
    dealer_applications_2h: int = Field(ge=1)
    signals: list[SignalResponse]
    recommended_action: RecommendedActionResponse


class DemoEntityResponse(ContractModel):
    id: Identifier
    type: str
    label: str
    role: str
    is_focus: bool


class DemoEdgeResponse(ContractModel):
    id: Identifier
    source: Identifier
    target: Identifier
    type: str


class DemoNetworkSummaryResponse(ContractModel):
    applicant_count: int = Field(ge=1)
    shared_device_id: Identifier
    dealer_id: Identifier


class DemoNetworkResponse(ContractModel):
    nodes: list[DemoEntityResponse]
    edges: list[DemoEdgeResponse]
    summary: DemoNetworkSummaryResponse


class DemoSimulationResponse(ContractModel):
    scenario_id: Identifier
    seed: int
    customer_label: Literal["Customer A"]
    application_id: Identifier
    customer_id: Identifier
    before: DemoRiskSnapshotResponse
    after: DemoRiskSnapshotResponse
    created_entities: list[DemoEntityResponse]
    created_edges: list[DemoEdgeResponse]
    network: DemoNetworkResponse
    explanations: list[SignalResponse]
    recommended_action: RecommendedActionResponse
    generated_at: str
    request_id: str
