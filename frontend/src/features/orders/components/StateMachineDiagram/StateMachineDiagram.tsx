import styles from './StateMachineDiagram.module.css';
import type { OrderEventType } from '../../model/orderEvents';
import type { OrderDetail } from '../../model/order.types';
import type { OrderState } from '../../model/orderStates';
import type {
  StateMachineDefinition,
  StateMachineTransition,
} from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState/LoadingState';

type StateMachineDiagramProps = {
  availableEvents: OrderEventType[];
  definition: StateMachineDefinition | null;
  error: string | null;
  isLoading: boolean;
  order: OrderDetail | null;
};

type Position = {
  x: number;
  y: number;
};

type VisibleEdge = {
  id: string;
  fromState: OrderState;
  toState: OrderState;
  eventTypes: OrderEventType[];
  kind: 'historical' | 'available';
};

const NODE_WIDTH = 136;
const NODE_HEIGHT = 52;

const STATE_POSITIONS: Record<OrderState, Position> = {
  Pending: { x: 80, y: 160 },
  OnHold: { x: 260, y: 70 },
  PendingPayment: { x: 260, y: 250 },
  Confirmed: { x: 470, y: 250 },
  Processing: { x: 680, y: 250 },
  Shipped: { x: 890, y: 250 },
  Delivered: { x: 1100, y: 250 },
  Returning: { x: 1100, y: 70 },
  Returned: { x: 890, y: 70 },
  Refunded: { x: 680, y: 70 },
  Cancelled: { x: 470, y: 430 },
};

function getBorderPoint(from: Position, to: Position): Position {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const scale = Math.min(
    Math.abs(deltaX) > 0 ? NODE_WIDTH / 2 / Math.abs(deltaX) : Infinity,
    Math.abs(deltaY) > 0 ? NODE_HEIGHT / 2 / Math.abs(deltaY) : Infinity,
  );

  return {
    x: from.x + deltaX * scale,
    y: from.y + deltaY * scale,
  };
}

