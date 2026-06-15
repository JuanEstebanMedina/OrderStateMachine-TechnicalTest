import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import styles from './OrderList.module.css';
import type { OrderState } from '../../model/orderStates';
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
import a11yStyles from '../../../../shared/styles/a11y.module.css';
import buttonStyles from '../../../../shared/styles/buttons.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

type OrderListProps = Readonly<{
  error: string | null;
  isLoading: boolean;
  orders: OrderSummary[];
  states: OrderState[];
  selectedOrderId: string | null;
  onRetry: () => void;
  onSelect: (orderId: string) => void;
}>;

export function OrderList({
  error,
  isLoading,
  orders,
  states,
  selectedOrderId,
  onRetry,
  onSelect,
}: OrderListProps) {
  const [query, setQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const activeStateFilter =
    stateFilter !== 'all' && states.includes(stateFilter) ? stateFilter : 'all';

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesState =
        activeStateFilter === 'all' || order.currentState === activeStateFilter;
      const matchesQuery =
        !normalizedQuery ||
        order.orderId.toLowerCase().includes(normalizedQuery) ||
        order.currentState.toLowerCase().includes(normalizedQuery) ||
        order.productIds.some((productId) =>
          productId.toLowerCase().includes(normalizedQuery),
        );

      return matchesState && matchesQuery;
    });
  }, [activeStateFilter, orders, query]);

  return (
    <section
      className={`${layoutStyles.panel} ${styles.orderListPanel}`}
      aria-labelledby="orders-title"
    >
      <div className={layoutStyles.panelHeading}>
        <h2 className={layoutStyles.panelTitle} id="orders-title">
          Orders
        </h2>
        <span className={layoutStyles.panelMeta}>
          {filteredOrders.length} shown
        </span>
      </div>

      <div className={styles.listFilters}>
        <label className={styles.searchField} htmlFor="order-search">
          <Search aria-hidden="true" size={18} />
          <span className={a11yStyles.srOnly}>Search orders</span>
          <input
            id="order-search"
            className={`${formStyles.control} ${styles.searchControl}`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by order, product, or state"
          />
        </label>
        <label htmlFor="state-filter">
          <span className={a11yStyles.srOnly}>Filter by state</span>
          <select
            id="state-filter"
            className={formStyles.control}
            value={activeStateFilter}
            onChange={(event) => setStateFilter(event.target.value)}
          >
            <option value="all">All states</option>
            {states.map((state) => (
              <option value={state} key={state}>
                {formatOrderState(state)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading ? <LoadingState label="Loading orders" /> : null}

      {error ? (
        <div className={formStyles.inlineError} role="alert">
          <p>{error}</p>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            onClick={onRetry}
          >
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
        <ul className={styles.orderCardList} aria-label="Order cards">
          {filteredOrders.map((order) => (
            <li key={order.orderId}>
              <article
                className={`${styles.orderCard} ${
                  order.orderId === selectedOrderId ? styles.selectedOrderCard : ''
                }`}
              >
                <div className={styles.orderCardHeader}>
                  <div>
                    <p className={styles.eyebrow}>Order</p>
                    <h3>{formatShortOrderId(order.orderId)}</h3>
                  </div>
                  <StateBadge state={order.currentState} />
                </div>
                <dl className={styles.orderCardFacts}>
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
                  className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.orderCardAction}`}
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
