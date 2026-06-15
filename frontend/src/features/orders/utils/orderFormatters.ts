import {
  ORDER_EVENT_LABELS,
  isKnownOrderEventType,
  type OrderEventType,
} from '../model/orderEvents';
import {
  ORDER_STATE_LABELS,
  isKnownOrderState,
  type OrderState,
} from '../model/orderStates';
import type { OrderMetadata } from '../model/order.types';

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

function humanizeIdentifier(identifier: string): string {
  const trimmed = identifier.trim();

  if (!trimmed) {
    return 'Unknown';
  }

  return trimmed
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/^./, (firstCharacter) => firstCharacter.toUpperCase());
}

export function formatOrderState(state: OrderState): string {
  return isKnownOrderState(state) ? ORDER_STATE_LABELS[state] : humanizeIdentifier(state);
}

export function formatOrderEvent(eventType: OrderEventType): string {
  return isKnownOrderEventType(eventType)
    ? ORDER_EVENT_LABELS[eventType]
    : humanizeIdentifier(eventType);
}

export function formatMetadata(metadata: OrderMetadata): string {
  if (Object.keys(metadata).length === 0) {
    return 'No metadata';
  }

  return JSON.stringify(metadata, null, 2);
}