function pathFor(edge: VisibleEdge, index: number, edgeCount: number): string {
  const fromCenter = STATE_POSITIONS[edge.fromState];
  const toCenter = STATE_POSITIONS[edge.toState];
  const from = getBorderPoint(fromCenter, toCenter);
  const to = getBorderPoint(toCenter, fromCenter);
  const offset = (index - (edgeCount - 1) / 2) * 28;
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 + offset;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

function groupAvailableTransitions(
  transitions: StateMachineTransition[],
  currentState: OrderState,
  availableEvents: OrderEventType[],
): VisibleEdge[] {
  const availableEventSet = new Set(availableEvents);
  const groupedTransitions = transitions
    .filter(
      (transition) =>
        transition.fromState === currentState &&
        availableEventSet.has(transition.eventType),
    )
    .reduce<Map<OrderState, OrderEventType[]>>((groups, transition) => {
      const group = groups.get(transition.toState) ?? [];
      groups.set(transition.toState, [...group, transition.eventType]);
      return groups;
    }, new Map());

  return Array.from(groupedTransitions.entries()).map(([toState, eventTypes]) => ({
    id: `available-${currentState}-${toState}`,
    fromState: currentState,
    toState,
    eventTypes,
    kind: 'available',
  }));
}

function getHistoricalEdges(order: OrderDetail): VisibleEdge[] {
  return order.history.map((entry, index) => ({
    id: `historical-${index}-${entry.fromState}-${entry.eventType}-${entry.toState}`,
    fromState: entry.fromState,
    toState: entry.toState,
    eventTypes: [entry.eventType],
    kind: 'historical',
  }));
}

function getNodeStatusText(
  state: OrderState,
  currentState: OrderState,
  visitedStates: Set<OrderState>,
  availableNextStates: Set<OrderState>,
  terminalStates: Set<OrderState>,
): string[] {
  const statuses: string[] = [];

  if (state === currentState) {
    statuses.push('Current');
  }

  if (visitedStates.has(state) && state !== currentState) {
    statuses.push('Visited');
  }

  if (availableNextStates.has(state)) {
    statuses.push('Available');
  }

  if (terminalStates.has(state)) {
    statuses.push('Terminal');
  }

  return statuses;
}

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
        className={`${styles.moduleScope} diagram-section`}
        aria-labelledby="diagram-title"
      >
        <LoadingState label="Loading state machine" />
      </section>
    );
  }

  if (error) {
    return (
      <section
        className={`${styles.moduleScope} diagram-section`}
        aria-labelledby="diagram-title"
      >
        <h2 id="diagram-title">Order journey</h2>
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

  const terminalStates = new Set(
    definition.states.filter(
      (state) =>
        !definition.transitions.some((transition) => transition.fromState === state),
    ),
  );
  const historicalEdges = getHistoricalEdges(order);
  const availableEdges = groupAvailableTransitions(
    definition.transitions,
    order.currentState,
    availableEvents,
  );
  const visibleEdges = [...historicalEdges, ...availableEdges];
  const visitedStates = new Set<OrderState>([order.currentState]);
  order.history.forEach((entry) => {
    visitedStates.add(entry.fromState);
    visitedStates.add(entry.toState);
  });
  const availableNextStates = new Set(
    availableEdges.map((edge) => edge.toState),
  );

  return (
    <section
      className={`${styles.moduleScope} diagram-section`}
      aria-labelledby="diagram-title"
    >
      <div className="panel-heading">
        <h2 id="diagram-title">Order journey</h2>
        <span>{visibleEdges.length} visible transitions</span>
      </div>

      <div className="diagram-legend" aria-label="Diagram legend">
        <span><span className="legend-dot current" /> Current</span>
        <span><span className="legend-dot visited" /> Visited</span>
        <span><span className="legend-dot available" /> Available next</span>
        <span><span className="legend-dot terminal" /> Terminal</span>
        <span><span className="legend-line historical" /> History</span>
        <span><span className="legend-line available-line" /> Available</span>
      </div>

      <div className="diagram-scroll">
        <svg
          className="state-machine-svg"
          viewBox="0 0 1180 520"
          role="img"
          aria-labelledby="diagram-svg-title"
        >
          <title id="diagram-svg-title">Contextual order journey diagram</title>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <g className="diagram-links">
            {visibleEdges.map((edge, index) => {
              const isCancelledEdge = edge.toState === 'Cancelled';
              const className = [
                'diagram-edge',
                edge.kind === 'historical' ? 'historical-edge' : 'available-edge',
                isCancelledEdge ? 'cancelled-edge' : '',
              ].join(' ');
              const eventLabel = edge.eventTypes.map(formatOrderEvent).join(', ');

              return (
                <path
                  key={edge.id}
                  className={className}
                  d={pathFor(edge, index, visibleEdges.length)}
                  markerEnd="url(#arrow)"
                  data-kind={edge.kind}
                  data-to-state={edge.toState}
                >
                  <title>
                    {edge.kind === 'historical' ? 'Historical' : 'Available'}:{' '}
                    {formatOrderState(edge.fromState)} to{' '}
                    {formatOrderState(edge.toState)} by {eventLabel}
                  </title>
                </path>
              );
            })}
          </g>
          <g className="diagram-nodes">
            {definition.states.map((state) => {
              const position = STATE_POSITIONS[state];
              const statuses = getNodeStatusText(
                state,
                order.currentState,
                visitedStates,
                availableNextStates,
                terminalStates,
              );

              return (
                <g
                  key={state}
                  className={[
                    'diagram-node',
                    state === order.currentState ? 'current' : '',
                    visitedStates.has(state) && state !== order.currentState
                      ? 'visited'
                      : '',
                    availableNextStates.has(state) ? 'available' : '',
                    terminalStates.has(state) ? 'terminal' : '',
                  ].join(' ')}
                  data-state={state}
                  data-status={statuses.join(' ')}
                  transform={`translate(${position.x - NODE_WIDTH / 2} ${
                    position.y - NODE_HEIGHT / 2
                  })`}
                >
                  <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" />
                  <text x="68" y="23">
                    {formatOrderState(state)}
                  </text>
                  {statuses.length > 0 ? (
                    <text className="node-status" x="68" y="40">
                      {statuses.join(' / ')}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="transition-lists">
        <section aria-labelledby="available-transitions-title">
          <h3 id="available-transitions-title">Available transitions</h3>
          {availableEdges.length === 0 ? (
            <p className="muted">No available transitions.</p>
          ) : (
            <ul>
              {availableEdges.flatMap((edge) =>
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
          {historicalEdges.length === 0 ? (
            <p className="muted">No transitions have been applied yet.</p>
          ) : (
            <ul>
              {historicalEdges.map((edge) => (
                <li key={`${edge.id}-text`}>
                  {formatOrderState(edge.fromState)} &rarr;{' '}
                  {formatOrderState(edge.toState)} by{' '}
                  {formatOrderEvent(edge.eventTypes[0])}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <details className="transition-inventory">
        <summary>View all backend transitions</summary>
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
      </details>
    </section>
  );
}
