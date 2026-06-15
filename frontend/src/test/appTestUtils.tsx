import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import App from '../app/App';
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

export function createApiError(status: number, detail: string) {
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

export function openOrderName(orderId: string) {
  return new RegExp(`open order\\s+${orderId}`, 'i');
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

export {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  getStateMachineDefinition,
  listOrders,
};
