import { type FormEvent, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';

import styles from './EventForm.module.css';
import type { OrderEventType } from '../../model/orderEvents';
import { formatOrderEvent } from '../../utils/orderFormatters';
import type { ApplyOrderEventRequest, OrderMetadata } from '../../model/order.types';
import { getApiErrorMessage } from '../../../../shared/api/apiError';

type EventFormProps = {
  availableEvents: OrderEventType[];
  loadError: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDisabled: boolean;
  onApply: (request: ApplyOrderEventRequest) => Promise<void>;
  onRetry: () => void;
};

function parseMetadata(value: string): OrderMetadata {
  const parsed = JSON.parse(value) as unknown;

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error('Metadata must be a JSON object.');
  }

  return parsed as OrderMetadata;
}

export function EventForm({
  availableEvents,
  loadError,
  isLoading,
  isSubmitting,
  isDisabled,
  onApply,
  onRetry,
}: EventFormProps) {
  const [selectedEvent, setSelectedEvent] = useState<OrderEventType | ''>('');
  const [metadataValue, setMetadataValue] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const selectedEventValue =
    selectedEvent && availableEvents.includes(selectedEvent)
      ? selectedEvent
      : availableEvents[0] ?? '';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedEventValue) {
      return;
    }

    try {
      const metadata = parseMetadata(metadataValue);
      setError(null);
      await onApply({ eventType: selectedEventValue, metadata });
    } catch (submissionError) {
      setError(getApiErrorMessage(submissionError));
    }
  }

  if (isDisabled) {
    return (
      <section
        className={`${styles.moduleScope} panel event-panel`}
        aria-labelledby="event-form-title"
      >
        <h2 id="event-form-title">Apply available event</h2>
        <p className="muted">Select an order before applying events.</p>
      </section>
    );
  }

  return (
    <section
      className={`${styles.moduleScope} panel event-panel`}
      aria-labelledby="event-form-title"
    >
      <div className="panel-heading">
        <h2 id="event-form-title">Apply available event</h2>
      </div>

      {isLoading ? (
        <p className="muted" role="status">
          Loading available events.
        </p>
      ) : null}

      {loadError ? (
        <div className="inline-error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button secondary" onClick={onRetry}>
            <RefreshCw aria-hidden="true" size={18} />
            Retry available events
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && availableEvents.length === 0 ? (
        <p className="muted">
          No further transitions are available for this order.
        </p>
      ) : null}

      {!isLoading && !loadError && availableEvents.length > 0 ? (
        <form className="stacked-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="eventType">Event</label>
            <select
              id="eventType"
              value={selectedEventValue}
              onChange={(event) =>
                setSelectedEvent(event.target.value as OrderEventType)
              }
              disabled={isSubmitting}
            >
              {availableEvents.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {formatOrderEvent(eventType)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="metadata">Metadata JSON</label>
            <textarea
              id="metadata"
              value={metadataValue}
              onChange={(event) => setMetadataValue(event.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="button primary" disabled={isSubmitting}>
            <Send aria-hidden="true" size={18} />
            {isSubmitting ? 'Applying' : 'Apply event'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
