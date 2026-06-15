import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

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
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from '../features/orders/api/ordersApi';
import { getStateMachineDefinition } from '../features/orders/api/stateMachineApi';
import App from '../app/App';
import {
  baseDetail,
  baseSummary,
  secondDetail,
  secondSummary,
  stateMachineDefinition,
} from '../features/orders/test/factories';

export const appApiMocks = {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  getStateMachineDefinition,
  listOrders,
};

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, reject, resolve };
}

export function setupApiDefaults() {
  vi.mocked(appApiMocks.getHealth).mockResolvedValue({ status: 'ok' });
  vi.mocked(appApiMocks.listOrders).mockResolvedValue([baseSummary, secondSummary]);
  vi.mocked(appApiMocks.getStateMachineDefinition).mockResolvedValue(
    stateMachineDefinition,
  );
  vi.mocked(appApiMocks.getOrder).mockImplementation(async (orderId: string) => {
    if (orderId === secondSummary.orderId) {
      return secondDetail;
    }

    return baseDetail;
  });
  vi.mocked(appApiMocks.getAvailableEvents).mockResolvedValue([
    'paymentSuccessful',
  ]);
}

export function openOrderName(orderId: string) {
  return new RegExp(String.raw`open order\s+${orderId}`, 'i');
}

export async function renderOverview() {
  setupApiDefaults();
  render(<App />);
  await screen.findByRole('heading', { name: /create order/i });
}

export async function openFirstOrder(user = userEvent.setup()) {
  await user.click(
    await screen.findByRole('button', {
      name: openOrderName(baseSummary.orderId),
    }),
  );
  await screen.findByRole('button', { name: /back to orders/i });
  return user;
}
