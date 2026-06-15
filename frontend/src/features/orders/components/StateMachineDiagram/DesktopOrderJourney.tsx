import styles from './StateMachineDiagram.module.css';
import {
  describeTransition,
  getGraphicalStatePosition,
  getStateStatuses,
  type JourneyEdge,
  type JourneyModel,
} from './orderJourney';
import type { OrderState } from '../../model/orderStates';
import type { StateMachineDefinition } from '../../model/stateMachine.types';
import { formatOrderState } from '../../utils/orderFormatters';

type DesktopOrderJourneyProps = {
  definition: StateMachineDefinition;
  model: JourneyModel;
};

const NODE_WIDTH = 136;
const NODE_HEIGHT = 52;

type Position = {
  x: number;
  y: number;
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

function pathFor(edge: JourneyEdge, index: number, edgeCount: number): string | null {
  const fromCenter = getGraphicalStatePosition(edge.fromState);
  const toCenter = getGraphicalStatePosition(edge.toState);

  if (!fromCenter || !toCenter) {
    return null;
  }

  const from = getBorderPoint(fromCenter, toCenter);
  const to = getBorderPoint(toCenter, fromCenter);
  const offset = (index - (edgeCount - 1) / 2) * 28;
  const controlX = (from.x + to.x) / 2;
  const controlY = (from.y + to.y) / 2 + offset;

  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

function classForState(state: OrderState, model: JourneyModel): string {
  const statuses = getStateStatuses(state, model);

  return [
    styles.diagramNode,
    statuses.includes('Current') ? styles.currentNode : '',
    statuses.includes('Visited') ? styles.visitedNode : '',
    statuses.includes('Available') ? styles.availableNode : '',
    statuses.includes('Terminal') ? styles.terminalNode : '',
  ].join(' ');
}

function markerIdForEdge(edge: JourneyEdge) {
  if (edge.toState === 'Cancelled') {
    return 'arrow-cancelled';
  }

  return edge.kind === 'historical' ? 'arrow-historical' : 'arrow-available';
}

export function DesktopOrderJourney({
  definition,
  model,
}: DesktopOrderJourneyProps) {
  const drawableEdges = model.visibleEdges
    .map((edge, index) => ({
      edge,
      path: pathFor(edge, index, model.visibleEdges.length),
    }))
    .filter((entry): entry is { edge: JourneyEdge; path: string } =>
      Boolean(entry.path),
    );

  return (
    <div className={styles.desktopJourney}>
      <div className={styles.diagramScroll}>
        <svg
          className={styles.stateMachineSvg}
          viewBox="0 0 1180 520"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-labelledby="diagram-svg-title"
        >
          <title id="diagram-svg-title">Contextual order journey diagram</title>
          <defs>
            <marker
              id="arrow-historical"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path className={styles.historicalMarker} d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker
              id="arrow-available"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path className={styles.availableMarker} d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker
              id="arrow-cancelled"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path className={styles.cancelledMarker} d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <g>
            {drawableEdges.map(({ edge, path }) => {
              const isCancelledEdge = edge.toState === 'Cancelled';
              const className = [
                styles.diagramEdge,
                edge.kind === 'historical'
                  ? styles.historicalEdge
                  : styles.availableEdge,
                isCancelledEdge ? styles.cancelledEdge : '',
              ].join(' ');

              return (
                <path
                  key={edge.id}
                  className={className}
                  d={path}
                  markerEnd={`url(#${markerIdForEdge(edge)})`}
                  data-kind={edge.kind}
                  data-to-state={edge.toState}
                  data-marker-kind={markerIdForEdge(edge)}
                >
                  <title>{describeTransition(edge)}</title>
                </path>
              );
            })}
          </g>
          <g>
            {definition.states.map((state) => {
              const position = getGraphicalStatePosition(state);

              if (!position) {
                return null;
              }

              const statuses = getStateStatuses(state, model);

              return (
                <g
                  key={state}
                  className={classForState(state, model)}
                  data-state={state}
                  data-status={statuses.join(' ')}
                  transform={`translate(${position.x - NODE_WIDTH / 2} ${
                    position.y - NODE_HEIGHT / 2
                  })`}
                >
                  <rect width={NODE_WIDTH} height={NODE_HEIGHT} rx="8" />
                  <text className={styles.nodeTitle} x="68" y="23">
                    {formatOrderState(state)}
                  </text>
                  {statuses.length > 0 ? (
                    <text className={styles.nodeStatus} x="68" y="40">
                      {statuses.join(' / ')}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>
  );
}
