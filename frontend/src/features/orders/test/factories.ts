import type { OrderDetail, OrderSummary } from '../model/order.types';
import type { StateMachineDefinition } from '../model/stateMachine.types';

export const baseSummary: OrderSummary = {
  orderId: '11111111-1111-1111-1111-111111111111',
  productIds: ['product-1', 'product-2'],
  amount: 120.5,
  currentState: 'Pending',
  createdAt: '2026-06-13T12:00:00Z',
  updatedAt: '2026-06-13T12:05:00Z',
};

export const secondSummary: OrderSummary = {
  orderId: '22222222-2222-2222-2222-222222222222',
  productIds: ['warehouse-kit'],
  amount: 80,
  currentState: 'Shipped',
  createdAt: '2026-06-13T13:00:00Z',
  updatedAt: '2026-06-13T13:05:00Z',
};

export const baseDetail: OrderDetail = {
  ...baseSummary,
  history: [
    {
      eventType: 'noVerificationNeeded',
      fromState: 'Pending',
      toState: 'PendingPayment',
      metadata: { source: 'checkout', nested: { value: true } },
      createdAt: '2026-06-13T12:04:00Z',
    },
  ],
};

export const emptyHistoryDetail: OrderDetail = {
  ...baseSummary,
  history: [],
};

export const stateMachineDefinition: StateMachineDefinition = {
  initialState: 'Pending',
  states: ['Pending', 'PendingPayment', 'Cancelled'],
  transitions: [
    {
      fromState: 'Pending',
      eventType: 'noVerificationNeeded',
      toState: 'PendingPayment',
    },
    {
      fromState: 'Pending',
      eventType: 'orderCancelledByUser',
      toState: 'Cancelled',
    },
  ],
};
