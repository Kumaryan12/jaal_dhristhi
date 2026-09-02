import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import LiveMonitorPage from '../app/page';
import { getDashboardSummary, getLiveMonitor, getNetwork } from '../lib/api';

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MiniMap: () => null,
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  ReactFlow: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="live-network">{children}</div>
  ),
}));

vi.mock('../lib/api', () => ({
  API_BASE_URL: 'http://127.0.0.1:8000',
  getDashboardSummary: vi.fn(),
  getLiveMonitor: vi.fn(),
  getNetwork: vi.fn(),
}));

const monitor = {
  dataset_id: 'seed-2026',
  events: [
    {
      timestamp: '2026-08-31T10:00:00Z',
      application_id: 'APP-S-005001',
      customer_id: 'CUS-S-005001',
      dealer_id: 'DLR-0181',
      device_id: 'DEV-0001',
      account_id: 'ACC-0001',
      loan_amount_inr: 95000,
      risk_score: 82,
      risk_level: 'HIGH' as const,
      status: 'Requires Review' as const,
      primary_signal: 'SHARED_DEVICE_MANY_APPLICANTS',
    },
    {
      timestamp: '2026-08-31T09:55:00Z',
      application_id: 'APP-S-005002',
      customer_id: 'CUS-S-005002',
      dealer_id: 'DLR-0181',
      device_id: 'DEV-0002',
      account_id: 'ACC-0002',
      loan_amount_inr: 72000,
      risk_score: 48,
      risk_level: 'MEDIUM' as const,
      status: 'Relationship Found' as const,
      primary_signal: 'DEALER_CONCENTRATION',
    },
  ],
  focus_customer_id: 'CUS-S-005001',
  data_timestamp: '2026-08-31T10:00:00Z',
  request_id: 'req_monitor',
};

const summary = {
  total_applications: 20000,
  analysed_applications: 20000,
  detected_networks: 481,
  high_risk_ecosystems: 37,
  potential_exposure: 8450000,
  currency: 'INR' as const,
  data_timestamp: '2026-08-31T10:00:00Z',
  request_id: 'req_summary',
};

const network = {
  customer_id: 'CUS-S-005001',
  as_of: '2026-08-31T10:00:00Z',
  summary: {
    node_count: 2,
    edge_count: 1,
    linked_applicant_count: 1,
    component_density: 1,
    community_id: 'community-1',
    truncated: false,
  },
  nodes: [
    { id: 'CUS-S-005001', type: 'customer' as const, label: 'Customer 5001', risk_level: 'HIGH' as const, is_focus: true },
    { id: 'DEV-0001', type: 'device' as const, label: 'Device 0001', risk_level: null, is_focus: false },
  ],
  edges: [
    { id: 'edge-1', source: 'CUS-S-005001', target: 'DEV-0001', type: 'uses_device', strength: 1, first_seen: '2026-08-31T10:00:00Z', last_seen: '2026-08-31T10:00:00Z' },
  ],
  request_id: 'req_network',
};

describe('live ecosystem monitor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.mocked(getLiveMonitor).mockResolvedValue(monitor);
    vi.mocked(getDashboardSummary).mockResolvedValue(summary);
    vi.mocked(getNetwork).mockResolvedValue(network);
  });

  it('renders backend activity, network context, and the review queue', async () => {
    render(<LiveMonitorPage />);

    await waitFor(() => {
      expect(screen.getAllByText('APP-S-005001').length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByRole('heading', { name: 'Live Ecosystem Monitor' })).toBeInTheDocument();
    expect(screen.getByText('Requires Review')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('live-network')).toBeInTheDocument());
    expect(screen.getAllByText('37')).toHaveLength(2);
    expect(screen.getByRole('link', { name: /Open investigations/i })).toHaveAttribute('href', '/investigate');
    expect(getLiveMonitor).toHaveBeenCalledWith(20, expect.any(AbortSignal));
    expect(getNetwork).toHaveBeenCalledWith(
      'CUS-S-005001',
      { depth: 2, maxNodes: 50 },
      expect.any(AbortSignal),
    );
  });

  it('lets an analyst focus the graph on another stream event', async () => {
    const user = userEvent.setup();
    render(<LiveMonitorPage />);

    await user.click(await screen.findByRole('button', { name: 'Show relationship graph for APP-S-005002' }));

    await waitFor(() => {
      expect(getNetwork).toHaveBeenCalledWith(
        'CUS-S-005002',
        { depth: 2, maxNodes: 50 },
        expect.any(AbortSignal),
      );
    });
    expect(screen.getByText('Click to update graph')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Inspect insight/i })).not.toBeInTheDocument();
  });

  it('keeps the graph on the selected application while new stream events appear', async () => {
    vi.useFakeTimers();
    const events = Array.from({ length: 7 }, (_, index) => ({
      ...monitor.events[0],
      timestamp: new Date(Date.UTC(2026, 7, 31, 10, 0) - index * 5 * 60_000).toISOString(),
      application_id: `APP-S-${String(5001 + index).padStart(6, '0')}`,
      customer_id: `CUS-S-${String(5001 + index).padStart(6, '0')}`,
    }));
    vi.mocked(getLiveMonitor).mockResolvedValue({ ...monitor, events });

    render(<LiveMonitorPage />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getNetwork).toHaveBeenCalledWith(
      'CUS-S-005002',
      { depth: 2, maxNodes: 50 },
      expect.any(AbortSignal),
    );
    vi.mocked(getNetwork).mockClear();

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(screen.getByRole('button', { name: 'Show relationship graph for APP-S-005001' })).toBeInTheDocument();
    expect(getNetwork).not.toHaveBeenCalled();
  });
});
