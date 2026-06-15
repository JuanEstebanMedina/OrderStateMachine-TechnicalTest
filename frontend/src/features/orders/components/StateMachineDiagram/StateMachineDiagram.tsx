import styles from './StateMachineDiagram.module.css';
import { DesktopOrderJourney } from './DesktopOrderJourney';
import { MobileOrderJourney } from './MobileOrderJourney';
import { TransitionInventory } from './TransitionInventory';
import { createOrderJourney } from './orderJourney';
import type { OrderEventType } from '../../model/orderEvents';
import type { OrderDetail } from '../../model/order.types';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState/LoadingState';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

type StateMachineDiagramProps = Readonly<{
  availableEvents: OrderEventType[];
  definition: StateMachineDefinition | null;
  error: string | null;
  isLoading: boolean;
  order: OrderDetail | null;
}>;

export function StateMachineDiagram({
  availableEvents,
  definition,
  error,
  isLoading,
  order,
}: StateMachineDiagramProps) {
  if (isLoading) {
    return (
      <section
        className={`${layoutStyles.panel} ${styles.diagramSection}`}
        aria-labelledby="diagram-title"
      >
        <LoadingState label="Loading state machine" />
      </section>
    );
  }

  if (error) {
    return (
      <section
        className={`${layoutStyles.panel} ${styles.diagramSection}`}
        aria-labelledby="diagram-title"
      >
        <h2 className={layoutStyles.panelTitle} id="diagram-title">
          Order journey
        </h2>
        <EmptyState
          title="State-machine diagram unavailable"
          message="The workspace is still usable while the graph request is retried."
        />
      </section>
    );
  }

  if (!definition || !order) {
    return null;
  }

  const model = createOrderJourney(order, definition, availableEvents);

  return (
    <section
      className={`${layoutStyles.panel} ${styles.diagramSection}`}
      aria-labelledby="diagram-title"
    >
      <div className={layoutStyles.panelHeading}>
        <h2 className={layoutStyles.panelTitle} id="diagram-title">
          Order journey
        </h2>
        <span className={layoutStyles.panelMeta}>
          {model.visibleEdges.length} visible transitions
        </span>
      </div>

      <div className={styles.diagramLegend} aria-label="Diagram legend">
        <span>
          <span className={`${styles.legendDot} ${styles.currentDot}`} /> Current
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.visitedDot}`} /> Visited
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.availableDot}`} />{' '}
          Available next
        </span>
        <span>
          <span className={`${styles.legendDot} ${styles.terminalDot}`} /> Terminal
        </span>
        <span>
          <span className={`${styles.legendLine} ${styles.historicalLegend}`} />{' '}
          History
        </span>
        <span>
          <span className={`${styles.legendLine} ${styles.availableLegend}`} />{' '}
          Available
        </span>
      </div>

      <DesktopOrderJourney definition={definition} model={model} />
      <MobileOrderJourney definition={definition} model={model} />

      <div className={styles.transitionLists}>
        <section aria-labelledby="available-transitions-title">
          <h3 id="available-transitions-title">Available transitions</h3>
          {model.availableEdges.length === 0 ? (
            <p className={formStyles.muted}>No available transitions.</p>
          ) : (
            <ul>
              {model.availableEdges.flatMap((edge) =>
                edge.eventTypes.map((eventType) => (
                  <li key={`${edge.id}-${eventType}`}>
                    {formatOrderEvent(eventType)} &rarr;{' '}
                    {formatOrderState(edge.toState)}
                  </li>
                )),
              )}
            </ul>
          )}
        </section>

        <section aria-labelledby="historical-transitions-title">
          <h3 id="historical-transitions-title">Historical path</h3>
          {model.historicalEdges.length === 0 ? (
            <p className={formStyles.muted}>
              No transitions have been applied yet.
            </p>
          ) : (
            <ul>
              {model.historicalEdges.map((edge) => (
                <li key={`${edge.id}-text`}>
                  {formatOrderState(edge.fromState)} &rarr;{' '}
                  {formatOrderState(edge.toState)} by{' '}
                  {edge.eventTypes
                    .map((eventType) => formatOrderEvent(eventType))
                    .join(', ')}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TransitionInventory definition={definition} />
    </section>
  );
}
