import styles from './StateMachineDiagram.module.css';
import type { OrderState } from '../../model/orderStates';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';
import { EmptyState } from '../../../../shared/ui/EmptyState/EmptyState';
import { LoadingState } from '../../../../shared/ui/LoadingState/LoadingState';

type StateMachineDiagramProps = {
  definition: StateMachineDefinition | null;
  error: string | null;
  isLoading: boolean;
  selectedState: OrderState | null;
};

type Position = {
  x: number;
  y: number;
};

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

function pathFor(from: Position, to: Position, index: number): string {
  const offset = index % 2 === 0 ? 0 : 20;
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 - offset;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

export function StateMachineDiagram({
  definition,
  error,
  isLoading,
  selectedState,
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
        <h2 id="diagram-title">State machine</h2>
        <EmptyState
          title="State-machine diagram unavailable"
          message="The dashboard is still usable while the graph request is retried."
        />
      </section>
    );
  }

  if (!definition) {
    return null;
  }

  const outgoingStates = new Set(
    definition.transitions.map((transition) => transition.fromState),
  );

  return (
    <section
      className={`${styles.moduleScope} diagram-section`}
      aria-labelledby="diagram-title"
    >
      <div className="panel-heading">
        <h2 id="diagram-title">State machine</h2>
        <span>{definition.transitions.length} transitions</span>
      </div>

      <div className="diagram-legend" aria-label="Diagram legend">
        <span><span className="legend-dot current" /> Current state</span>
        <span><span className="legend-dot terminal" /> No outgoing events</span>
        <span><span className="legend-line" /> Backend transition</span>
      </div>

      <div className="diagram-scroll">
        <svg
          className="state-machine-svg"
          viewBox="0 0 1180 520"
          role="img"
          aria-labelledby="diagram-svg-title"
        >
          <title id="diagram-svg-title">Order state-machine diagram</title>
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
            {definition.transitions.map((transition, index) => {
              const from = STATE_POSITIONS[transition.fromState];
              const to = STATE_POSITIONS[transition.toState];
              const labelX = (from.x + to.x) / 2;
              const labelY = (from.y + to.y) / 2 - (index % 2 === 0 ? 12 : 28);

              return (
                <g
                  key={`${transition.fromState}-${transition.eventType}-${transition.toState}`}
                >
                  <path
                    d={pathFor(from, to, index)}
                    markerEnd="url(#arrow)"
                    aria-hidden="true"
                  />
                  <text x={labelX} y={labelY}>
                    {formatOrderEvent(transition.eventType)}
                  </text>
                </g>
              );
            })}
          </g>
          <g className="diagram-nodes">
            {definition.states.map((state) => {
              const position = STATE_POSITIONS[state];
              const isCurrent = state === selectedState;
              const isTerminal = !outgoingStates.has(state);

              return (
                <g
                  key={state}
                  className={[
                    'diagram-node',
                    isCurrent ? 'current' : '',
                    isTerminal ? 'terminal' : '',
                  ].join(' ')}
                  transform={`translate(${position.x - 68} ${position.y - 24})`}
                >
                  <rect width="136" height="48" rx="8" />
                  <text x="68" y="29">
                    {formatOrderState(state)}
                  </text>
                  {isTerminal ? <circle cx="122" cy="12" r="4" /> : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <div className="sr-only">
        <h3>State-machine transitions</h3>
        <ul>
          {definition.transitions.map((transition) => (
            <li
              key={`${transition.fromState}-${transition.eventType}-${transition.toState}-text`}
            >
              {formatOrderState(transition.fromState)} with{' '}
              {formatOrderEvent(transition.eventType)} goes to{' '}
              {formatOrderState(transition.toState)}.
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
