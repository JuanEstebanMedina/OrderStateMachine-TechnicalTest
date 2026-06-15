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

export type KnownOrderEventType = (typeof ORDER_EVENT_TYPES)[number];
export type OrderEventType = KnownOrderEventType | (string & {});

export const ORDER_EVENT_LABELS: Record<KnownOrderEventType, string> = {
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

export function isKnownOrderEventType(
  eventType: OrderEventType,
): eventType is KnownOrderEventType {
  return ORDER_EVENT_TYPES.includes(eventType as KnownOrderEventType);
}
