import { apiClient } from '../../../shared/api/apiClient';
import type {
  ApplyOrderEventRequest,
  AvailableEventsResponse,
  CreateOrderRequest,
  HealthResponse,
  OrderDetail,
  OrderSummary,
} from '../model/order.types';

export async function getHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}

export async function listOrders(): Promise<OrderSummary[]> {
  const response = await apiClient.get<OrderSummary[]>('/orders');
  return response.data;
}

export async function getOrder(orderId: string): Promise<OrderDetail> {
  const response = await apiClient.get<OrderDetail>(`/orders/${orderId}`);
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
): Promise<AvailableEventsResponse['events']> {
  const response = await apiClient.get<AvailableEventsResponse>(
    `/orders/${orderId}/available-events`,
  );
  return response.data.events;
}
