import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { baseDetail, emptyHistoryDetail } from '../../test/factories';
import { OrderDetail } from './OrderDetail';

describe('OrderDetail', () => {
  it('displays summary information and history', () => {
    render(<OrderDetail error={null} isLoading={false} order={baseDetail} />);

    expect(screen.getByText(baseDetail.orderId)).toBeInTheDocument();
    expect(screen.getByText('product-1')).toBeInTheDocument();
    expect(screen.getByText('product-2')).toBeInTheDocument();
    expect(screen.getByText('No verification needed')).toBeInTheDocument();
    expect(screen.getByText('Pending payment')).toBeInTheDocument();
    expect(screen.getByText(/checkout/i)).toBeInTheDocument();
  });

  it('displays an empty-history state', () => {
    render(
      <OrderDetail error={null} isLoading={false} order={emptyHistoryDetail} />,
    );

    expect(
      screen.getByText(/no events have been applied yet/i),
    ).toBeInTheDocument();
  });
});
