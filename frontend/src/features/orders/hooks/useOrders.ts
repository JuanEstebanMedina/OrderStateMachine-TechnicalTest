import { useCallback, useEffect, useRef } from 'react';

import type { CreateOrderRequest } from '../model/order.types';
import { useOrderWorkspace } from './useOrderWorkspace';
import { useOrdersOverview } from './useOrdersOverview';

export function useOrders() {
  const workspaceRefreshRef = useRef<(() => Promise<void>) | null>(null);
  const overview = useOrdersOverview({
    refreshWorkspace: () => workspaceRefreshRef.current?.(),
  });
  const workspace = useOrderWorkspace({
    refreshSummaries: () => overview.refreshSummaries(),
    showFeedback: overview.showFeedback,
    upsertSummary: overview.upsertSummary,
  });

  useEffect(() => {
    workspaceRefreshRef.current = workspace.refreshWorkspace;
  }, [workspace.refreshWorkspace]);

  const createNewOrder = useCallback(
    async (request: CreateOrderRequest) => {
      const generationAtStart = workspace.getSelectionGeneration();
      const order = await overview.createNewOrder(request);
      workspace.selectCreatedOrderIfCurrent(order, generationAtStart);
    },
    [overview, workspace],
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
    },
    openOrder: workspace.openOrder,
    orders: overview.orders,
    refreshDashboard: overview.refreshDashboard,
    refreshSummaries: overview.refreshSummaries,
    retryAvailableEvents: workspace.retryAvailableEvents,
    selectedOrder: workspace.selectedOrder,
    selectedOrderId: workspace.selectedOrderId,
    stateMachine: overview.stateMachine,
  };
}
