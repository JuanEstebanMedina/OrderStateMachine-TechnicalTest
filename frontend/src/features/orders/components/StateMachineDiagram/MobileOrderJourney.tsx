import styles from './StateMachineDiagram.module.css';
import {
  createMobileJourneyItems,
  describeTransition,
  type JourneyModel,
} from './orderJourney';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';

type MobileOrderJourneyProps = Readonly<{
  definition: StateMachineDefinition;
  model: JourneyModel;
}>;

export function MobileOrderJourney({
  definition,
  model,
}: MobileOrderJourneyProps) {
  const items = createMobileJourneyItems(definition, model).filter(
    (item) => item.statuses.length > 0 || item.events.length > 0,
  );

  return (
    <div className={styles.mobileJourney} aria-label="Mobile order journey">
      <ol className={styles.mobileStateList}>
        {items.map((item) => (
          <li key={item.state} className={styles.mobileStateCard}>
            <div>
              <strong>{formatOrderState(item.state)}</strong>
              {item.statuses.length > 0 ? (
                <span>{item.statuses.join(' / ')}</span>
              ) : null}
            </div>
            {item.events.length > 0 ? (
              <ul aria-label={`Events to ${formatOrderState(item.state)}`}>
                {item.events.map((eventType) => (
                  <li key={`${item.state}-${eventType}`}>
                    {formatOrderEvent(eventType)}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <section aria-labelledby="mobile-history-title">
        <h3 id="mobile-history-title">Historical transitions</h3>
        {model.historicalEdges.length === 0 ? (
          <p className={styles.muted}>No transitions have been applied yet.</p>
        ) : (
          <ul className={styles.textTransitionList}>
            {model.historicalEdges.map((edge) => (
              <li key={`${edge.id}-mobile`}>{describeTransition(edge)}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
