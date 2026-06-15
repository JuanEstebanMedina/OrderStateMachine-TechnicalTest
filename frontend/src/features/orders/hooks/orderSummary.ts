import type { OrderDetail, OrderSummary } from '../model/order.types';

export function toOrderSummary(order: OrderDetail): OrderSummary {
  return {
    orderId: order.orderId,
    productIds: order.productIds,
    amount: order.amount,
    currentState: order.currentState,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export function upsertOrderSummary(
  orders: OrderSummary[],
  order: OrderDetail,
): OrderSummary[] {
  const summary = toOrderSummary(order);
  const existingIndex = orders.findIndex(
    (candidate) => candidate.orderId === summary.orderId,
  );

  if (existingIndex === -1) {
    return [summary, ...orders];
  }

  return orders.map((candidate) =>
    candidate.orderId === summary.orderId ? summary : candidate,
  );
}
