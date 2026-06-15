import { LoaderCircle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

import styles from './AppHeader.module.css';
import type { HealthState } from '../../../shared/types/health';
import buttonStyles from '../../../shared/styles/buttons.module.css';

type AppHeaderProps = Readonly<{
  health: HealthState;
  isRefreshing: boolean;
  onRefresh: () => void;
}>;

const HEALTH_LABELS: Record<HealthState, string> = {
  checking: 'Checking',
  connected: 'Connected',
  unavailable: 'Unavailable',
};

export function AppHeader({ health, isRefreshing, onRefresh }: AppHeaderProps) {
  const isHealthy = health === 'connected';
  const healthStatusClassName = [
    styles.healthStatus,
    health === 'unavailable' ? styles.healthUnavailable : styles.healthSubtle,
  ].join(' ');

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
          className={healthStatusClassName}
          aria-live="polite"
          aria-label={isHealthy ? HEALTH_LABELS[health] : undefined}
        >
          {health === 'connected' ? <Wifi aria-hidden="true" size={18} /> : null}
          {health === 'unavailable' ? <WifiOff aria-hidden="true" size={18} /> : null}
          {health === 'checking' ? (
            <LoaderCircle aria-hidden="true" size={18} />
          ) : null}
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
