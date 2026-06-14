import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from '../features/orders/api/ordersApi';
import { getStateMachineDefinition } from '../features/orders/api/stateMachineApi';
import {
  baseDetail,
  baseSummary,
  secondDetail,
  secondSummary,
  stateMachineDefinition,
} from '../features/orders/test/factories';
import type { OrderDetail } from '../features/orders/model/order.types';
import type { OrderEventType } from '../features/orders/model/orderEvents';

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

function createApiError(status: number, detail: string) {
  return new AxiosError(
    detail,
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status,
      statusText: String(status),
      data: { detail },
      headers: {},
      config: {},
    } as AxiosResponse,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

function setupApiDefaults() {
  vi.mocked(getHealth).mockResolvedValue({ status: 'ok' });
  vi.mocked(listOrders).mockResolvedValue([baseSummary, secondSummary]);
  vi.mocked(getStateMachineDefinition).mockResolvedValue(stateMachineDefinition);
  vi.mocked(getOrder).mockImplementation(async (orderId: string) => {
    if (orderId === secondSummary.orderId) {
      return secondDetail;
    }

    return baseDetail;
  });
  vi.mocked(getAvailableEvents).mockResolvedValue(['paymentSuccessful']);
}

function openOrderName(orderId: string) {
  return new RegExp(`open order\\s+${orderId}`, 'i');
}

async function renderOverview() {
  setupApiDefaults();
  render(<App />);
  await screen.findByRole('heading', { name: /create order/i });
}

async function openFirstOrder(user = userEvent.setup()) {
  await user.click(
    await screen.findByRole('button', {
      name: openOrderName(baseSummary.orderId),
    }),
  );
  await screen.findByRole('button', { name: /back to orders/i });
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('App overview and workspace flow', () => {
  it('renders overview summary, create form, open-by-ID form, and order cards', async () => {
    await renderOverview();

    expect(screen.getByLabelText(/dashboard summary/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create order/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /open order by id/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /order cards/i })).toBeInTheDocument();
  });

  it('clicking an order card opens the workspace', async () => {
    const user = userEvent.setup();
    await renderOverview();

    await openFirstOrder(user);

    expect(screen.getByRole('button', { name: /back to orders/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /order identity/i })).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(baseSummary.orderId);
    expect(getAvailableEvents).toHaveBeenCalledWith(baseSummary.orderId);
  });

  it('submitting a valid full UUID opens the workspace', async () => {
    const user = userEvent.setup();
    await renderOverview();

    await user.type(screen.getByLabelText(/order uuid/i), ` ${baseSummary.orderId} `);
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(
      await screen.findByRole('button', { name: /back to orders/i }),
    ).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(baseSummary.orderId);
  });

  it('rejects an invalid UUID before calling the API', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(getOrder).mockClear();

    await user.type(screen.getByLabelText(/order uuid/i), 'not-a-uuid');
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/complete order uuid/i);
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('shows backend errors for an unknown direct lookup', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(getOrder).mockRejectedValueOnce(createApiError(404, 'Order not found'));

    await user.type(screen.getByLabelText(/order uuid/i), baseSummary.orderId);
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect((await screen.findAllByText(/order not found/i)).length).toBeGreaterThan(0);
  });

  it('back to orders returns to the overview', async () => {
    const user = userEvent.setup();
    await renderOverview();
    await openFirstOrder(user);

    await user.click(screen.getByRole('button', { name: /back to orders/i }));

    expect(screen.getByRole('heading', { name: /create order/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /order identity/i }),
    ).not.toBeInTheDocument();
  });
});

describe('App partial failures and races', () => {
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

    expect(
      await screen.findByText(/order .* created\./i),
    ).toBeInTheDocument();
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
