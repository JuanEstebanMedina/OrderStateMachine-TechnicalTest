import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HistoryTimeline } from './HistoryTimeline';
import { baseDetail, secondDetail } from '../../test/factories';

describe('HistoryTimeline', () => {
  it('renders empty history', () => {
    render(<HistoryTimeline history={[]} />);

    expect(screen.getByText(/no events have been applied/i)).toBeInTheDocument();
  });

  it('renders historical transitions and non-empty metadata', () => {
    render(<HistoryTimeline history={baseDetail.history} />);

    expect(screen.getByText(/no verification needed/i)).toBeInTheDocument();
    expect(screen.getByText(/checkout/i)).toBeInTheDocument();
  });

  it('renders empty metadata text', () => {
    render(<HistoryTimeline history={secondDetail.history} />);

    expect(screen.getAllByText(/no metadata/i).length).toBeGreaterThan(0);
  });
});
