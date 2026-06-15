import type { OrderEventType } from '../../model/orderEvents';
import type { OrderState } from '../../model/orderStates';
import type { StateMachineTransition } from '../../model/stateMachine.types';

type OrderAvailableEventsForDisplayOptions = {
  availableEvents: OrderEventType[];
  currentState: OrderState | null;
  states: OrderState[] | null | undefined;
  transitions: StateMachineTransition[] | null | undefined;
};

type ClassifiedEvent = {
  eventType: OrderEventType;
  index: number;
  isTerminalDestination: boolean;
};

export function orderAvailableEventsForDisplay({
  availableEvents,
  currentState,
  states,
  transitions,
}: OrderAvailableEventsForDisplayOptions): OrderEventType[] {
  if (!currentState || !states?.length || !transitions?.length) {
    return availableEvents;
  }

  const statesWithOutgoingTransitions = new Set(
    transitions.map((transition) => transition.fromState),
  );
  const terminalStates = new Set(
    states.filter((state) => !statesWithOutgoingTransitions.has(state)),
  );
  const classifiedEvents = availableEvents.map((eventType, index) => {
    const transition = transitions.find(
      (candidate) =>
        candidate.fromState === currentState && candidate.eventType === eventType,
    );

    if (!transition) {
      return null;
    }

    return {
      eventType,
      index,
      isTerminalDestination: terminalStates.has(transition.toState),
    };
  });

  const completeClassifications = classifiedEvents.filter(
    (entry): entry is ClassifiedEvent => entry !== null,
  );

  if (completeClassifications.length !== availableEvents.length) {
    return availableEvents;
  }

  return [...completeClassifications]
    .sort((left, right) => {
      if (left.isTerminalDestination === right.isTerminalDestination) {
        return left.index - right.index;
      }

      return left.isTerminalDestination ? 1 : -1;
    })
    .map((entry) => entry.eventType);
}
