import { LoaderCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

import styles from './AppHeader.module.css';
import type { HealthState } from '../../../shared/types/health';
import buttonStyles from '../../../shared/styles/buttons.module.css';

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
  const isHealthy = health === 'connected';

  return (
    <header className={styles.appHeader}>
      <div>
        <p className={styles.eyebrow}>Operations dashboard</p>
        <h1>Order State Machine</h1>
        <p className={styles.subtitle}>
          Create orders, inspect transition history, and apply only backend-approved
          events.
        </p>
      </div>
      <div className={styles.headerActions}>
        <span
          className={`${styles.healthStatus} ${
            health === 'unavailable'
              ? styles.healthUnavailable
              : styles.healthSubtle
          }`}
          aria-live="polite"
          aria-label={isHealthy ? HEALTH_LABELS[health] : undefined}
        >
          <HealthIcon aria-hidden="true" size={18} />
          {isHealthy ? null : <span>{HEALTH_LABELS[health]}</span>}
        </span>
        <button
          type="button"
          className={`${buttonStyles.button} ${buttonStyles.secondary}`}
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw aria-hidden="true" size={18} />
          {isRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
      </div>
    </header>
  );
}
