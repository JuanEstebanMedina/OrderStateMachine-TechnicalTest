import { Boxes, CheckCircle2, RotateCcw, Timer, XCircle } from 'lucide-react';

import styles from './DashboardSummary.module.css';
import { DASHBOARD_STATE_GROUPS } from '../../model/orderStates';
import type { OrderSummary } from '../../model/order.types';

type DashboardSummaryProps = {
  orders: OrderSummary[];
};

function countGroup(orders: OrderSummary[], states: readonly string[]): number {
  return orders.filter((order) => states.includes(order.currentState)).length;
}

export function DashboardSummary({ orders }: DashboardSummaryProps) {
  const summaries = [
    {
      label: 'Total',
      value: orders.length,
      icon: Boxes,
    },
    {
      label: 'In progress',
      value: countGroup(orders, DASHBOARD_STATE_GROUPS.inProgress),
      icon: Timer,
    },
    {
      label: 'Returns',
      value: countGroup(orders, DASHBOARD_STATE_GROUPS.returns),
      icon: RotateCcw,
    },
    {
      label: 'Completed',
      value: countGroup(orders, DASHBOARD_STATE_GROUPS.completed),
      icon: CheckCircle2,
    },
    {
      label: 'Cancelled',
      value: countGroup(orders, DASHBOARD_STATE_GROUPS.cancelled),
      icon: XCircle,
    },
  ];

  return (
    <section
      className={`${styles.moduleScope} summary-grid`}
      aria-label="Dashboard summary"
    >
      {summaries.map(({ label, value, icon: Icon }) => (
        <article className="summary-card" key={label}>
          <Icon aria-hidden="true" size={22} />
          <div>
            <p>{label}</p>
            <strong>{value}</strong>
          </div>
        </article>
      ))}
    </section>
  );
}
