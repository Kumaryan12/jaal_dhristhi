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
