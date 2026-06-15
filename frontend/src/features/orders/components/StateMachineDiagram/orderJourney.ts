import type { OrderEventType } from '../../model/orderEvents';
import type { OrderDetail } from '../../model/order.types';
import type { KnownOrderState, OrderState } from '../../model/orderStates';
import { isKnownOrderState } from '../../model/orderStates';
import type {
  StateMachineDefinition,
  StateMachineTransition,
} from '../../model/stateMachine.types';
import { formatOrderEvent, formatOrderState } from '../../utils/orderFormatters';

export type JourneyEdge = {
  id: string;
  fromState: OrderState;
  toState: OrderState;
  eventTypes: OrderEventType[];
  kind: 'historical' | 'available';
};

export type JourneyModel = {
  availableEdges: JourneyEdge[];
  availableNextStates: Set<OrderState>;
  currentState: OrderState;
  historicalEdges: JourneyEdge[];
  terminalStates: Set<OrderState>;
  visibleEdges: JourneyEdge[];
  visitedStates: Set<OrderState>;
};

export type MobileJourneyItem = {
  events: OrderEventType[];
  state: OrderState;
  statuses: string[];
};

export type GraphicalStatePosition = {
  x: number;
  y: number;
};

export const STATE_POSITIONS: Record<KnownOrderState, GraphicalStatePosition> = {
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

export function getGraphicalStatePosition(
  state: OrderState,
): GraphicalStatePosition | null {
  if (!isKnownOrderState(state)) {
    return null;
  }

  return STATE_POSITIONS[state];
}

export function getHistoricalEdges(order: OrderDetail): JourneyEdge[] {
  return order.history.map((entry, index) => ({
    id: `historical-${index}-${entry.fromState}-${entry.eventType}-${entry.toState}`,
    fromState: entry.fromState,
    toState: entry.toState,
    eventTypes: [entry.eventType],
    kind: 'historical',
  }));
}

export function groupAvailableTransitions(
  transitions: StateMachineTransition[],
  currentState: OrderState,
  availableEvents: OrderEventType[],
): JourneyEdge[] {
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

export function getVisitedStates(order: OrderDetail): Set<OrderState> {
  const visitedStates = new Set<OrderState>([order.currentState]);

  order.history.forEach((entry) => {
    visitedStates.add(entry.fromState);
    visitedStates.add(entry.toState);
  });

  return visitedStates;
}

export function getAvailableNextStates(edges: JourneyEdge[]): Set<OrderState> {
  return new Set(edges.map((edge) => edge.toState));
}

export function getTerminalStates(
  definition: StateMachineDefinition,
): Set<OrderState> {
  return new Set(
    definition.states.filter(
      (state) =>
        !definition.transitions.some((transition) => transition.fromState === state),
    ),
  );
}

export function getStateStatuses(
  state: OrderState,
  model: JourneyModel,
): string[] {
  const statuses: string[] = [];

  if (state === model.currentState) {
    statuses.push('Current');
  }

  if (model.visitedStates.has(state) && state !== model.currentState) {
    statuses.push('Visited');
  }

  if (model.availableNextStates.has(state)) {
    statuses.push('Available');
  }

  if (model.terminalStates.has(state)) {
    statuses.push('Terminal');
  }

  return statuses;
}

export function describeTransition(edge: JourneyEdge): string {
  const eventLabel = edge.eventTypes.map(formatOrderEvent).join(', ');
  const prefix = edge.kind === 'historical' ? 'Historical' : 'Available';

  return `${prefix}: ${formatOrderState(edge.fromState)} to ${formatOrderState(
    edge.toState,
  )} by ${eventLabel}`;
}

export function createOrderJourney(
  order: OrderDetail,
  definition: StateMachineDefinition,
  availableEvents: OrderEventType[],
): JourneyModel {
  const historicalEdges = getHistoricalEdges(order);
  const availableEdges = groupAvailableTransitions(
    definition.transitions,
    order.currentState,
    availableEvents,
  );

  return {
    availableEdges,
    availableNextStates: getAvailableNextStates(availableEdges),
    currentState: order.currentState,
    historicalEdges,
    terminalStates: getTerminalStates(definition),
    visibleEdges: [...historicalEdges, ...availableEdges],
    visitedStates: getVisitedStates(order),
  };
}

export function createMobileJourneyItems(
  definition: StateMachineDefinition,
  model: JourneyModel,
): MobileJourneyItem[] {
  return definition.states.map((state) => ({
    events: model.availableEdges
      .filter((edge) => edge.toState === state)
      .flatMap((edge) => edge.eventTypes),
    state,
    statuses: getStateStatuses(state, model),
  }));
}
