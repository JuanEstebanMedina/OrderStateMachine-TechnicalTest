import { LoaderCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

import styles from './AppHeader.module.css';
import type { HealthState } from '../../../features/orders/hooks/useOrders';

type AppHeaderProps = {
  health: HealthState;
  isRefreshing: boolean;
  onRefresh: () => void;
};

const HEALTH_LABELS: Record<HealthState, string> = {
  checking: 'Checking',
  connected: 'Connected',
  unavailable: 'Unavailable',
};

export function AppHeader({ health, isRefreshing, onRefresh }: AppHeaderProps) {
  const HealthIcon =
    health === 'connected' ? Wifi : health === 'unavailable' ? WifiOff : LoaderCircle;

  return (
    <header className={`${styles.moduleScope} app-header`}>
      <div>
        <p className="eyebrow">Operations dashboard</p>
        <h1>Order State Machine</h1>
        <p className="subtitle">
          Create orders, inspect transition history, and apply only backend-approved
          events.
        </p>
      </div>
      <div className="header-actions">
        <span className={`health-pill health-${health}`} aria-live="polite">
          <HealthIcon aria-hidden="true" size={18} />
          {HEALTH_LABELS[health]}
        </span>
        <button type="button" className="button secondary" onClick={onRefresh}>
          <RefreshCw aria-hidden="true" size={18} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
