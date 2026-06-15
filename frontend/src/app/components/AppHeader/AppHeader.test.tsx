import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppHeader } from './AppHeader';

describe('AppHeader', () => {
  it('keeps healthy state visually quiet without the old large Connected pill', () => {
    render(<AppHeader health="connected" isRefreshing={false} onRefresh={vi.fn()} />);

    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/connected/i)).toBeInTheDocument();
  });

  it('keeps unavailable state visible', () => {
    render(
      <AppHeader health="unavailable" isRefreshing={false} onRefresh={vi.fn()} />,
    );

    expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
  });

  it('shows checking state accessibly and disables refresh while refreshing', () => {
    render(<AppHeader health="checking" isRefreshing onRefresh={vi.fn()} />);

    expect(screen.getByText(/checking/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refreshing/i })).toBeDisabled();
  });
});
