import type { OrderState } from '../constants/orderStates';
import { formatOrderState } from '../utils/format';

type StateBadgeProps = {
  state: OrderState;
};

export function StateBadge({ state }: StateBadgeProps) {
  return (
    <span className="state-badge" data-state={state}>
      {formatOrderState(state)}
    </span>
  );
}
