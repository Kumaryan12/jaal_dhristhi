import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

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
});
