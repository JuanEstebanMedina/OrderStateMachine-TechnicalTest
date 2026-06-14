import styles from './App.module.css';

import { AppHeader } from './components/AppHeader/AppHeader';
import { CreateOrderForm } from '../features/orders/components/CreateOrderForm/CreateOrderForm';
import { DashboardSummary } from '../features/orders/components/DashboardSummary/DashboardSummary';
import { EventForm } from '../features/orders/components/EventForm/EventForm';
import { OrderDetail } from '../features/orders/components/OrderDetail/OrderDetail';
import { OrderList } from '../features/orders/components/OrderList/OrderList';
import { StateMachineDiagram } from '../features/orders/components/StateMachineDiagram/StateMachineDiagram';
import { useOrders } from '../features/orders/hooks/useOrders';
import { FeedbackAlert } from '../shared/ui/FeedbackAlert/FeedbackAlert';

const App = () => {
  const {
    applyEventToSelectedOrder,
    availableEvents,
    clearFeedback,
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
  } = useOrders();

  return (
    <div className={`${styles.moduleScope} app-shell`}>
      <AppHeader
        health={health}
        isRefreshing={loading.refresh}
        onRefresh={() => void refreshDashboard()}
      />
      <main className="dashboard-main">
        <FeedbackAlert feedback={feedback} onDismiss={clearFeedback} />
        <DashboardSummary orders={orders} />
        <CreateOrderForm
          isSubmitting={loading.create}
          onCreate={createNewOrder}
        />
        <div className="dashboard-grid">
          <OrderList
            error={listError}
            isLoading={loading.summaries}
            orders={orders}
            selectedOrderId={selectedOrderId}
            onRetry={() => void refreshSummaries()}
            onSelect={(orderId) => void selectOrder(orderId)}
          />
          <div className="detail-stack">
            <OrderDetail
              error={detailError}
              isLoading={loading.selection}
              order={selectedOrder}
            />
            <EventForm
              availableEvents={availableEvents}
              isDisabled={!selectedOrder}
              isSubmitting={loading.event}
              onApply={applyEventToSelectedOrder}
            />
          </div>
        </div>
        <StateMachineDiagram
          definition={stateMachine}
          error={diagramError}
          isLoading={loading.diagram}
          selectedState={selectedOrder?.currentState ?? null}
        />
      </main>
    </div>
  );
};

export default App;
