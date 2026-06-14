import type { OrderHistoryEntry } from '../types/order';
import { formatDateTime } from '../utils/date';
import { formatMetadata, formatOrderEvent } from '../utils/format';
import { StateBadge } from './StateBadge';

type HistoryTimelineProps = {
  history: OrderHistoryEntry[];
};

function historyKey(entry: OrderHistoryEntry, index: number): string {
  return `${entry.createdAt}-${entry.eventType}-${entry.fromState}-${entry.toState}-${index}`;
}

export function HistoryTimeline({ history }: HistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="empty-history">
        No events have been applied yet.
      </div>
    );
  }

  return (
    <ol className="history-timeline" aria-label="Order transition history">
      {history.map((entry, index) => (
        <li key={historyKey(entry, index)} className="history-item">
          <div className="history-marker" aria-hidden="true" />
          <div className="history-card">
            <div className="history-title">
              <strong>{formatOrderEvent(entry.eventType)}</strong>
              <time dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <div className="state-flow">
              <StateBadge state={entry.fromState} />
              <span aria-hidden="true">&rarr;</span>
              <StateBadge state={entry.toState} />
            </div>
            <pre className="metadata-block">{formatMetadata(entry.metadata)}</pre>
          </div>
        </li>
      ))}
    </ol>
  );
}
