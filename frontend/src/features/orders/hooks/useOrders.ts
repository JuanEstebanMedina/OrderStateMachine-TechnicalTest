import { useCallback, useState } from 'react';

import type { CreateOrderRequest } from '../model/order.types';
import { useOrderWorkspace } from './useOrderWorkspace';
import { useOrdersOverview } from './useOrdersOverview';

export function useOrders() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const overview = useOrdersOverview();
  const workspace = useOrderWorkspace({
    refreshSummaries: () => overview.refreshSummaries(),
    showFeedback: overview.showFeedback,
    upsertSummary: overview.upsertSummary,
  });

  const createOverviewOrder = overview.createNewOrder;
  const getSelectionGeneration = workspace.getSelectionGeneration;
  const refreshOverview = overview.refreshOverview;
  const refreshWorkspace = workspace.refreshWorkspace;
  const selectCreatedOrderIfCurrent = workspace.selectCreatedOrderIfCurrent;

  const createNewOrder = useCallback(
    async (request: CreateOrderRequest) => {
      const generationAtStart = getSelectionGeneration();
      const order = await createOverviewOrder(request);
      selectCreatedOrderIfCurrent(order, generationAtStart);
    },
    [createOverviewOrder, getSelectionGeneration, selectCreatedOrderIfCurrent],
  );

  const refreshDashboard = useCallback(async () => {
    setIsRefreshing(true);

    try {
      await Promise.allSettled([
        refreshOverview(),
        refreshWorkspace(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshOverview, refreshWorkspace],
  );

  return {
    applyEventToSelectedOrder: workspace.applyEventToSelectedOrder,
    availableEvents: workspace.availableEvents,
    availableEventsError: workspace.availableEventsError,
    backToOrders: workspace.backToOrders,
    clearFeedback: overview.clearFeedback,
    createNewOrder,
    detailError: workspace.detailError,
    diagramError: overview.diagramError,
    feedback: overview.feedback,
    health: overview.health,
    listError: overview.listError,
    loading: {
      ...overview.loading,
      ...workspace.loading,
      refresh: isRefreshing,
    },
    openOrder: workspace.openOrder,
    orders: overview.orders,
    refreshDashboard,
    refreshSummaries: overview.refreshSummaries,
    retryAvailableEvents: workspace.retryAvailableEvents,
    selectedOrder: workspace.selectedOrder,
    selectedOrderId: workspace.selectedOrderId,
    stateMachine: overview.stateMachine,
  };
}
