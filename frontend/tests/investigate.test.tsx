import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import InvestigationPage from '../app/investigate/page';
import { analyseApplication, getExplanation } from '../lib/api';
import type { Analysis, Explanation } from '../lib/types';

vi.mock('../lib/api', () => ({
  API_BASE_URL: 'http://127.0.0.1:8000',
  analyseApplication: vi.fn(),
  getExplanation: vi.fn(),
}));

const analysis: Analysis = {
  analysis_id: 'analysis_test',
  application_id: 'APP-S-005001',
  customer_id: 'CUS-S-005001',
  risk_score: 82,
  risk_level: 'HIGH',
  signals: [
    {
      code: 'SHARED_DEVICE_MANY_APPLICANTS',
      category: 'graph',
      severity: 'HIGH',
      message: 'Device DEV-1 is linked to 6 applicants.',
      entity_ids: ['DEV-1'],
      observed_value: 6,
      threshold: 3,
      points: 30,
      score_floor: 72,
      window: null,
    },
  ],
  recommended_action: {
    code: 'ENHANCED_VERIFICATION',
    label: 'Enhanced verification required',
    rationale: 'Validate shared-entity ownership.',
    human_review_required: true,
  },
  score_components: {
    rule_score: 80,
    graph_score: 75,
    temporal_score: 70,
    ml_score: 92,
    weights: { rule: 0.4, graph: 0.2, temporal: 0.15, ml: 0.25 },
    weighted_score: 80,
    enforced_floor: 72,
    final_score: 82,
  },
  versions: {
    feature_schema: '1.0.0',
    temporal_feature_schema: '1.0.0',
    risk_policy: '1.0.0',
    model: 'xgboost:1.0.0',
  },
  analysed_at: '2026-09-01T10:00:00Z',
  request_id: 'req_test',
};

const explanation: Explanation = {
  application_id: analysis.application_id,
  customer_id: analysis.customer_id,
  risk_score: analysis.risk_score,
  risk_level: analysis.risk_level,
  borrower: {
    application_id: analysis.application_id,
    customer_id: analysis.customer_id,
    age: 34,
    annual_income_inr: 720000,
    credit_score: 704,
    location_id: 'LOC-001',
    loan_amount_inr: 95000,
    loan_type: 'two_wheeler',
    dealer_id: 'DLR-0181',
  },
  signals: analysis.signals,
  graph_evidence: {
    connected_applicant_count: 5,
    cluster_size: 6,
    network_density: 1,
    community_id: 'community-1',
    shared_identity_signal_count: 2,
    max_connection_strength: 0.6,
  },
  temporal_evidence: {
    as_of: '2026-08-01T10:00:00Z',
    application_velocity_2h: 6,
    linked_applicants_24h: 5,
    network_growth_rate_24h: 2.5,
    recency_score: 0.9,
    rapid_burst_detected: true,
    burst_signal_types: ['dealer_2h'],
  },
  recommended_action: analysis.recommended_action,
  versions: analysis.versions,
  analysed_at: analysis.analysed_at,
  request_id: 'req_test',
};

describe('application investigation', () => {
  beforeEach(() => {
    vi.mocked(analyseApplication).mockResolvedValue(analysis);
    vi.mocked(getExplanation).mockResolvedValue(explanation);
  });

  it('starts with a backend-grounded empty state', () => {
    render(<InvestigationPage />);
    expect(screen.getByText('Start with an application')).toBeInTheDocument();
    expect(screen.getByText(/No score is guessed/)).toBeInTheDocument();
  });

  it('submits the selected application and renders evidence and action', async () => {
    const user = userEvent.setup();
    render(<InvestigationPage />);

    await user.click(screen.getByRole('button', { name: 'APP-S-005001' }));
    await user.click(screen.getByRole('button', { name: /Analyse ecosystem/i }));

    await waitFor(() => {
      expect(screen.getByText('Enhanced verification required')).toBeInTheDocument();
    });
    expect(analyseApplication).toHaveBeenCalledWith('APP-S-005001', false);
    expect(getExplanation).toHaveBeenCalledWith('APP-S-005001');
    expect(screen.getByText('Device DEV-1 is linked to 6 applicants.')).toBeInTheDocument();
    expect(screen.getByLabelText('Risk score 82 out of 100')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open connected network/i })).toHaveAttribute(
      'href',
      '/network?customer=CUS-S-005001',
    );
  });
});
