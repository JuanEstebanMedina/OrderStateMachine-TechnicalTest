import { useCallback, useEffect, useRef, useState } from 'react';

import { applyOrderEvent, getAvailableEvents, getOrder } from '../api/ordersApi';
import type { OrderEventType } from '../model/orderEvents';
import type {
  ApplyOrderEventRequest,
  OrderDetail,
} from '../model/order.types';
import {
  getApiErrorMessage,
  getApiErrorStatus,
  isApiCancelError,
} from '../../../shared/api/apiError';
import type { FeedbackMessage } from '../../../shared/types/feedback';

type WorkspaceLoadingState = {
  detail: boolean;
  availableEvents: boolean;
  event: boolean;
};

type UseOrderWorkspaceOptions = {
  refreshSummaries: () => Promise<unknown>;
  showFeedback: (message: FeedbackMessage) => void;
  upsertSummary: (order: OrderDetail) => void;
};

type WorkspaceLoadOptions = {
  generation: number;
  orderId: string;
  resetDetail: boolean;
  signal: AbortSignal;
};

function isCancelled(error: unknown, signal?: AbortSignal) {
  return signal?.aborted || isApiCancelError(error);
}

export function useOrderWorkspace({
  refreshSummaries,
  showFeedback,
  upsertSummary,
}: UseOrderWorkspaceOptions) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [availableEvents, setAvailableEvents] = useState<OrderEventType[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [availableEventsError, setAvailableEventsError] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState<WorkspaceLoadingState>({
    detail: false,
    availableEvents: false,
    event: false,
  });
  const selectionGeneration = useRef(0);
  const selectedOrderIdRef = useRef<string | null>(null);
  const workspaceLoadController = useRef<AbortController | null>(null);
  const availableEventsLoadController = useRef<AbortController | null>(null);

  const updateLoading = useCallback((updates: Partial<WorkspaceLoadingState>) => {
    setLoading((current) => ({ ...current, ...updates }));
  }, []);

  const isCurrentSelection = useCallback((orderId: string, generation: number) => {
    return (
      selectedOrderIdRef.current === orderId &&
      selectionGeneration.current === generation
    );
  }, []);

  const getSelectionGeneration = useCallback(() => {
    return selectionGeneration.current;
  }, []);

  const abortWorkspaceLoad = useCallback(() => {
    workspaceLoadController.current?.abort();
    workspaceLoadController.current = null;
  }, []);

  const abortAvailableEventsLoad = useCallback(() => {
    availableEventsLoadController.current?.abort();
    availableEventsLoadController.current = null;
  }, []);

  const abortAllWorkspaceRequests = useCallback(() => {
    abortWorkspaceLoad();
    abortAvailableEventsLoad();
  }, [abortAvailableEventsLoad, abortWorkspaceLoad]);

  const startWorkspaceLoad = useCallback(() => {
    abortWorkspaceLoad();
    abortAvailableEventsLoad();
    const controller = new AbortController();
    workspaceLoadController.current = controller;
    return controller;
  }, [abortAvailableEventsLoad, abortWorkspaceLoad]);

  const startAvailableEventsLoad = useCallback(() => {
    abortAvailableEventsLoad();
    const controller = new AbortController();
    availableEventsLoadController.current = controller;
    return controller;
  }, [abortAvailableEventsLoad]);

  const loadAvailableEventsForSelection = useCallback(
    async (orderId: string, generation: number, signal?: AbortSignal) => {
      updateLoading({ availableEvents: true });
      setAvailableEventsError(null);

      try {
        const events = await getAvailableEvents(orderId, signal);

        if (!isCurrentSelection(orderId, generation)) {
          return events;
        }

        setAvailableEvents(events);
        return events;
      } catch (error) {
        if (isCancelled(error, signal)) {
          return [];
        }

        if (isCurrentSelection(orderId, generation)) {
          setAvailableEvents([]);
          setAvailableEventsError(getApiErrorMessage(error));
        }

        throw error;
      } finally {
        if (!signal?.aborted && isCurrentSelection(orderId, generation)) {
          updateLoading({ availableEvents: false });
        }
      }
    },
    [isCurrentSelection, updateLoading],
  );

  const loadWorkspaceOrder = useCallback(
    async ({
      orderId,
      generation,
      resetDetail,
      signal,
    }: WorkspaceLoadOptions) => {
      if (resetDetail) {
        setSelectedOrder(null);
        setAvailableEvents([]);
      }

      setDetailError(null);
      setAvailableEventsError(null);
      updateLoading({ detail: true, availableEvents: true, event: false });

      const detailPromise = getOrder(orderId, signal)
        .then((order) => {
          if (isCurrentSelection(orderId, generation)) {
            setSelectedOrder(order);
            upsertSummary(order);
          }

          return order;
        })
        .catch(async (error: unknown) => {
          if (isCancelled(error, signal)) {
            return Promise.reject(error);
          }

          if (isCurrentSelection(orderId, generation)) {
            const message = getApiErrorMessage(error);
            setDetailError(message);
            showFeedback({ type: 'error', message });

            if (getApiErrorStatus(error) === 404) {
              try {
                await refreshSummaries();
              } catch {
                return Promise.reject(error);
              }
            }
          }

          return Promise.reject(error);
        })
        .finally(() => {
          if (!signal.aborted && isCurrentSelection(orderId, generation)) {
            updateLoading({ detail: false });
          }
        });

      const eventsPromise = loadAvailableEventsForSelection(
        orderId,
        generation,
        signal,
      );
      const [detailResult] = await Promise.allSettled([
        detailPromise,
        eventsPromise,
      ]);

      if (detailResult.status === 'rejected') {
        if (isCancelled(detailResult.reason, signal)) {
          return null;
        }

        throw detailResult.reason;
      }

      return detailResult.value;
    },
    [
      isCurrentSelection,
      loadAvailableEventsForSelection,
      refreshSummaries,
      showFeedback,
      updateLoading,
      upsertSummary,
    ],
  );

  const openOrder = useCallback(
    async (orderId: string) => {
      const controller = startWorkspaceLoad();
      const nextGeneration = selectionGeneration.current + 1;
      selectionGeneration.current = nextGeneration;
      selectedOrderIdRef.current = orderId;
      setSelectedOrderId(orderId);

      return loadWorkspaceOrder({
        generation: nextGeneration,
        orderId,
        resetDetail: true,
        signal: controller.signal,
      });
    },
    [loadWorkspaceOrder, startWorkspaceLoad],
  );

  const selectCreatedOrderIfCurrent = useCallback(
    (order: OrderDetail, generationAtStart: number) => {
      if (selectionGeneration.current !== generationAtStart) {
        return;
      }

      abortAllWorkspaceRequests();
      const nextGeneration = selectionGeneration.current + 1;
      const controller = startAvailableEventsLoad();
      selectionGeneration.current = nextGeneration;
      selectedOrderIdRef.current = order.orderId;
      setSelectedOrderId(order.orderId);
      setSelectedOrder(order);
      setAvailableEvents([]);
      setDetailError(null);
      setAvailableEventsError(null);
      updateLoading({ detail: false, availableEvents: true });

      void loadAvailableEventsForSelection(
        order.orderId,
        nextGeneration,
        controller.signal,
      ).catch(() => undefined);
    },
    [
      abortAllWorkspaceRequests,
      loadAvailableEventsForSelection,
      startAvailableEventsLoad,
      updateLoading,
    ],
  );

  const retryAvailableEvents = useCallback(async () => {
    const orderId = selectedOrderIdRef.current;
    const generation = selectionGeneration.current;

    if (!orderId) {
      return;
    }

    try {
      const controller = startAvailableEventsLoad();
      await loadAvailableEventsForSelection(
        orderId,
        generation,
        controller.signal,
      );
    } catch {
      return;
    }
  }, [loadAvailableEventsForSelection, startAvailableEventsLoad]);

  const backToOrders = useCallback(() => {
    abortAllWorkspaceRequests();
    selectionGeneration.current += 1;
    selectedOrderIdRef.current = null;
    setSelectedOrderId(null);
    setSelectedOrder(null);
    setAvailableEvents([]);
    setDetailError(null);
    setAvailableEventsError(null);
    updateLoading({ detail: false, availableEvents: false, event: false });
  }, [abortAllWorkspaceRequests, updateLoading]);

  const refreshWorkspace = useCallback(async () => {
    const orderId = selectedOrderIdRef.current;

    if (!orderId) {
      return;
    }

    const controller = startWorkspaceLoad();
    const generation = selectionGeneration.current + 1;
    selectionGeneration.current = generation;

    await loadWorkspaceOrder({
      generation,
      orderId,
      resetDetail: false,
      signal: controller.signal,
    });
  }, [loadWorkspaceOrder, startWorkspaceLoad]);

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
        upsertSummary(order);
        showFeedback({
          type: 'success',
          message: `Applied ${request.eventType}.`,
        });

        if (isCurrentSelection(targetOrderId, targetGeneration)) {
          setSelectedOrder(order);
          setDetailError(null);
          const controller = startAvailableEventsLoad();
          void loadAvailableEventsForSelection(
            targetOrderId,
            targetGeneration,
            controller.signal,
          ).catch(() => undefined);
        }
      } catch (error) {
        if (isCurrentSelection(targetOrderId, targetGeneration)) {
          const message = getApiErrorMessage(error);
          showFeedback({ type: 'error', message });

          if (getApiErrorStatus(error) === 404) {
            backToOrders();
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
      backToOrders,
      isCurrentSelection,
      loadAvailableEventsForSelection,
      refreshSummaries,
      selectedOrder,
      showFeedback,
      startAvailableEventsLoad,
      updateLoading,
      upsertSummary,
    ],
  );

  useEffect(() => abortAllWorkspaceRequests, [abortAllWorkspaceRequests]);

  return {
    applyEventToSelectedOrder,
    availableEvents,
    availableEventsError,
    backToOrders,
    detailError,
    getSelectionGeneration,
    loading,
    openOrder,
    refreshWorkspace,
    retryAvailableEvents,
    selectedOrder,
    selectedOrderId,
    selectCreatedOrderIfCurrent,
  };
}
