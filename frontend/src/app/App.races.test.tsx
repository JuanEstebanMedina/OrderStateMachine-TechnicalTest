import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../features/orders/api/ordersApi', () => ({
  applyOrderEvent: vi.fn(),
  createOrder: vi.fn(),
  getAvailableEvents: vi.fn(),
  getHealth: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock('../features/orders/api/stateMachineApi', () => ({
  getStateMachineDefinition: vi.fn(),
}));

import {
  applyOrderEvent,
  deferred,
  getAvailableEvents,
  getOrder,
  openFirstOrder,
  openOrderName,
  renderOverview,
} from '../test/appTestUtils';
import {
  baseDetail,
  baseSummary,
  secondDetail,
  secondSummary,
} from '../features/orders/test/factories';
import type { OrderEventType } from '../features/orders/model/orderEvents';
import type { OrderDetail } from '../features/orders/model/order.types';
import { createApiError } from '../test/appTestUtils';

describe('App race-condition behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('open A, then B, resolving A last keeps B visible', async () => {
    const user = userEvent.setup();
    const detailA = deferred<OrderDetail>();
    const detailB = deferred<OrderDetail>();
    await renderOverview();
    vi.mocked(getOrder).mockImplementation((orderId: string) =>
      orderId === baseSummary.orderId ? detailA.promise : detailB.promise,
    );
    vi.mocked(getAvailableEvents).mockResolvedValue([]);

    await user.click(
      screen.getByRole('button', { name: openOrderName(baseSummary.orderId) }),
    );
    await user.click(screen.getByRole('button', { name: /back to orders/i }));
    await user.click(
      screen.getByRole('button', { name: openOrderName(secondSummary.orderId) }),
    );
    detailB.resolve(secondDetail);
    expect(await screen.findByText(secondDetail.orderId)).toBeInTheDocument();
    detailA.resolve(baseDetail);

    await waitFor(() => {
      expect(screen.getByText(secondDetail.orderId)).toBeInTheDocument();
    });
    expect(screen.queryByText(baseDetail.orderId)).not.toBeInTheDocument();
  });

  it('applying an event to A then opening B keeps B visible when A resolves', async () => {
    const user = userEvent.setup();
    const applyA = deferred<OrderDetail>();
    await renderOverview();
    await openFirstOrder(user);
    vi.mocked(applyOrderEvent).mockReturnValueOnce(applyA.promise);

    await user.click(screen.getByRole('button', { name: /apply event/i }));
    await user.click(screen.getByRole('button', { name: /back to orders/i }));
    await user.click(
      screen.getByRole('button', { name: openOrderName(secondSummary.orderId) }),
    );
    expect(await screen.findByText(secondDetail.orderId)).toBeInTheDocument();
    applyA.resolve({
      ...baseDetail,
      currentState: 'Confirmed',
    });

    await waitFor(() => {
      expect(screen.getByText(secondDetail.orderId)).toBeInTheDocument();
    });
    expect(screen.queryByText(baseDetail.orderId)).not.toBeInTheDocument();
  });

  it('old available-events responses cannot replace events for a newer order', async () => {
    const user = userEvent.setup();
    const eventsA = deferred<OrderEventType[]>();
    await renderOverview();
    vi.mocked(getAvailableEvents)
      .mockReturnValueOnce(eventsA.promise)
      .mockResolvedValueOnce(['itemReceivedByCustomer']);

    await user.click(
      screen.getByRole('button', { name: openOrderName(baseSummary.orderId) }),
    );
    await user.click(screen.getByRole('button', { name: /back to orders/i }));
    await user.click(
      screen.getByRole('button', { name: openOrderName(secondSummary.orderId) }),
    );

    expect(
      await screen.findByRole('option', { name: /item received by customer/i }),
    ).toBeInTheDocument();
    eventsA.resolve(['paymentSuccessful']);

    await waitFor(() => {
      expect(
        screen.queryByRole('option', { name: /payment successful/i }),
      ).not.toBeInTheDocument();
    });
  });

  it('stale available-events errors do not replace current selection state', async () => {
    const user = userEvent.setup();
    const eventsA = deferred<OrderEventType[]>();
    await renderOverview();
    vi.mocked(getAvailableEvents)
      .mockReturnValueOnce(eventsA.promise)
      .mockResolvedValueOnce(['itemReceivedByCustomer']);

    await user.click(
      screen.getByRole('button', { name: openOrderName(baseSummary.orderId) }),
    );
    await user.click(screen.getByRole('button', { name: /back to orders/i }));
    await user.click(
      screen.getByRole('button', { name: openOrderName(secondSummary.orderId) }),
    );

    expect(
      await screen.findByRole('option', { name: /item received by customer/i }),
    ).toBeInTheDocument();
    eventsA.reject(createApiError(500, 'Old events failed'));

    await waitFor(() => {
      expect(screen.queryByText(/old events failed/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/loading available events/i)).not.toBeInTheDocument();
    });
  });
});
