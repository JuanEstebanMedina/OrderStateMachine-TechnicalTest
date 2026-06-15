import styles from './StateMachineDiagram.module.css';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';

type TransitionInventoryProps = Readonly<{
  definition: StateMachineDefinition;
}>;

export function TransitionInventory({ definition }: TransitionInventoryProps) {
  return (
    <details className={styles.transitionInventory}>
      <summary>View all backend transitions</summary>
      <div className={styles.inventoryScroller}>
        <table>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">Event</th>
              <th scope="col">To</th>
            </tr>
          </thead>
          <tbody>
            {definition.transitions.map((transition) => (
              <tr
                key={`${transition.fromState}-${transition.eventType}-${transition.toState}`}
              >
                <td>{formatOrderState(transition.fromState)}</td>
                <td>{formatOrderEvent(transition.eventType)}</td>
                <td>{formatOrderState(transition.toState)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
