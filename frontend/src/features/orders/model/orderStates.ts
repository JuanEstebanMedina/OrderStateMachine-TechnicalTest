export const ORDER_STATES = [
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
] as const;

export type OrderState = (typeof ORDER_STATES)[number];

export const ORDER_STATE_LABELS: Record<OrderState, string> = {
  Pending: 'Pending',
  OnHold: 'On hold',
  PendingPayment: 'Pending payment',
  Confirmed: 'Confirmed',
  Processing: 'Processing',
  Shipped: 'Shipped',
  Delivered: 'Delivered',
  Returning: 'Returning',
  Returned: 'Returned',
  Refunded: 'Refunded',
  Cancelled: 'Cancelled',
};

export const DASHBOARD_STATE_GROUPS = {
  inProgress: [
    'Pending',
    'OnHold',
    'PendingPayment',
    'Confirmed',
    'Processing',
    'Shipped',
  ],
  returns: ['Returning', 'Returned'],
  completed: ['Delivered', 'Refunded'],
  cancelled: ['Cancelled'],
} as const satisfies Record<string, readonly OrderState[]>;
