import styles from './StateMachineDiagram.module.css';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';

type TransitionInventoryProps = Readonly<{
  definition: StateMachineDefinition;
}>;

function transitionKey(
  transition: StateMachineDefinition['transitions'][number],
) {
  return `${transition.fromState}-${transition.eventType}-${transition.toState}`;
}

export function TransitionInventory({ definition }: TransitionInventoryProps) {
  return (
    <details className={styles.transitionInventory}>
      <summary>View all backend transitions</summary>
      <div className={styles.inventoryScroller}>
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Event</th>
              <th scope="col">To</th>
            </tr>
          </thead>
          <tbody>
            {definition.transitions.map((transition) => (
              <tr key={transitionKey(transition)}>
                <td>{formatOrderState(transition.fromState)}</td>
                <td>{formatOrderEvent(transition.eventType)}</td>
                <td>{formatOrderState(transition.toState)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol
        className={styles.mobileTransitionInventory}
        aria-label="All backend transitions"
      >
        {definition.transitions.map((transition) => (
          <li
            className={styles.mobileTransitionCard}
            key={`mobile-${transitionKey(transition)}`}
          >
            <dl>
              <div>
                <dt>From</dt>
                <dd>{formatOrderState(transition.fromState)}</dd>
              </div>
              <div>
                <dt>Event</dt>
                <dd>{formatOrderEvent(transition.eventType)}</dd>
              </div>
              <div>
                <dt>To</dt>
                <dd>{formatOrderState(transition.toState)}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ol>
    </details>
  );
}
