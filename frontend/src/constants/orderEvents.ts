export const ORDER_EVENT_TYPES = [
  'init',
  'pendingBiometricalVerification',
  'noVerificationNeeded',
  'paymentFailed',
  'orderCancelled',
  'biometricalVerificationSuccessful',
  'verificationFailed',
  'orderCancelledByUser',
  'paymentSuccessful',
  'preparingShipment',
  'itemDispatched',
  'itemReceivedByCustomer',
  'deliveryIssue',
  'returnInitiatedByCustomer',
  'itemReceivedBack',
  'refundProcessed',
] as const;

export type OrderEventType = (typeof ORDER_EVENT_TYPES)[number];

export const ORDER_EVENT_LABELS: Record<OrderEventType, string> = {
  init: 'Created',
  pendingBiometricalVerification: 'Pending biometrical verification',
  noVerificationNeeded: 'No verification needed',
  paymentFailed: 'Payment failed',
  orderCancelled: 'Order cancelled',
  biometricalVerificationSuccessful: 'Biometrical verification successful',
  verificationFailed: 'Verification failed',
  orderCancelledByUser: 'Cancelled by user',
  paymentSuccessful: 'Payment successful',
  preparingShipment: 'Preparing shipment',
  itemDispatched: 'Item dispatched',
  itemReceivedByCustomer: 'Item received by customer',
  deliveryIssue: 'Delivery issue',
  returnInitiatedByCustomer: 'Return initiated by customer',
  itemReceivedBack: 'Item received back',
  refundProcessed: 'Refund processed',
};
