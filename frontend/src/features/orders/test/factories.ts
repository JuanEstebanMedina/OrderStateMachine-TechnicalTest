import type { OrderEventType } from '../model/orderEvents';
import type { OrderState } from '../model/orderStates';
import type {
  OrderDetail,
  OrderHistoryEntry,
  OrderSummary,
} from '../model/order.types';
import type { StateMachineDefinition } from '../model/stateMachine.types';

export function buildOrderSummary(
  overrides: Partial<OrderSummary> = {},
): OrderSummary {
  return {
    orderId: '11111111-1111-1111-1111-111111111111',
    productIds: ['product-1', 'product-2'],
    amount: 120.5,
    currentState: 'Pending',
    createdAt: '2026-06-13T12:00:00Z',
    updatedAt: '2026-06-13T12:05:00Z',
    ...overrides,
  };
}

export function buildHistoryEvent(
  overrides: Partial<OrderHistoryEntry> = {},
): OrderHistoryEntry {
  return {
    eventType: 'noVerificationNeeded',
    fromState: 'Pending',
    toState: 'PendingPayment',
    metadata: {},
    createdAt: '2026-06-13T12:04:00Z',
    ...overrides,
  };
}

export function buildOrderDetail(
  overrides: Partial<OrderDetail> = {},
): OrderDetail {
  return {
    ...buildOrderSummary(),
    currentState: 'PendingPayment',
    history: [buildHistoryEvent()],
    ...overrides,
  };
}

export function buildTransition(
  fromState: OrderState,
  eventType: OrderEventType,
  toState: OrderState,
) {
  return {
    fromState,
    eventType,
    toState,
  };
}

export function buildStateMachineDefinition(
  overrides: Partial<StateMachineDefinition> = {},
): StateMachineDefinition {
  return {
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
      buildTransition('Pending', 'noVerificationNeeded', 'PendingPayment'),
      buildTransition('Pending', 'orderCancelledByUser', 'Cancelled'),
      buildTransition(
        'Pending',
        'pendingBiometricalVerification',
        'OnHold',
      ),
      buildTransition('Pending', 'paymentFailed', 'Cancelled'),
      buildTransition('Pending', 'orderCancelled', 'Cancelled'),
      buildTransition('PendingPayment', 'paymentSuccessful', 'Confirmed'),
      buildTransition(
        'PendingPayment',
        'orderCancelledByUser',
        'Cancelled',
      ),
      buildTransition('Confirmed', 'preparingShipment', 'Processing'),
      buildTransition('Processing', 'itemDispatched', 'Shipped'),
    ],
    ...overrides,
  };
}

export const baseSummary = buildOrderSummary();

export const secondSummary = buildOrderSummary({
  orderId: '22222222-2222-2222-2222-222222222222',
  productIds: ['warehouse-kit'],
  amount: 80,
  currentState: 'Shipped',
  createdAt: '2026-06-13T13:00:00Z',
  updatedAt: '2026-06-13T13:05:00Z',
});

export const baseDetail = buildOrderDetail({
  ...baseSummary,
  currentState: 'PendingPayment',
  history: [
    buildHistoryEvent({
      metadata: { source: 'checkout', nested: { value: true } },
    }),
  ],
});

export const secondDetail = buildOrderDetail({
  ...secondSummary,
  history: [
    buildHistoryEvent({
      eventType: 'noVerificationNeeded',
      fromState: 'Pending',
      toState: 'PendingPayment',
      createdAt: '2026-06-13T13:01:00Z',
    }),
    buildHistoryEvent({
      eventType: 'paymentSuccessful',
      fromState: 'PendingPayment',
      toState: 'Confirmed',
      createdAt: '2026-06-13T13:02:00Z',
    }),
    buildHistoryEvent({
      eventType: 'preparingShipment',
      fromState: 'Confirmed',
      toState: 'Processing',
      createdAt: '2026-06-13T13:03:00Z',
    }),
    buildHistoryEvent({
      eventType: 'itemDispatched',
      fromState: 'Processing',
      toState: 'Shipped',
      createdAt: '2026-06-13T13:04:00Z',
    }),
  ],
});

export const cancelledDetail = buildOrderDetail({
  ...baseSummary,
  currentState: 'Cancelled',
  history: [
    buildHistoryEvent({
      eventType: 'paymentFailed',
      fromState: 'Pending',
      toState: 'Cancelled',
      createdAt: '2026-06-13T12:03:00Z',
    }),
  ],
});

export const emptyHistoryDetail = buildOrderDetail({
  ...baseSummary,
  history: [],
});

export const stateMachineDefinition = buildStateMachineDefinition({
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
});
