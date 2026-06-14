import type { OrderEventType } from './orderEvents';
import type { OrderState } from './orderStates';

export type OrderMetadata = Record<string, unknown>;

export type OrderHistoryEntry = {
  eventType: OrderEventType;
  fromState: OrderState;
  toState: OrderState;
  metadata: OrderMetadata;
  createdAt: string;
};

export type OrderSummary = {
  orderId: string;
  productIds: string[];
  amount: number;
  currentState: OrderState;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetail = OrderSummary & {
  history: OrderHistoryEntry[];
};

export type CreateOrderRequest = {
  productIds: string[];
  amount: number;
};

export type ApplyOrderEventRequest = {
  eventType: OrderEventType;
  metadata: OrderMetadata;
};

export type AvailableEventsResponse = {
  events: OrderEventType[];
};

export type HealthResponse = {
  status: string;
};
