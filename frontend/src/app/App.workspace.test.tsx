import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appApiMocks,
  openFirstOrder,
  renderOverview,
} from '../test/appTestUtils';
import { createApiError } from '../test/apiErrorFactory';
import { baseDetail } from '../features/orders/test/factories';
import type { OrderDetail } from '../features/orders/model/order.types';

const { applyOrderEvent, createOrder, getAvailableEvents } = appApiMocks;

describe('App workspace partial failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders detail when available-events loading fails and supports retry', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(getAvailableEvents)
      .mockRejectedValueOnce(createApiError(500, 'Available events failed'))
      .mockResolvedValueOnce(['paymentSuccessful']);

    await openFirstOrder(user);

    expect(screen.getByText(baseDetail.orderId)).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /available events failed/i,
    );

    await user.click(
      screen.getByRole('button', { name: /retry available events/i }),
    );

    expect(
      await screen.findByRole('option', { name: /payment successful/i }),
    ).toBeInTheDocument();
  });

  it('keeps creation successful when available-events refresh fails', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(createOrder).mockResolvedValue(baseDetail);
    vi.mocked(getAvailableEvents).mockRejectedValueOnce(
      createApiError(500, 'Available events failed'),
    );

    await user.type(screen.getByLabelText(/product IDs/i), 'product-1');
    await user.type(screen.getByLabelText(/amount in USD/i), '50');
    await user.click(screen.getByRole('button', { name: /create order/i }));

    expect(await screen.findByText(/order .* created\./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to orders/i })).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /available events failed/i,
    );
  });

  it('keeps event application successful when available-events refresh fails', async () => {
    const user = userEvent.setup();
    await renderOverview();
    await openFirstOrder(user);
    const updatedOrder: OrderDetail = {
      ...baseDetail,
      currentState: 'Confirmed',
      history: [
        ...baseDetail.history,
        {
          eventType: 'paymentSuccessful',
          fromState: 'PendingPayment',
          toState: 'Confirmed',
          metadata: {},
          createdAt: '2026-06-13T12:07:00Z',
        },
      ],
    };
    vi.mocked(applyOrderEvent).mockResolvedValue(updatedOrder);
    vi.mocked(getAvailableEvents).mockRejectedValueOnce(
      createApiError(500, 'Available events failed'),
    );

    await user.click(screen.getByRole('button', { name: /apply event/i }));

    expect(await screen.findByText(/applied paymentSuccessful/i)).toBeInTheDocument();
    expect(screen.getAllByText(/confirmed/i).length).toBeGreaterThan(0);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /available events failed/i,
    );
  });
});
