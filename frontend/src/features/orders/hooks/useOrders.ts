import { useCallback, useEffect, useRef, useState } from 'react';

import {
  applyOrderEvent,
  createOrder,
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from '../api/ordersApi';
import { getStateMachineDefinition } from '../api/stateMachineApi';
import type { OrderEventType } from '../model/orderEvents';
import type {
  ApplyOrderEventRequest,
  CreateOrderRequest,
  OrderDetail,
  OrderSummary,
} from '../model/order.types';
import type { StateMachineDefinition } from '../model/stateMachine.types';
import { getApiErrorMessage, getApiErrorStatus } from '../../../shared/api/apiError';

export type HealthState = 'checking' | 'connected' | 'unavailable';

export type FeedbackMessage = {
  type: 'success' | 'error';
  message: string;
};

type LoadingState = {
  summaries: boolean;
  detail: boolean;
  availableEvents: boolean;
  create: boolean;
  event: boolean;
  refresh: boolean;
  diagram: boolean;
};

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
  const [availableEventsError, setAvailableEventsError] = useState<string | null>(
    null,
  );
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [loading, setLoading] = useState<LoadingState>({
    summaries: true,
    detail: false,
    availableEvents: false,
    create: false,
    event: false,
    refresh: false,
    diagram: true,
  });
  const selectionGeneration = useRef(0);
  const selectedOrderIdRef = useRef<string | null>(null);

  const isCurrentSelection = useCallback((orderId: string, generation: number) => {
    return (
      selectedOrderIdRef.current === orderId &&
      selectionGeneration.current === generation
    );
  }, []);

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

  const loadAvailableEventsForSelection = useCallback(
    async (orderId: string, generation: number) => {
      updateLoading({ availableEvents: true });
      setAvailableEventsError(null);

      try {
        const events = await getAvailableEvents(orderId);

        if (!isCurrentSelection(orderId, generation)) {
          return events;
        }

        setAvailableEvents(events);
        return events;
      } catch (error) {
        if (isCurrentSelection(orderId, generation)) {
          setAvailableEvents([]);
          setAvailableEventsError(getApiErrorMessage(error));
        }

        throw error;
      } finally {
        if (isCurrentSelection(orderId, generation)) {
          updateLoading({ availableEvents: false });
        }
      }
    },
    [isCurrentSelection, updateLoading],
  );

  const retryAvailableEvents = useCallback(async () => {
    const orderId = selectedOrderIdRef.current;
    const generation = selectionGeneration.current;

    if (!orderId) {
      return;
    }

    try {
      await loadAvailableEventsForSelection(orderId, generation);
    } catch {
      return;
    }
  }, [loadAvailableEventsForSelection]);

  const clearSelection = useCallback(() => {
    selectionGeneration.current += 1;
    selectedOrderIdRef.current = null;
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setAvailableEvents([]);
    setDetailError(null);
    setAvailableEventsError(null);
    updateLoading({ detail: false, availableEvents: false, event: false });
  }, [updateLoading]);

  const openOrder = useCallback(
    async (orderId: string) => {
      const nextGeneration = selectionGeneration.current + 1;
      selectionGeneration.current = nextGeneration;
      selectedOrderIdRef.current = orderId;
      setSelectedOrderId(orderId);
      setSelectedOrder(null);
      setAvailableEvents([]);
      setDetailError(null);
      setAvailableEventsError(null);
      updateLoading({ detail: true, availableEvents: true, event: false });

      void loadAvailableEventsForSelection(orderId, nextGeneration).catch(() => {
        return;
      });

      try {
        const order = await getOrder(orderId);

        if (!isCurrentSelection(orderId, nextGeneration)) {
          return order;
        }

        setSelectedOrder(order);
        setOrders((current) => upsertOrderSummary(current, order));
        return order;
      } catch (error) {
        if (isCurrentSelection(orderId, nextGeneration)) {
          const message = getApiErrorMessage(error);
          setDetailError(message);
          setFeedback({ type: 'error', message });

          if (getApiErrorStatus(error) === 404) {
            try {
              await refreshSummaries();
            } catch {
              return Promise.reject(error);
            }
          }
        }

        return Promise.reject(error);
      } finally {
        if (isCurrentSelection(orderId, nextGeneration)) {
          updateLoading({ detail: false });
        }
      }
    },
    [
      isCurrentSelection,
      loadAvailableEventsForSelection,
      refreshSummaries,
      updateLoading,
    ],
  );

  const createNewOrder = useCallback(
    async (request: CreateOrderRequest) => {
      const generationAtStart = selectionGeneration.current;
      updateLoading({ create: true });

      try {
        const order = await createOrder(request);
        setOrders((current) => upsertOrderSummary(current, order));
        setFeedback({
          type: 'success',
          message: `Order ${order.orderId} created.`,
        });

        if (selectionGeneration.current === generationAtStart) {
          const nextGeneration = selectionGeneration.current + 1;
          selectionGeneration.current = nextGeneration;
          selectedOrderIdRef.current = order.orderId;
          setSelectedOrderId(order.orderId);
          setSelectedOrder(order);
          setAvailableEvents([]);
          setDetailError(null);
          setAvailableEventsError(null);
          updateLoading({ detail: false, availableEvents: true });

          void loadAvailableEventsForSelection(order.orderId, nextGeneration).catch(
            () => {
              return;
            },
          );
        }
      } catch (error) {
        const message = getApiErrorMessage(error);
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        updateLoading({ create: false });
      }
    },
    [loadAvailableEventsForSelection, updateLoading],
  );

  const applyEventToSelectedOrder = useCallback(
    async (request: ApplyOrderEventRequest) => {
      const targetOrder = selectedOrder;
      if (!targetOrder) {
        return;
      }

      const targetOrderId = targetOrder.orderId;
      const targetGeneration = selectionGeneration.current;
      updateLoading({ event: true });

      try {
        const order = await applyOrderEvent(targetOrderId, request);
        setOrders((current) => upsertOrderSummary(current, order));
        setFeedback({
          type: 'success',
          message: `Applied ${request.eventType}.`,
        });

        if (isCurrentSelection(targetOrderId, targetGeneration)) {
          setSelectedOrder(order);
          setDetailError(null);
          void loadAvailableEventsForSelection(
            targetOrderId,
            targetGeneration,
          ).catch(() => {
            return;
          });
        }
      } catch (error) {
        if (isCurrentSelection(targetOrderId, targetGeneration)) {
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
        }

        throw error;
      } finally {
        if (isCurrentSelection(targetOrderId, targetGeneration)) {
          updateLoading({ event: false });
        }
      }
    },
    [
      clearSelection,
      isCurrentSelection,
      loadAvailableEventsForSelection,
      refreshSummaries,
      selectedOrder,
      updateLoading,
    ],
  );

  const refreshDashboard = useCallback(async () => {
    updateLoading({ refresh: true });

    try {
      await checkHealth();
      await refreshSummaries();

      if (selectedOrderIdRef.current) {
        const orderId = selectedOrderIdRef.current;
        const generation = selectionGeneration.current + 1;
        selectionGeneration.current = generation;
        updateLoading({ detail: true, availableEvents: true });
        void loadAvailableEventsForSelection(orderId, generation).catch(() => {
          return;
        });

        try {
          const order = await getOrder(orderId);
          if (isCurrentSelection(orderId, generation)) {
            setSelectedOrder(order);
            setOrders((current) => upsertOrderSummary(current, order));
          }
        } catch (error) {
          if (isCurrentSelection(orderId, generation)) {
            setDetailError(getApiErrorMessage(error));
          }
        } finally {
          if (isCurrentSelection(orderId, generation)) {
            updateLoading({ detail: false });
          }
        }
      }

      await refreshStateMachine();
    } finally {
      updateLoading({ refresh: false });
    }
  }, [
    checkHealth,
    isCurrentSelection,
    loadAvailableEventsForSelection,
    refreshStateMachine,
    refreshSummaries,
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
    applyEventToSelectedOrder,
    availableEvents,
    availableEventsError,
    backToOrders: clearSelection,
    clearFeedback: () => setFeedback(null),
    createNewOrder,
    detailError,
    diagramError,
    feedback,
    health,
    listError,
    loading,
    openOrder,
    orders,
    refreshDashboard,
    refreshSummaries,
    retryAvailableEvents,
    selectedOrder,
    selectedOrderId,
    stateMachine,
  };
}
