import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { baseDetail } from '../../test/factories';
import { OrderDetail } from './OrderDetail';

describe('OrderDetail', () => {
  it('displays summary information', () => {
    render(<OrderDetail error={null} isLoading={false} order={baseDetail} />);

    expect(screen.getByText(baseDetail.orderId)).toBeInTheDocument();
    expect(screen.getByText('product-1')).toBeInTheDocument();
    expect(screen.getByText('product-2')).toBeInTheDocument();
    expect(screen.getByText('Pending payment')).toBeInTheDocument();
    expect(screen.getByText(String(baseDetail.history.length))).toBeInTheDocument();
  });
});
