import { ORDER_EVENT_LABELS, type OrderEventType } from '../constants/orderEvents';
import { ORDER_STATE_LABELS, type OrderState } from '../constants/orderStates';
import type { OrderMetadata } from '../types/order';

const usdFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

export function formatCurrency(value: number): string {
  return usdFormatter.format(value);
}

export function formatShortOrderId(orderId: string): string {
  return orderId.slice(0, 8);
}

export function formatOrderState(state: OrderState): string {
  return ORDER_STATE_LABELS[state];
}

export function formatOrderEvent(eventType: OrderEventType): string {
  return ORDER_EVENT_LABELS[eventType];
}

export function formatMetadata(metadata: OrderMetadata): string {
  if (Object.keys(metadata).length === 0) {
    return 'No metadata';
  }

  return JSON.stringify(metadata, null, 2);
}
