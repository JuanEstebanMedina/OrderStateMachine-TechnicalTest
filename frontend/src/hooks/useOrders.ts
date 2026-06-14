import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from '../api/orders';
import { getStateMachineDefinition } from '../api/stateMachine';
import type { OrderEventType } from '../constants/orderEvents';
import type {
  ApplyOrderEventRequest,
  CreateOrderRequest,
  OrderDetail,
  OrderSummary,
} from '../types/order';
import type { StateMachineDefinition } from '../types/stateMachine';
import { getApiErrorMessage, getApiErrorStatus } from '../utils/apiError';

export type HealthState = 'checking' | 'connected' | 'unavailable';

export type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
};

type LoadingState = {
  summaries: boolean;
  selection: boolean;
  create: boolean;
  event: boolean;
  refresh: boolean;
  diagram: boolean;
};

function upsertOrderSummary(
  orders: OrderSummary[],
  order: OrderDetail,
): OrderSummary[] {
  const summary: OrderSummary = {
    orderId: order.orderId,
    productIds: order.productIds,
    amount: order.amount,
    currentState: order.currentState,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
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

export function useOrders() {
  const [health, setHealth] = useState<HealthState>('checking');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [availableEvents, setAvailableEvents] = useState<OrderEventType[]>([]);
  const [stateMachine, setStateMachine] =
    useState<StateMachineDefinition | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({
    summaries: true,
    selection: false,
    create: false,
    event: false,
    refresh: false,
    diagram: true,
  });
  const selectionRequestId = useRef(0);

  const updateLoading = useCallback((updates: Partial<LoadingState>) => {
    setLoading((current) => ({ ...current, ...updates }));
  }, []);

  const checkHealth = useCallback(async () => {
    setHealth('checking');

    try {
      await getHealth();
      setHealth('connected');
    } catch {
      setHealth('unavailable');
    }
  }, []);

  const refreshSummaries = useCallback(async () => {
    updateLoading({ summaries: true });
    setListError(null);

    try {
      const nextOrders = await listOrders();
      setOrders(nextOrders);
      return nextOrders;
    } catch (error) {
      const message = getApiErrorMessage(error);
      setListError(message);
      throw error;
    } finally {
      updateLoading({ summaries: false });
    }
  }, [updateLoading]);

  const refreshStateMachine = useCallback(async () => {
    updateLoading({ diagram: true });
    setDiagramError(null);

    try {
      setStateMachine(await getStateMachineDefinition());
    } catch (error) {
      setDiagramError(getApiErrorMessage(error));
    } finally {
      updateLoading({ diagram: false });
    }
  }, [updateLoading]);

  const clearSelection = useCallback(() => {
    selectionRequestId.current += 1;
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setAvailableEvents([]);
  }, []);

  const selectOrder = useCallback(
    async (orderId: string) => {
      const requestId = selectionRequestId.current + 1;
      selectionRequestId.current = requestId;
      setSelectedOrderId(orderId);
      setDetailError(null);
      updateLoading({ selection: true });

      try {
        const [order, events] = await Promise.all([
          getOrder(orderId),
          getAvailableEvents(orderId),
        ]);

        if (selectionRequestId.current !== requestId) {
          return;
        }

        setSelectedOrder(order);
        setAvailableEvents(events);
        setOrders((current) => upsertOrderSummary(current, order));
      } catch (error) {
        if (selectionRequestId.current !== requestId) {
          return;
        }

        const message = getApiErrorMessage(error);
        setDetailError(message);
        setFeedback({ type: 'error', message });

        if (getApiErrorStatus(error) === 404) {
          clearSelection();
          try {
            await refreshSummaries();
          } catch {
            return;
          }
        }
      } finally {
        if (selectionRequestId.current === requestId) {
          updateLoading({ selection: false });
        }
      }
    },
    [clearSelection, refreshSummaries, updateLoading],
  );

  const createNewOrder = useCallback(
    async (request: CreateOrderRequest) => {
      updateLoading({ create: true });

      try {
        const order = await createOrder(request);
        selectionRequestId.current += 1;
        setSelectedOrderId(order.orderId);
        setSelectedOrder(order);
        setOrders((current) => upsertOrderSummary(current, order));
        setAvailableEvents(await getAvailableEvents(order.orderId));
        setFeedback({
          type: 'success',
          message: `Order ${order.orderId} created.`,
        });
      } catch (error) {
        const message = getApiErrorMessage(error);
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        updateLoading({ create: false });
      }
    },
    [updateLoading],
  );

  const applyEventToSelectedOrder = useCallback(
    async (request: ApplyOrderEventRequest) => {
      if (!selectedOrder) {
        return;
      }

      updateLoading({ event: true });

      try {
        const order = await applyOrderEvent(selectedOrder.orderId, request);
        setSelectedOrder(order);
        setSelectedOrderId(order.orderId);
        setOrders((current) => upsertOrderSummary(current, order));
        setAvailableEvents(await getAvailableEvents(order.orderId));
        setFeedback({
          type: 'success',
          message: `Applied ${request.eventType}.`,
        });
      } catch (error) {
        const message = getApiErrorMessage(error);
        setFeedback({ type: 'error', message });

        if (getApiErrorStatus(error) === 404) {
          clearSelection();
          try {
            await refreshSummaries();
          } catch {
            throw error;
          }
        }

        throw error;
      } finally {
        updateLoading({ event: false });
      }
    },
    [clearSelection, refreshSummaries, selectedOrder, updateLoading],
  );

  const refreshDashboard = useCallback(async () => {
    updateLoading({ refresh: true });

    try {
      await checkHealth();
      await refreshSummaries();

      if (selectedOrderId) {
        await selectOrder(selectedOrderId);
      }

      await refreshStateMachine();
    } finally {
      updateLoading({ refresh: false });
    }
  }, [
    checkHealth,
    refreshStateMachine,
    refreshSummaries,
    selectOrder,
    selectedOrderId,
    updateLoading,
  ]);

  useEffect(() => {
    let isActive = true;

    void Promise.resolve().then(() => {
      if (!isActive) {
        return;
      }

      void checkHealth();
      void refreshSummaries().catch(() => undefined);
      void refreshStateMachine();
    });

    return () => {
      isActive = false;
    };
  }, [checkHealth, refreshStateMachine, refreshSummaries]);

  return {
    availableEvents,
    clearFeedback: () => setFeedback(null),
    createNewOrder,
    detailError,
    diagramError,
    feedback,
    health,
    listError,
    loading,
    orders,
    refreshDashboard,
    refreshSummaries,
    selectOrder,
    selectedOrder,
    selectedOrderId,
    stateMachine,
    applyEventToSelectedOrder,
  };
}
