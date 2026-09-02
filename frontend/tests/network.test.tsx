import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NetworkExplorer } from '../components/network-explorer';
import { getNetwork } from '../lib/api';
import type { NetworkGraph } from '../lib/types';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@xyflow/react', () => ({
  Background: () => null,
  BackgroundVariant: { Dots: 'dots' },
  Controls: () => null,
  MiniMap: () => null,
  ReactFlow: ({ nodes, edges, children }: { nodes: unknown[]; edges: unknown[]; children: React.ReactNode }) => (
    <div data-testid="network-graph" data-node-count={nodes.length} data-edge-count={edges.length}>{children}</div>
  ),
}));

vi.mock('../lib/api', () => ({
  API_BASE_URL: 'http://127.0.0.1:8000',
  getNetwork: vi.fn(),
}));

const network: NetworkGraph = {
  customer_id: 'CUS-S-005001',
  as_of: '2026-08-31T10:00:00Z',
  summary: {
    node_count: 7,
    edge_count: 6,
    linked_applicant_count: 3,
    component_density: 0.42,
    community_id: 'community-158',
    truncated: false,
  },
  nodes: [
    { id: 'CUS-S-005001', type: 'customer', label: 'Focus customer', risk_level: 'HIGH', is_focus: true },
    { id: 'DEV-1', type: 'device', label: 'Shared device', risk_level: null, is_focus: false },
    { id: 'DLR-1', type: 'dealer', label: 'Dealer', risk_level: null, is_focus: false },
    { id: 'LOC-1', type: 'location', label: 'Location', risk_level: null, is_focus: false },
    { id: 'CUS-2', type: 'customer', label: 'Customer 2', risk_level: 'HIGH', is_focus: false },
    { id: 'CUS-3', type: 'customer', label: 'Customer 3', risk_level: 'MEDIUM', is_focus: false },
    { id: 'CUS-NOISE', type: 'customer', label: 'Location-only customer', risk_level: null, is_focus: false },
  ],
  edges: [
    relationship('focus-device', 'CUS-S-005001', 'DEV-1', 'uses_device'),
    relationship('customer-device', 'CUS-2', 'DEV-1', 'uses_device'),
    relationship('focus-dealer', 'CUS-S-005001', 'DLR-1', 'applied_via'),
    relationship('customer-dealer', 'CUS-3', 'DLR-1', 'applied_via'),
    relationship('focus-location', 'CUS-S-005001', 'LOC-1', 'located_in'),
    relationship('noise-location', 'CUS-NOISE', 'LOC-1', 'located_in'),
  ],
  request_id: 'req_network',
};

function relationship(id: string, source: string, target: string, type: string) {
  return {
    id,
    source,
    target,
    type,
    strength: 1,
    first_seen: '2026-08-31T09:00:00Z',
    last_seen: '2026-08-31T10:00:00Z',
  };
}

describe('network intelligence presentation', () => {
  it('prioritizes shared evidence while retaining a full graph control', async () => {
    vi.mocked(getNetwork).mockResolvedValue(network);
    const user = userEvent.setup();
    render(<NetworkExplorer />);

    expect(screen.getByRole('button', { name: /Load CUS-S-005024: Mixed identity ring/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Load CUS-N-000031: Clean control/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Load CUS-S-005001: Shared device ring/i }));

    await waitFor(() => expect(screen.getByText('What this graph proves')).toBeInTheDocument());
    expect(screen.getByText(/2 customers connect through device DEV-1/)).toBeInTheDocument();
    expect(getNetwork).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('network-graph')).toHaveAttribute('data-node-count', '6');
    expect(screen.getByText(/1 low-priority nodes hidden/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Full graph' }));
    expect(screen.getByTestId('network-graph')).toHaveAttribute('data-node-count', '7');
    expect(screen.queryByText(/low-priority nodes hidden/)).not.toBeInTheDocument();
  });
});
