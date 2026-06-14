import type { OrderEventType } from '../constants/orderEvents';
import type { OrderState } from '../constants/orderStates';

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
