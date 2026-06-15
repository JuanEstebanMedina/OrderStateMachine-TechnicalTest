import { useCallback, useEffect, useState } from 'react';

import { createOrder, getHealth, listOrders } from '../api/ordersApi';
import { getStateMachineDefinition } from '../api/stateMachineApi';
import type { CreateOrderRequest, OrderDetail, OrderSummary } from '../model/order.types';
import type { StateMachineDefinition } from '../model/stateMachine.types';
import { getApiErrorMessage, isApiCancelError } from '../../../shared/api/apiError';
import type { FeedbackMessage } from '../../../shared/types/feedback';
import type { HealthState } from '../../../shared/types/health';
import { upsertOrderSummary } from './orderSummary';

type OverviewLoadingState = {
  summaries: boolean;
  create: boolean;
  diagram: boolean;
};

export function useOrdersOverview() {
  const [health, setHealth] = useState<HealthState>('checking');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [stateMachine, setStateMachine] =
    useState<StateMachineDefinition | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [loading, setLoading] = useState<OverviewLoadingState>({
    summaries: true,
    create: false,
    diagram: true,
  });

  const updateLoading = useCallback((updates: Partial<OverviewLoadingState>) => {
    setLoading((current) => ({ ...current, ...updates }));
  }, []);

  const showFeedback = useCallback((message: FeedbackMessage) => {
    setFeedback(message);
  }, []);

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const upsertSummary = useCallback((order: OrderDetail) => {
    setOrders((current) => upsertOrderSummary(current, order));
  }, []);

  const checkHealth = useCallback(
    async (signal?: AbortSignal, markChecking = true) => {
      if (markChecking) {
        setHealth('checking');
      }

      try {
        await getHealth(signal);
        setHealth('connected');
      } catch (error) {
        if (isApiCancelError(error)) {
          return;
        }

        setHealth('unavailable');
      }
    },
    [],
  );

  const refreshSummaries = useCallback(
    async (signal?: AbortSignal, markLoading = true) => {
      if (markLoading) {
        updateLoading({ summaries: true });
        setListError(null);
      }

      try {
        const nextOrders = await listOrders(signal);
        setOrders(nextOrders);
        return nextOrders;
      } catch (error) {
        if (isApiCancelError(error)) {
          return [];
        }

        const message = getApiErrorMessage(error);
        setListError(message);
        throw error;
      } finally {
        if (!signal?.aborted) {
          updateLoading({ summaries: false });
        }
      }
    },
    [updateLoading],
  );

  const refreshStateMachine = useCallback(
    async (signal?: AbortSignal, markLoading = true) => {
      if (markLoading) {
        updateLoading({ diagram: true });
        setDiagramError(null);
      }

      try {
        setStateMachine(await getStateMachineDefinition(signal));
      } catch (error) {
        if (isApiCancelError(error)) {
          return;
        }

        setDiagramError(getApiErrorMessage(error));
      } finally {
        if (!signal?.aborted) {
          updateLoading({ diagram: false });
        }
      }
    },
    [updateLoading],
  );

  const createNewOrder = useCallback(
    async (request: CreateOrderRequest) => {
      updateLoading({ create: true });

      try {
        const order = await createOrder(request);
        upsertSummary(order);
        setFeedback({
          type: 'success',
          message: `Order ${order.orderId} created.`,
        });
        return order;
      } catch (error) {
        const message = getApiErrorMessage(error);
        setFeedback({ type: 'error', message });
        throw error;
      } finally {
        updateLoading({ create: false });
      }
    },
    [updateLoading, upsertSummary],
  );

  const refreshOverview = useCallback(async () => {
    await Promise.allSettled([
      checkHealth(),
      refreshSummaries(),
      refreshStateMachine(),
    ]);
  }, [checkHealth, refreshStateMachine, refreshSummaries]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function initializeOverview() {
      await Promise.allSettled([
        checkHealth(signal, false),
        refreshSummaries(signal, false),
        refreshStateMachine(signal, false),
      ]);
    }

    void initializeOverview();

    return () => {
      controller.abort();
    };
  }, [checkHealth, refreshStateMachine, refreshSummaries]);

  return {
    checkHealth,
    clearFeedback,
    createNewOrder,
    diagramError,
    feedback,
    health,
    listError,
    loading,
    orders,
    refreshOverview,
    refreshStateMachine,
    refreshSummaries,
    showFeedback,
    stateMachine,
    upsertSummary,
  };
}
