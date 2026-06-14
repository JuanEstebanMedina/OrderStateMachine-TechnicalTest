import type { OrderEventType } from './orderEvents';
import type { OrderState } from './orderStates';

export type StateMachineTransition = {
  fromState: OrderState;
  eventType: OrderEventType;
  toState: OrderState;
};

export type StateMachineDefinition = {
  initialState: OrderState;
  states: OrderState[];
  transitions: StateMachineTransition[];
};
