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
import buttonStyles from '../shared/styles/buttons.module.css';
import layoutStyles from '../shared/styles/layout.module.css';

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
    <div className={styles.appShell}>
      <AppHeader
        health={health}
        isRefreshing={loading.refresh}
        onRefresh={() => void refreshDashboard()}
      />
      <main className={styles.dashboardMain}>
        <FeedbackAlert feedback={feedback} onDismiss={clearFeedback} />

        {!isWorkspaceMode ? (
          <div className={styles.overviewLayout}>
            <DashboardSummary orders={orders} />
            <div className={styles.actionGrid}>
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
              states={stateMachine?.states ?? []}
              selectedOrderId={selectedOrderId}
              onRetry={() => void refreshSummaries()}
              onSelect={(orderId) => void openOrder(orderId)}
            />
          </div>
        ) : (
          <div className={styles.workspaceLayout}>
            <button
              type="button"
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.backButton}`}
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
                  currentState={selectedOrder.currentState}
                  isDisabled={!selectedOrder}
                  isLoading={loading.availableEvents}
                  isSubmitting={loading.event}
                  loadError={availableEventsError}
                  stateMachine={stateMachine}
                  onApply={applyEventToSelectedOrder}
                  onRetry={() => void retryAvailableEvents()}
                />
                <section
                  className={`${layoutStyles.panel} ${styles.historyPanel}`}
                  aria-labelledby="history-title"
                >
                  <h2 className={layoutStyles.panelTitle} id="history-title">
                    History
                  </h2>
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
