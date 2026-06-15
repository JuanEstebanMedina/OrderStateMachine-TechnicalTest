export const KNOWN_ORDER_STATES = [
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

export type KnownOrderState = (typeof KNOWN_ORDER_STATES)[number];
export type OrderState = KnownOrderState | (string & {});

export const ORDER_STATE_LABELS: Record<KnownOrderState, string> = {
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

export function isKnownOrderState(state: OrderState): state is KnownOrderState {
  return KNOWN_ORDER_STATES.includes(state as KnownOrderState);
}
