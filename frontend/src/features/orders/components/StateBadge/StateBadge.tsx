import styles from './StateBadge.module.css';
import type { OrderState } from '../../model/orderStates';
import { formatOrderState } from '../../utils/orderFormatters';

type StateBadgeProps = {
  state: OrderState;
};

export function StateBadge({ state }: StateBadgeProps) {
  return (
    <span className={`${styles.moduleScope} state-badge`} data-state={state}>
      {formatOrderState(state)}
    </span>
  );
}
