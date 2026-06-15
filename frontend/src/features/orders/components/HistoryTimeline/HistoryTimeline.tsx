import styles from './HistoryTimeline.module.css';
import type { OrderHistoryEntry } from '../../model/order.types';
import { formatDateTime } from '../../../../shared/utils/date';
import { formatMetadata, formatOrderEvent } from '../../utils/orderFormatters';
import { StateBadge } from '../StateBadge/StateBadge';

type HistoryTimelineProps = Readonly<{
  history: OrderHistoryEntry[];
}>;

function historyKey(entry: OrderHistoryEntry, index: number): string {
  return `${entry.createdAt}-${entry.eventType}-${entry.fromState}-${entry.toState}-${index}`;
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className={styles.emptyHistory}>
        No events have been applied yet.
      </div>
    );
  }

  return (
    <ol
      className={styles.historyTimeline}
      aria-label="Order transition history"
    >
      {history.map((entry, index) => (
        <li key={historyKey(entry, index)} className={styles.historyItem}>
          <div className={styles.historyMarker} aria-hidden="true" />
          <div className={styles.historyCard}>
            <div className={styles.historyTitle}>
              <strong>{formatOrderEvent(entry.eventType)}</strong>
              <time dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <div className={styles.stateFlow}>
              <StateBadge state={entry.fromState} />
              <span aria-hidden="true">&rarr;</span>
              <StateBadge state={entry.toState} />
            </div>
            <pre className={styles.metadataBlock}>
              {formatMetadata(entry.metadata)}
            </pre>
          </div>
        </li>
      ))}
    </ol>
  );
}
