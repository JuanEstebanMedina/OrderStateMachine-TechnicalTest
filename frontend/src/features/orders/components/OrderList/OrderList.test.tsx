import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  baseSummary,
  secondSummary,
  stateMachineDefinition,
} from '../../test/factories';
import { OrderList } from './OrderList';

function openOrderName(orderId: string) {
  return new RegExp(String.raw`open order\s+${orderId}`, 'i');
}

function renderOrderList(onSelect = vi.fn()) {
  render(
    <OrderList
      error={null}
      isLoading={false}
      orders={[baseSummary, secondSummary]}
      states={stateMachineDefinition.states}
      selectedOrderId={baseSummary.orderId}
      onRetry={vi.fn()}
      onSelect={onSelect}
    />,
  );

  return onSelect;
}

describe('OrderList', () => {
  it('renders summaries', () => {
    renderOrderList();

    expect(screen.getByRole('list', { name: /order cards/i })).toBeInTheDocument();
    expect(
      within(screen.getByRole('list', { name: /order cards/i })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(2);
    expect(screen.getByText('11111111')).toBeInTheDocument();
    expect(screen.getByText('22222222')).toBeInTheDocument();
    expect(screen.getAllByText('Pending').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shipped').length).toBeGreaterThan(0);
  });

  it('filters by order ID', async () => {
    const user = userEvent.setup();
    renderOrderList();

    await user.type(screen.getByLabelText(/search orders/i), '22222222');

    expect(
      within(screen.getByRole('list', { name: /order cards/i })).getAllByRole(
        'listitem',
      ),
    ).toHaveLength(1);
    expect(screen.queryByText('11111111')).not.toBeInTheDocument();
    expect(screen.getByText('22222222')).toBeInTheDocument();
  });

  it('filters by product ID', async () => {
    const user = userEvent.setup();
    renderOrderList();

    await user.type(screen.getByLabelText(/search orders/i), 'warehouse-kit');

    expect(screen.queryByText('11111111')).not.toBeInTheDocument();
    expect(screen.getByText('22222222')).toBeInTheDocument();
  });

  it('filters by state', async () => {
    const user = userEvent.setup();
    renderOrderList();

    await user.selectOptions(screen.getByLabelText(/filter by state/i), 'Shipped');

    expect(screen.queryByText('11111111')).not.toBeInTheDocument();
    expect(screen.getByText('22222222')).toBeInTheDocument();
  });

  it('invokes the selection callback', async () => {
    const user = userEvent.setup();
    const onSelect = renderOrderList();

    await user.click(
      screen.getByRole('button', {
        name: openOrderName(secondSummary.orderId),
      }),
    );

    expect(onSelect).toHaveBeenCalledWith(secondSummary.orderId);
  });
});
