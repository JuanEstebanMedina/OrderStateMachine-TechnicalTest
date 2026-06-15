import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardSummary } from './DashboardSummary';
import { baseSummary } from '../../test/factories';
import type { OrderSummary } from '../../model/order.types';

function summaryFor(state: OrderSummary['currentState']): OrderSummary {
  return {
    ...baseSummary,
    orderId: `${state}-order`,
    currentState: state,
  };
}

describe('DashboardSummary', () => {
  it('groups total, in-progress, returns, completed, and cancelled orders', () => {
    render(
      <DashboardSummary
        orders={[
          summaryFor('Pending'),
          summaryFor('Processing'),
          summaryFor('Returning'),
          summaryFor('Delivered'),
          summaryFor('Refunded'),
          summaryFor('Cancelled'),
        ]}
      />,
    );

    expect(screen.getByText('Total').nextElementSibling).toHaveTextContent('6');
    expect(screen.getByText('In progress').nextElementSibling).toHaveTextContent(
      '2',
    );
    expect(screen.getByText('Returns').nextElementSibling).toHaveTextContent('1');
    expect(screen.getByText('Completed').nextElementSibling).toHaveTextContent('2');
    expect(screen.getByText('Cancelled').nextElementSibling).toHaveTextContent('1');
  });
});
