import { render, screen, waitFor } from '@testing-library/react';
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
  getHealth,
  getOrder,
  getStateMachineDefinition,
  listOrders,
  openFirstOrder,
  openOrderName,
  renderOverview,
} from '../test/appTestUtils';
import App from './App';
import {
  baseDetail,
  baseSummary,
  secondDetail,
  secondSummary,
  stateMachineDefinition,
} from '../features/orders/test/factories';
import type { OrderEventType } from '../features/orders/model/orderEvents';
import type { OrderDetail } from '../features/orders/model/order.types';
import type { StateMachineDefinition } from '../features/orders/model/stateMachine.types';
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

  it('aborts initialization requests when the app unmounts', async () => {
    let healthSignal: AbortSignal | undefined;
    let summariesSignal: AbortSignal | undefined;
    let stateMachineSignal: AbortSignal | undefined;

    vi.mocked(getHealth).mockImplementation((signal?: AbortSignal) => {
      healthSignal = signal;
      return new Promise(() => undefined);
    });
    vi.mocked(listOrders).mockImplementation((signal?: AbortSignal) => {
      summariesSignal = signal;
      return new Promise(() => undefined);
    });
    vi.mocked(getStateMachineDefinition).mockImplementation(
      (signal?: AbortSignal) => {
        stateMachineSignal = signal;
        return new Promise(() => undefined);
      },
    );

    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(healthSignal).toBeDefined();
      expect(summariesSignal).toBeDefined();
      expect(stateMachineSignal).toBeDefined();
    });

    unmount();

    expect(healthSignal?.aborted).toBe(true);
    expect(summariesSignal?.aborted).toBe(true);
    expect(stateMachineSignal?.aborted).toBe(true);
  });

  it('aborts stale workspace GET requests and keeps the newer order visible', async () => {
    const user = userEvent.setup();
    const detailA = deferred<OrderDetail>();
    const eventsA = deferred<OrderEventType[]>();
    let detailSignalA: AbortSignal | undefined;
    let eventsSignalA: AbortSignal | undefined;

    await renderOverview();
    vi.mocked(getOrder).mockImplementation(
      (orderId: string, signal?: AbortSignal) => {
        if (orderId === baseSummary.orderId) {
          detailSignalA = signal;
          return detailA.promise;
        }

        return Promise.resolve(secondDetail);
      },
    );
    vi.mocked(getAvailableEvents).mockImplementation(
      (orderId: string, signal?: AbortSignal) => {
        if (orderId === baseSummary.orderId) {
          eventsSignalA = signal;
          return eventsA.promise;
        }

        return Promise.resolve(['itemReceivedByCustomer']);
      },
    );

    await user.click(
      screen.getByRole('button', { name: openOrderName(baseSummary.orderId) }),
    );
    await waitFor(() => {
      expect(detailSignalA).toBeDefined();
      expect(eventsSignalA).toBeDefined();
    });

    await user.click(screen.getByRole('button', { name: /back to orders/i }));
    await user.click(
      screen.getByRole('button', { name: openOrderName(secondSummary.orderId) }),
    );

    expect(detailSignalA?.aborted).toBe(true);
    expect(eventsSignalA?.aborted).toBe(true);

    expect(await screen.findByText(secondDetail.orderId)).toBeInTheDocument();
    detailA.resolve(baseDetail);
    eventsA.reject(createApiError(500, 'Old workspace failed'));

    await waitFor(() => {
      expect(screen.getByText(secondDetail.orderId)).toBeInTheDocument();
    });
    expect(screen.queryByText(baseDetail.orderId)).not.toBeInTheDocument();
    expect(screen.queryByText(/old workspace failed/i)).not.toBeInTheDocument();
  });

  it('keeps workspace and diagram refreshes visible when summaries fail', async () => {
    const user = userEvent.setup();
    const refreshedDetail: OrderDetail = {
      ...baseDetail,
      amount: 333,
      updatedAt: '2026-06-13T12:30:00Z',
    };
    const refreshedDefinition: StateMachineDefinition = {
      ...stateMachineDefinition,
      transitions: [
        ...stateMachineDefinition.transitions,
        {
          fromState: 'Confirmed',
          eventType: 'customInspectionPassed',
          toState: 'Processing',
        },
      ],
    };

    await renderOverview();
    await openFirstOrder(user);
    vi.mocked(getHealth).mockResolvedValueOnce({ status: 'ok' });
    vi.mocked(listOrders).mockRejectedValueOnce(
      createApiError(500, 'Summaries failed'),
    );
    vi.mocked(getStateMachineDefinition).mockResolvedValueOnce(refreshedDefinition);
    vi.mocked(getOrder).mockResolvedValueOnce(refreshedDetail);
    vi.mocked(getAvailableEvents).mockResolvedValueOnce(['preparingShipment']);

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));

    expect(await screen.findByText(/333/)).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /preparing shipment/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/custom inspection passed/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^refresh$/i })).toBeEnabled();
    });
  });

  it('keeps overview refreshes visible when workspace refresh fails', async () => {
    const user = userEvent.setup();
    const refreshedDefinition: StateMachineDefinition = {
      ...stateMachineDefinition,
      transitions: [
        ...stateMachineDefinition.transitions,
        {
          fromState: 'Confirmed',
          eventType: 'customFlowResumed',
          toState: 'Processing',
        },
      ],
    };

    await renderOverview();
    await openFirstOrder(user);
    vi.mocked(getHealth).mockResolvedValueOnce({ status: 'ok' });
    vi.mocked(listOrders).mockResolvedValueOnce([baseSummary, secondSummary]);
    vi.mocked(getStateMachineDefinition).mockResolvedValueOnce(refreshedDefinition);
    vi.mocked(getOrder).mockRejectedValueOnce(
      createApiError(500, 'Workspace refresh failed'),
    );
    vi.mocked(getAvailableEvents).mockResolvedValueOnce(['paymentSuccessful']);

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));

    expect(
      (await screen.findAllByText(/workspace refresh failed/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/custom flow resumed/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^refresh$/i })).toBeEnabled();
    });
  });

  it('does not abort a pending detail refresh when retrying available events', async () => {
    const user = userEvent.setup();
    const refreshedDetail = deferred<OrderDetail>();
    const updatedDetail: OrderDetail = {
      ...baseDetail,
      amount: 444,
      updatedAt: '2026-06-13T12:44:00Z',
    };
    let refreshedDetailSignal: AbortSignal | undefined;
    let failedEventsSignal: AbortSignal | undefined;
    let retriedEventsSignal: AbortSignal | undefined;

    await renderOverview();
    await openFirstOrder(user);
    vi.mocked(getHealth).mockResolvedValueOnce({ status: 'ok' });
    vi.mocked(listOrders).mockResolvedValueOnce([baseSummary, secondSummary]);
    vi.mocked(getStateMachineDefinition).mockResolvedValueOnce(
      stateMachineDefinition,
    );
    vi.mocked(getOrder).mockImplementationOnce(
      (_orderId: string, signal?: AbortSignal) => {
        refreshedDetailSignal = signal;
        return refreshedDetail.promise;
      },
    );
    vi.mocked(getAvailableEvents)
      .mockImplementationOnce((_orderId: string, signal?: AbortSignal) => {
        failedEventsSignal = signal;
        return Promise.reject(createApiError(500, 'Available events failed'));
      })
      .mockImplementationOnce((_orderId: string, signal?: AbortSignal) => {
        retriedEventsSignal = signal;
        return Promise.resolve(['paymentSuccessful']);
      });

    await user.click(screen.getByRole('button', { name: /^refresh$/i }));

    expect(
      await screen.findByRole('button', { name: /retry available events/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/loading order detail/i)).toBeInTheDocument();
    expect(refreshedDetailSignal).toBeDefined();
    expect(failedEventsSignal).toBeDefined();

    await user.click(
      screen.getByRole('button', { name: /retry available events/i }),
    );

    expect(refreshedDetailSignal?.aborted).toBe(false);
    expect(failedEventsSignal?.aborted).toBe(false);
    expect(retriedEventsSignal).toBeDefined();
    refreshedDetail.resolve(updatedDetail);

    expect(await screen.findByText(/444/)).toBeInTheDocument();
    expect(
      screen.queryByText(/loading order detail/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /payment successful/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/available events failed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/network error/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/canceled/i)).not.toBeInTheDocument();
  });
});
