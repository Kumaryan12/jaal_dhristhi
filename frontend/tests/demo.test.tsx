import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DemoPage from '../app/demo/page';
import { simulateEmergingRisk } from '../lib/api';
import type { DemoSimulation } from '../lib/types';

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  ReactFlow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="demo-network">{children}</div>
  ),
}));

vi.mock('../lib/api', () => ({
  API_BASE_URL: 'http://127.0.0.1:8000',
  simulateEmergingRisk: vi.fn(),
}));

const action = {
  code: 'ENHANCED_VERIFICATION',
  label: 'Enhanced verification required',
  rationale: 'Validate shared-entity ownership and dealer evidence.',
  human_review_required: true,
};

const sharedDeviceSignal = {
  code: 'SHARED_DEVICE_MANY_APPLICANTS',
  category: 'IDENTITY',
  severity: 'HIGH',
  message: 'Device DEV-0000002 is linked to 6 applicants.',
  entity_ids: ['DEV-0000002'],
  observed_value: 5,
  threshold: 2,
  points: 32,
  score_floor: 75,
  window: null,
};

const simulation: DemoSimulation = {
  scenario_id: 'SIM-2026-test',
  seed: 2026,
  customer_label: 'Customer A',
  application_id: 'APP-S-000007',
  customer_id: 'CUS-S-000007',
  before: {
    risk_score: 0,
    risk_level: 'LOW',
    linked_applicant_count: 0,
    cluster_size: 1,
    shared_device_applicant_count: 1,
    application_velocity_2h: 1,
    dealer_applications_2h: 1,
    signals: [],
    recommended_action: {
      code: 'STANDARD_PROCESSING',
      label: 'Proceed with standard checks',
      rationale: 'No material ecosystem concentration is present.',
      human_review_required: false,
    },
  },
  after: {
    risk_score: 85.43,
    risk_level: 'HIGH',
    linked_applicant_count: 5,
    cluster_size: 6,
    shared_device_applicant_count: 6,
    application_velocity_2h: 6,
    dealer_applications_2h: 6,
    signals: [sharedDeviceSignal],
    recommended_action: action,
  },
  created_entities: Array.from({ length: 5 }, (_, index) => ({
    id: `CUS-S-00000${index + 2}`,
    type: 'customer',
    label: `Customer ${index + 2}`,
    role: 'applicant',
    is_focus: false,
  })),
  created_edges: [],
  network: {
    nodes: [
      {
        id: 'CUS-S-000007',
        type: 'customer',
        label: 'Customer A',
        role: 'focus_customer',
        is_focus: true,
      },
      {
        id: 'DEV-0000002',
        type: 'device',
        label: 'Device 0000002',
        role: 'shared_device',
        is_focus: false,
      },
      {
        id: 'DLR-0011',
        type: 'dealer',
        label: 'Dealer 0011',
        role: 'dealer',
        is_focus: false,
      },
    ],
    edges: [],
    summary: {
      applicant_count: 6,
      shared_device_id: 'DEV-0000002',
      dealer_id: 'DLR-0011',
    },
  },
  explanations: [sharedDeviceSignal],
  recommended_action: action,
  generated_at: '2026-09-01T12:00:00Z',
  request_id: 'req_test',
};

describe('emerging-risk demo', () => {
  beforeEach(() => {
    vi.mocked(simulateEmergingRisk).mockResolvedValue(simulation);
  });

  it('starts with one explicit simulation action and no invented result', () => {
    render(<DemoPage />);
    expect(
      screen.getByRole('button', { name: 'Start Simulation' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Simulation ready')).toBeInTheDocument();
    expect(screen.getByText('Application received')).toBeInTheDocument();
    expect(screen.getByText('Action recommended')).toBeInTheDocument();
    expect(screen.queryByText('Enhanced verification required')).not.toBeInTheDocument();
  });

  it('offers a distraction-free presentation view', async () => {
    const user = userEvent.setup();
    render(<DemoPage />);

    await user.click(screen.getByRole('button', { name: 'Presentation view' }));

    expect(screen.getByRole('button', { name: 'Exit presentation view' })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary navigation' })).not.toBeInTheDocument();
  });

  it('renders the computed low-to-high journey and explanation', async () => {
    const user = userEvent.setup();
    render(<DemoPage />);

    await user.click(
      screen.getByRole('button', { name: 'Start Simulation' }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Enhanced verification required' }),
      ).toBeInTheDocument();
    });
    expect(simulateEmergingRisk).toHaveBeenCalledWith();
    expect(screen.getByText('Before')).toBeInTheDocument();
    expect(screen.getByText('After network analysis')).toBeInTheDocument();
    expect(screen.getAllByText('6 applicants')).toHaveLength(2);
    expect(screen.getByText('5 connected')).toBeInTheDocument();
    expect(screen.getAllByText('6 applications')).toHaveLength(2);
    expect(screen.getByText(sharedDeviceSignal.message)).toBeInTheDocument();
    expect(screen.getByTestId('demo-network')).toBeInTheDocument();
    expect(screen.getByText(/SIM-2026-test is isolated/)).toBeInTheDocument();
    expect(screen.getByText('Simulation processing trace')).toBeInTheDocument();
    expect(screen.getByText('Decision support outcome')).toBeInTheDocument();
  });
});
