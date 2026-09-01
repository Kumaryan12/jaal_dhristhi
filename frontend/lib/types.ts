export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface DashboardSummary {
  total_applications: number;
  analysed_applications: number;
  detected_networks: number;
  high_risk_ecosystems: number;
  potential_exposure: number;
  currency: 'INR';
  data_timestamp: string;
  request_id: string;
}

export interface RiskDistributionItem {
  risk_level: RiskLevel;
  count: number;
}

export interface DealerClusterItem {
  dealer_id: string;
  application_count: number;
  high_risk_count: number;
  total_exposure_inr: number;
}

export interface DailyRiskItem {
  date: string;
  application_count: number;
  high_risk_count: number;
}

export interface Analytics {
  from_date: string;
  to_date: string;
  risk_distribution: RiskDistributionItem[];
  top_dealer_clusters: DealerClusterItem[];
  daily_activity: DailyRiskItem[];
  request_id: string;
}

export interface RiskSignal {
  code: string;
  category: string;
  severity: string;
  message: string;
  entity_ids: string[];
  observed_value: number | boolean;
  threshold: number | boolean;
  points: number;
  score_floor: number;
  window: string | null;
}

export interface RecommendedAction {
  code: string;
  label: string;
  rationale: string;
  human_review_required: boolean;
}

export interface AnalysisVersions {
  feature_schema: string;
  temporal_feature_schema: string;
  risk_policy: string;
  model: string | null;
}

export interface Analysis {
  analysis_id: string;
  application_id: string;
  customer_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  signals: RiskSignal[];
  recommended_action: RecommendedAction;
  score_components: {
    rule_score: number;
    graph_score: number;
    temporal_score: number;
    ml_score: number | null;
    weights: Record<string, number>;
    weighted_score: number;
    enforced_floor: number;
    final_score: number;
  };
  versions: AnalysisVersions;
  analysed_at: string;
  request_id: string;
}

export interface Explanation {
  application_id: string;
  customer_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  borrower: {
    application_id: string;
    customer_id: string;
    age: number;
    annual_income_inr: number;
    credit_score: number;
    location_id: string;
    loan_amount_inr: number;
    loan_type: string;
    dealer_id: string;
  };
  signals: RiskSignal[];
  graph_evidence: {
    connected_applicant_count: number;
    cluster_size: number;
    network_density: number;
    community_id: string;
    shared_identity_signal_count: number;
    max_connection_strength: number;
  };
  temporal_evidence: {
    as_of: string;
    application_velocity_2h: number;
    linked_applicants_24h: number;
    network_growth_rate_24h: number;
    recency_score: number;
    rapid_burst_detected: boolean;
    burst_signal_types: string[];
  };
  recommended_action: RecommendedAction;
  versions: AnalysisVersions;
  analysed_at: string;
  request_id: string;
}

export interface NetworkGraph {
  customer_id: string;
  as_of: string;
  summary: {
    node_count: number;
    edge_count: number;
    linked_applicant_count: number;
    component_density: number;
    community_id: string;
    truncated: boolean;
  };
  nodes: Array<{
    id: string;
    type: 'customer' | 'device' | 'account' | 'dealer' | 'location';
    label: string;
    risk_level: RiskLevel | null;
    is_focus: boolean;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    strength: number;
    first_seen: string;
    last_seen: string;
  }>;
  request_id: string;
}

export interface DemoRiskSnapshot {
  risk_score: number;
  risk_level: RiskLevel;
  linked_applicant_count: number;
  cluster_size: number;
  shared_device_applicant_count: number;
  application_velocity_2h: number;
  dealer_applications_2h: number;
  signals: RiskSignal[];
  recommended_action: RecommendedAction;
}

export interface DemoEntity {
  id: string;
  type: string;
  label: string;
  role: string;
  is_focus: boolean;
}

export interface DemoEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface DemoSimulation {
  scenario_id: string;
  seed: number;
  customer_label: 'Customer A';
  application_id: string;
  customer_id: string;
  before: DemoRiskSnapshot;
  after: DemoRiskSnapshot;
  created_entities: DemoEntity[];
  created_edges: DemoEdge[];
  network: {
    nodes: DemoEntity[];
    edges: DemoEdge[];
    summary: {
      applicant_count: number;
      shared_device_id: string;
      dealer_id: string;
    };
  };
  explanations: RiskSignal[];
  recommended_action: RecommendedAction;
  generated_at: string;
  request_id: string;
}
