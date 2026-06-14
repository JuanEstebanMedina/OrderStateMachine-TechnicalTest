import styles from './App.module.css';

import { AppHeader } from './components/AppHeader/AppHeader';
import { CreateOrderForm } from '../features/orders/components/CreateOrderForm/CreateOrderForm';
import { DashboardSummary } from '../features/orders/components/DashboardSummary/DashboardSummary';
import { EventForm } from '../features/orders/components/EventForm/EventForm';
import { HistoryTimeline } from '../features/orders/components/HistoryTimeline/HistoryTimeline';
import { OpenOrderForm } from '../features/orders/components/OpenOrderForm/OpenOrderForm';
import { OrderDetail } from '../features/orders/components/OrderDetail/OrderDetail';
import { OrderList } from '../features/orders/components/OrderList/OrderList';
import { StateMachineDiagram } from '../features/orders/components/StateMachineDiagram/StateMachineDiagram';
import { useOrders } from '../features/orders/hooks/useOrders';
import { FeedbackAlert } from '../shared/ui/FeedbackAlert/FeedbackAlert';

const App = () => {
  const {
    applyEventToSelectedOrder,
    availableEvents,
    availableEventsError,
    backToOrders,
    clearFeedback,
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
  } = useOrders();
  const isWorkspaceMode = selectedOrderId !== null;

  return (
    <div className={`${styles.moduleScope} app-shell`}>
      <AppHeader
        health={health}
        isRefreshing={loading.refresh}
        onRefresh={() => void refreshDashboard()}
      />
      <main className="dashboard-main">
        <FeedbackAlert feedback={feedback} onDismiss={clearFeedback} />

        {!isWorkspaceMode ? (
          <div className="overview-layout">
            <DashboardSummary orders={orders} />
            <div className="action-grid">
              <CreateOrderForm
                isSubmitting={loading.create}
                onCreate={createNewOrder}
              />
              <OpenOrderForm
                isLoading={loading.detail}
                onOpen={openOrder}
              />
            </div>
            <OrderList
              error={listError}
              isLoading={loading.summaries}
              orders={orders}
              selectedOrderId={selectedOrderId}
              onRetry={() => void refreshSummaries()}
              onSelect={(orderId) => void openOrder(orderId)}
            />
          </div>
        ) : (
          <div className="workspace-layout">
            <button
              type="button"
              className="button secondary back-button"
              onClick={backToOrders}
            >
              Back to orders
            </button>
            <OrderDetail
              error={detailError}
              isLoading={loading.detail}
              order={selectedOrder}
            />

            {selectedOrder ? (
              <>
                <EventForm
                  availableEvents={availableEvents}
                  isDisabled={!selectedOrder}
                  isLoading={loading.availableEvents}
                  isSubmitting={loading.event}
                  loadError={availableEventsError}
                  onApply={applyEventToSelectedOrder}
                  onRetry={() => void retryAvailableEvents()}
                />
                <section className="panel history-panel" aria-labelledby="history-title">
                  <h2 id="history-title">History</h2>
                  <HistoryTimeline history={selectedOrder.history} />
                </section>
              </>
            ) : null}

            <StateMachineDiagram
              availableEvents={availableEvents}
              definition={stateMachine}
              error={diagramError}
              isLoading={loading.diagram}
              order={selectedOrder}
            />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
