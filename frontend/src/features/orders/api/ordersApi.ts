import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApplyOrderEventRequest,
  AvailableEventsResponse,
  CreateOrderRequest,
  HealthResponse,
  OrderDetail,
  OrderSummary,
} from '../model/order.types';

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health', { signal });
  return response.data;
}

export async function listOrders(signal?: AbortSignal): Promise<OrderSummary[]> {
  const response = await apiClient.get<OrderSummary[]>('/orders', { signal });
  return response.data;
}

export async function getOrder(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderDetail> {
  const response = await apiClient.get<OrderDetail>(`/orders/${orderId}`, {
    signal,
  });
  return response.data;
}

export async function createOrder(
  request: CreateOrderRequest,
): Promise<OrderDetail> {
  const response = await apiClient.post<OrderDetail>('/orders', request);
  return response.data;
}

export async function applyOrderEvent(
  orderId: string,
  request: ApplyOrderEventRequest,
): Promise<OrderDetail> {
  const response = await apiClient.post<OrderDetail>(
    `/orders/${orderId}/events`,
    request,
  );
  return response.data;
}

export async function getAvailableEvents(
  orderId: string,
  signal?: AbortSignal,
): Promise<AvailableEventsResponse['events']> {
  const response = await apiClient.get<AvailableEventsResponse>(
    `/orders/${orderId}/available-events`,
    { signal },
  );
  return response.data.events;
}
