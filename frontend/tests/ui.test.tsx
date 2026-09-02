import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppShell } from '../components/app-shell';
import { ErrorPanel, LoadingPanel, RiskBadge } from '../components/ui';

describe('shared UI states', () => {
  it('announces loading and error states to assistive technology', () => {
    const { rerender } = render(<LoadingPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading intelligence');

    rerender(<ErrorPanel message="Service unavailable" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Service unavailable');
  });

  it('renders semantic risk text without relying on color alone', () => {
    render(<RiskBadge level="HIGH" />);
    expect(screen.getByText('HIGH')).toBeVisible();
  });

  it('uses the TVS Credit shell without transient status and date chrome', () => {
    render(<AppShell activePath="/"><p>Workspace content</p></AppShell>);

    expect(screen.getAllByText('TVS')).not.toHaveLength(0);
    expect(screen.getAllByText('Credit')).not.toHaveLength(0);
    const activeLinks = screen.getAllByRole('link', { name: 'Live Monitor' });
    expect(activeLinks.every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(activeLinks.every((link) => link.className.includes('border-[var(--green)]'))).toBe(true);
    expect(screen.queryByText('System status')).not.toBeInTheDocument();
    expect(screen.queryByText('Live stream active')).not.toBeInTheDocument();
    expect(screen.queryByText('01 Aug – 31 Aug 2026')).not.toBeInTheDocument();
    expect(screen.queryByText('API and intelligence services operational')).not.toBeInTheDocument();
  });
});
