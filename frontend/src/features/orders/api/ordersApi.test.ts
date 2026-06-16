import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../shared/api/apiClient', () => ({
  apiClient: apiClientMock,
}));

import {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from './ordersApi';
import { getStateMachineDefinition } from './stateMachineApi';
import {
  baseDetail,
  baseSummary,
  stateMachineDefinition,
} from '../test/factories';

describe('order API modules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads health, order summaries, order detail, events, and state-machine metadata', async () => {
    const signal = new AbortController().signal;
    apiClientMock.get
      .mockResolvedValueOnce({ data: { status: 'ok' } })
      .mockResolvedValueOnce({ data: [baseSummary] })
      .mockResolvedValueOnce({ data: baseDetail })
      .mockResolvedValueOnce({ data: { events: ['paymentSuccessful'] } })
      .mockResolvedValueOnce({ data: stateMachineDefinition });

    await expect(getHealth(signal)).resolves.toEqual({ status: 'ok' });
    await expect(listOrders(signal)).resolves.toEqual([baseSummary]);
    await expect(getOrder(baseSummary.orderId, signal)).resolves.toEqual(baseDetail);
    await expect(getAvailableEvents(baseSummary.orderId, signal)).resolves.toEqual([
      'paymentSuccessful',
    ]);
    await expect(getStateMachineDefinition(signal)).resolves.toEqual(
      stateMachineDefinition,
    );

    expect(apiClientMock.get).toHaveBeenNthCalledWith(1, '/health', { signal });
    expect(apiClientMock.get).toHaveBeenNthCalledWith(2, '/orders', { signal });
    expect(apiClientMock.get).toHaveBeenNthCalledWith(
      3,
      `/orders/${baseSummary.orderId}`,
      { signal },
    );
    expect(apiClientMock.get).toHaveBeenNthCalledWith(
      4,
      `/orders/${baseSummary.orderId}/available-events`,
      { signal },
    );
    expect(apiClientMock.get).toHaveBeenNthCalledWith(5, '/state-machine', {
      signal,
    });
  });

  it('posts order creation and order events to backend DTO endpoints', async () => {
    const createRequest = {
      amount: 1200.5,
      productIds: ['product-1'],
    };
    const eventRequest = {
      eventType: 'paymentSuccessful' as const,
      metadata: { source: 'test' },
    };
    apiClientMock.post
      .mockResolvedValueOnce({ data: baseDetail })
      .mockResolvedValueOnce({ data: baseDetail });

    await expect(createOrder(createRequest)).resolves.toEqual(baseDetail);
    await expect(
      applyOrderEvent(baseSummary.orderId, eventRequest),
    ).resolves.toEqual(baseDetail);

    expect(apiClientMock.post).toHaveBeenNthCalledWith(1, '/orders', createRequest);
    expect(apiClientMock.post).toHaveBeenNthCalledWith(
      2,
      `/orders/${baseSummary.orderId}/events`,
      eventRequest,
    );
  });
});
