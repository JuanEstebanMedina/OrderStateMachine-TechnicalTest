import { type FormEvent, useState } from 'react';
import { RefreshCw, Send } from 'lucide-react';

import styles from './EventForm.module.css';
import { orderAvailableEventsForDisplay } from './availableEventPresentation';
import type { OrderEventType } from '../../model/orderEvents';
import type { OrderState } from '../../model/orderStates';
import { formatOrderEvent } from '../../utils/orderFormatters';
import type { ApplyOrderEventRequest, OrderMetadata } from '../../model/order.types';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import buttonStyles from '../../../../shared/styles/buttons.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

type EventFormProps = {
  availableEvents: OrderEventType[];
  currentState: OrderState | null;
  loadError: string | null;
  isLoading: boolean;
  isSubmitting: boolean;
  isDisabled: boolean;
  stateMachine: StateMachineDefinition | null;
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
  currentState,
  loadError,
  isLoading,
  isSubmitting,
  isDisabled,
  stateMachine,
  onApply,
  onRetry,
}: EventFormProps) {
  const [selectedEvent, setSelectedEvent] = useState<OrderEventType | ''>('');
  const [metadataValue, setMetadataValue] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const displayEvents = orderAvailableEventsForDisplay({
    availableEvents,
    currentState,
    states: stateMachine?.states,
    transitions: stateMachine?.transitions,
  });
  const selectedEventValue =
    selectedEvent && displayEvents.includes(selectedEvent)
      ? selectedEvent
      : displayEvents[0] ?? '';

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
        className={`${layoutStyles.panel} ${styles.eventPanel}`}
        aria-labelledby="event-form-title"
      >
        <h2 className={layoutStyles.panelTitle} id="event-form-title">
          Apply available event
        </h2>
        <p className={formStyles.muted}>Select an order before applying events.</p>
      </section>
    );
  }

  return (
    <section
      className={`${layoutStyles.panel} ${styles.eventPanel}`}
      aria-labelledby="event-form-title"
    >
      <div className={layoutStyles.panelHeading}>
        <h2 className={layoutStyles.panelTitle} id="event-form-title">
          Apply available event
        </h2>
      </div>

      {isLoading ? (
        <p className={formStyles.muted} role="status">
          Loading available events.
        </p>
      ) : null}

      {loadError ? (
        <div className={formStyles.inlineError} role="alert">
          <p>{loadError}</p>
          <button
            type="button"
            className={`${buttonStyles.button} ${buttonStyles.secondary}`}
            onClick={onRetry}
          >
            <RefreshCw aria-hidden="true" size={18} />
            Retry available events
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && availableEvents.length === 0 ? (
        <p className={formStyles.muted}>
          No further transitions are available for this order.
        </p>
      ) : null}

      {!isLoading && !loadError && availableEvents.length > 0 ? (
        <form className={formStyles.form} onSubmit={handleSubmit} noValidate>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="eventType">
              Event
            </label>
            <select
              id="eventType"
              className={formStyles.control}
              value={selectedEventValue}
              onChange={(event) =>
                setSelectedEvent(event.target.value as OrderEventType)
              }
              disabled={isSubmitting}
            >
              {displayEvents.map((eventType) => (
                <option key={eventType} value={eventType}>
                  {formatOrderEvent(eventType)}
                </option>
              ))}
            </select>
          </div>
          <div className={formStyles.field}>
            <label className={formStyles.label} htmlFor="metadata">
              Metadata JSON
            </label>
            <textarea
              id="metadata"
              className={`${formStyles.control} ${formStyles.textarea}`}
              value={metadataValue}
              onChange={(event) => setMetadataValue(event.target.value)}
              rows={5}
              spellCheck={false}
            />
          </div>
          {error ? (
            <p className={formStyles.fieldError} role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            className={`${buttonStyles.button} ${buttonStyles.primary}`}
            disabled={isSubmitting}
          >
            <Send aria-hidden="true" size={18} />
            {isSubmitting ? 'Applying' : 'Apply event'}
          </button>
        </form>
      ) : null}
    </section>
  );
}
