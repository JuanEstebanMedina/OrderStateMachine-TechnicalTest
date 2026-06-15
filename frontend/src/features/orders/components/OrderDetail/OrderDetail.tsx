import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

import styles from './OrderDetail.module.css';
import type { OrderDetail as OrderDetailType } from '../../model/order.types';
import { formatDateTime } from '../../../../shared/utils/date';
import { formatCurrency } from '../../utils/orderFormatters';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState/LoadingState';
import { StateBadge } from '../StateBadge/StateBadge';
import buttonStyles from '../../../../shared/styles/buttons.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

type OrderDetailProps = Readonly<{
  error: string | null;
  isLoading: boolean;
  order: OrderDetailType | null;
}>;

export function OrderDetail({ error, isLoading, order }: OrderDetailProps) {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <section
        className={`${layoutStyles.panel} ${styles.detailPanel}`}
        aria-labelledby="order-detail-title"
      >
        <LoadingState label="Loading order detail" />
      </section>
    );
  }

  if (!order) {
    return (
      <section
        className={`${layoutStyles.panel} ${styles.detailPanel}`}
        aria-labelledby="order-detail-title"
      >
        <h2 className={layoutStyles.panelTitle} id="order-detail-title">
          Order workspace
        </h2>
        {error ? (
          <div className={formStyles.inlineError} role="alert">
            {error}
          </div>
        ) : (
          <EmptyState
            title="Order unavailable"
            message="The selected order could not be loaded."
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
    globalThis.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <section
      className={`${layoutStyles.panel} ${styles.detailPanel}`}
      aria-labelledby="order-detail-title"
    >
      <div className={layoutStyles.panelHeading}>
        <h2 className={layoutStyles.panelTitle} id="order-detail-title">
          Order identity
        </h2>
        <StateBadge state={order.currentState} />
      </div>

      {error ? (
        <div className={formStyles.inlineError} role="alert">
          {error}
        </div>
      ) : null}

      <dl className={styles.detailGrid}>
        <div>
          <dt>Order ID</dt>
          <dd className={styles.copyRow}>
            <code className={styles.code}>{order.orderId}</code>
            <button
              type="button"
              className={buttonStyles.iconButton}
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

      <div className={styles.productList} aria-label="Product IDs">
        {order.productIds.map((productId) => (
          <span key={productId}>{productId}</span>
        ))}
      </div>
    </section>
  );
}
