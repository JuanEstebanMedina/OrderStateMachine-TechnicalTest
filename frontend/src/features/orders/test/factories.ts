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
  currentState: 'PendingPayment',
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

export const secondDetail: OrderDetail = {
  ...secondSummary,
  history: [
    {
      eventType: 'noVerificationNeeded',
      fromState: 'Pending',
      toState: 'PendingPayment',
      metadata: {},
      createdAt: '2026-06-13T13:01:00Z',
    },
    {
      eventType: 'paymentSuccessful',
      fromState: 'PendingPayment',
      toState: 'Confirmed',
      metadata: {},
      createdAt: '2026-06-13T13:02:00Z',
    },
    {
      eventType: 'preparingShipment',
      fromState: 'Confirmed',
      toState: 'Processing',
      metadata: {},
      createdAt: '2026-06-13T13:03:00Z',
    },
    {
      eventType: 'itemDispatched',
      fromState: 'Processing',
      toState: 'Shipped',
      metadata: {},
      createdAt: '2026-06-13T13:04:00Z',
    },
  ],
};

export const cancelledDetail: OrderDetail = {
  ...baseSummary,
  currentState: 'Cancelled',
  history: [
    {
      eventType: 'paymentFailed',
      fromState: 'Pending',
      toState: 'Cancelled',
      metadata: {},
      createdAt: '2026-06-13T12:03:00Z',
    },
  ],
};

export const emptyHistoryDetail: OrderDetail = {
  ...baseSummary,
  history: [],
};

export const stateMachineDefinition: StateMachineDefinition = {
  initialState: 'Pending',
  states: [
    'Pending',
    'OnHold',
    'PendingPayment',
    'Confirmed',
    'Processing',
    'Shipped',
    'Delivered',
    'Returning',
    'Returned',
    'Refunded',
    'Cancelled',
  ],
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
    {
      fromState: 'Pending',
      eventType: 'pendingBiometricalVerification',
      toState: 'OnHold',
    },
    {
      fromState: 'Pending',
      eventType: 'paymentFailed',
      toState: 'Cancelled',
    },
    {
      fromState: 'Pending',
      eventType: 'orderCancelled',
      toState: 'Cancelled',
    },
    {
      fromState: 'PendingPayment',
      eventType: 'paymentSuccessful',
      toState: 'Confirmed',
    },
    {
      fromState: 'PendingPayment',
      eventType: 'orderCancelledByUser',
      toState: 'Cancelled',
    },
    {
      fromState: 'Confirmed',
      eventType: 'preparingShipment',
      toState: 'Processing',
    },
    {
      fromState: 'Processing',
      eventType: 'itemDispatched',
      toState: 'Shipped',
    },
  ],
};
