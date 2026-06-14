import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import styles from './OrderList.module.css';
import { ORDER_STATES } from '../../model/orderStates';
import type { OrderSummary } from '../../model/order.types';
import { formatDateTime } from '../../../../shared/utils/date';
import {
  formatCurrency,
  formatOrderState,
  formatShortOrderId,
} from '../../utils/orderFormatters';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState/LoadingState';
import { StateBadge } from '../StateBadge/StateBadge';

type OrderListProps = {
  error: string | null;
  isLoading: boolean;
  orders: OrderSummary[];
  selectedOrderId: string | null;
  onRetry: () => void;
  onSelect: (orderId: string) => void;
};

export function OrderList({
  error,
  isLoading,
  orders,
  selectedOrderId,
  onRetry,
  onSelect,
}: OrderListProps) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesState =
        stateFilter === 'all' || order.currentState === stateFilter;
      const matchesQuery =
        !normalizedQuery ||
        order.orderId.toLowerCase().includes(normalizedQuery) ||
        order.currentState.toLowerCase().includes(normalizedQuery) ||
        order.productIds.some((productId) =>
          productId.toLowerCase().includes(normalizedQuery),
        );

      return matchesState && matchesQuery;
    });
  }, [orders, query, stateFilter]);

  return (
    <section
      className={`${styles.moduleScope} panel order-list-panel`}
      aria-labelledby="orders-title"
    >
      <div className="panel-heading">
        <h2 id="orders-title">Orders</h2>
        <span>{filteredOrders.length} shown</span>
      </div>

      <div className="list-filters">
        <label className="search-field" htmlFor="order-search">
          <Search aria-hidden="true" size={18} />
          <span className="sr-only">Search orders</span>
          <input
            id="order-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by order, product, or state"
          />
        </label>
        <label htmlFor="state-filter">
          <span className="sr-only">Filter by state</span>
          <select
            id="state-filter"
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            <option value="all">All states</option>
            {ORDER_STATES.map((state) => (
              <option value={state} key={state}>
                {formatOrderState(state)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? <LoadingState label="Loading orders" /> : null}

      {error ? (
        <div className="inline-error" role="alert">
          <p>{error}</p>
          <button type="button" className="button secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      ) : null}

      {!isLoading && !error && filteredOrders.length === 0 ? (
        <EmptyState
          title="No orders found"
          message="Create an order or adjust the current filters."
        />
      ) : null}

      {filteredOrders.length > 0 ? (
        <ul className="order-card-list" aria-label="Order cards">
          {filteredOrders.map((order) => (
            <li key={order.orderId}>
              <article
                className={[
                  'order-card',
                  order.orderId === selectedOrderId ? 'selected-order-card' : '',
                ].join(' ')}
              >
                <div className="order-card-header">
                  <div>
                    <p className="eyebrow">Order</p>
                    <h3>{formatShortOrderId(order.orderId)}</h3>
                  </div>
                  <StateBadge state={order.currentState} />
                </div>
                <dl className="order-card-facts">
                  <div>
                    <dt>Products</dt>
                    <dd>{order.productIds.length}</dd>
                  </div>
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatCurrency(order.amount)}</dd>
                  </div>
                  <div>
                    <dt>Updated</dt>
                    <dd>{formatDateTime(order.updatedAt)}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  aria-label={`Open order ${order.orderId}`}
                  className="button secondary order-card-action"
                  onClick={() => onSelect(order.orderId)}
                >
                  Open order
                </button>
              </article>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
