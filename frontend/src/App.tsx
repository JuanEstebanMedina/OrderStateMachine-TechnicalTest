import './App.css';

import { AppHeader } from './components/AppHeader';
import { CreateOrderForm } from './components/CreateOrderForm';
import { DashboardSummary } from './components/DashboardSummary';
import { EventForm } from './components/EventForm';
import { FeedbackAlert } from './components/FeedbackAlert';
import { OrderDetail } from './components/OrderDetail';
import { OrderList } from './components/OrderList';
import { StateMachineDiagram } from './components/StateMachineDiagram';
import { useOrders } from './hooks/useOrders';

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
    <div className="app-shell">
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
