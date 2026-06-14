import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import type { OrderDetail as OrderDetailType } from '../types/order';
import { formatDateTime } from '../utils/date';
import { formatCurrency } from '../utils/format';
import { EmptyState } from './EmptyState';
import { HistoryTimeline } from './HistoryTimeline';
import { LoadingState } from './LoadingState';
import { StateBadge } from './StateBadge';

type OrderDetailProps = {
  error: string | null;
  isLoading: boolean;
  order: OrderDetailType | null;
};

export function OrderDetail({ error, isLoading, order }: OrderDetailProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <section className="panel detail-panel" aria-labelledby="order-detail-title">
        <LoadingState label="Loading order detail" />
      </section>
    );
  }

  if (!order) {
    return (
      <section className="panel detail-panel" aria-labelledby="order-detail-title">
        <h2 id="order-detail-title">Order detail</h2>
        {error ? (
          <div className="inline-error" role="alert">
            {error}
          </div>
        ) : (
          <EmptyState
            title="Select an order"
            message="Choose an order from the list to inspect its state and history."
          />
        )}
      </section>
    );
  }

  async function copyOrderId() {
    if (!order || !navigator.clipboard) {
      return;
    }

    await navigator.clipboard.writeText(order.orderId);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section className="panel detail-panel" aria-labelledby="order-detail-title">
      <div className="panel-heading">
        <h2 id="order-detail-title">Order detail</h2>
        <StateBadge state={order.currentState} />
      </div>

      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}

      <dl className="detail-grid">
        <div>
          <dt>Order ID</dt>
          <dd className="copy-row">
            <code>{order.orderId}</code>
            <button
              type="button"
              className="icon-button"
              onClick={copyOrderId}
              aria-label="Copy order ID"
            >
              {copied ? (
                <Check aria-hidden="true" size={18} />
              ) : (
                <Copy aria-hidden="true" size={18} />
              )}
            </button>
          </dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{formatCurrency(order.amount)}</dd>
        </div>
        <div>
          <dt>Created</dt>
          <dd>{formatDateTime(order.createdAt)}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{formatDateTime(order.updatedAt)}</dd>
        </div>
        <div>
          <dt>Transitions</dt>
          <dd>{order.history.length}</dd>
        </div>
      </dl>

      <div className="product-list" aria-label="Product IDs">
        {order.productIds.map((productId) => (
          <span key={productId}>{productId}</span>
        ))}
      </div>

      <div className="history-section">
        <h3>History</h3>
        <HistoryTimeline history={order.history} />
      </div>
    </section>
  );
}
