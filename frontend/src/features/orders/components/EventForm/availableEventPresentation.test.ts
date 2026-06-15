import { describe, expect, it } from 'vitest';

import { orderAvailableEventsForDisplay } from './availableEventPresentation';
import type { OrderEventType } from '../../model/orderEvents';
import type { OrderState } from '../../model/orderStates';
import type { StateMachineTransition } from '../../model/stateMachine.types';

const states: OrderState[] = [
  'Pending',
  'OnHold',
  'PendingPayment',
  'Confirmed',
  'Processing',
  'Cancelled',
  'Refunded',
];

const transitions: StateMachineTransition[] = [
  {
    fromState: 'PendingPayment',
    eventType: 'orderCancelledByUser',
    toState: 'Cancelled',
  },
  {
    fromState: 'PendingPayment',
    eventType: 'paymentSuccessful',
    toState: 'Confirmed',
  },
  {
    fromState: 'OnHold',
    eventType: 'verificationFailed',
    toState: 'Cancelled',
  },
  {
    fromState: 'OnHold',
    eventType: 'biometricalVerificationSuccessful',
    toState: 'PendingPayment',
  },
  {
    fromState: 'OnHold',
    eventType: 'orderCancelledByUser',
    toState: 'Cancelled',
  },
  {
    fromState: 'Confirmed',
    eventType: 'preparingShipment',
    toState: 'Processing',
  },
  {
    fromState: 'Processing',
    eventType: 'orderCancelled',
    toState: 'Cancelled',
  },
];

function orderEvents(
  currentState: OrderState,
  availableEvents: OrderEventType[],
  metadata: {
    states?: OrderState[] | null;
    transitions?: StateMachineTransition[] | null;
  } = {},
) {
  return orderAvailableEventsForDisplay({
    availableEvents,
    currentState,
    states: 'states' in metadata ? metadata.states : states,
    transitions: 'transitions' in metadata ? metadata.transitions : transitions,
  });
}

describe('orderAvailableEventsForDisplay', () => {
  it('orders non-terminal transitions before terminal transitions', () => {
    expect(
      orderEvents('PendingPayment', [
        'orderCancelledByUser',
        'paymentSuccessful',
      ]),
    ).toEqual(['paymentSuccessful', 'orderCancelledByUser']);
  });

  it('keeps PendingPayment paymentSuccessful before orderCancelledByUser', () => {
    expect(
      orderEvents('PendingPayment', [
        'orderCancelledByUser',
        'paymentSuccessful',
      ]),
    ).toEqual(['paymentSuccessful', 'orderCancelledByUser']);
  });

  it('keeps OnHold biometricalVerificationSuccessful before terminal outcomes', () => {
    expect(
      orderEvents('OnHold', [
        'verificationFailed',
        'orderCancelledByUser',
        'biometricalVerificationSuccessful',
      ]),
    ).toEqual([
      'biometricalVerificationSuccessful',
      'verificationFailed',
      'orderCancelledByUser',
    ]);
  });

  it('preserves backend order within the same terminal category', () => {
    expect(
      orderEvents('OnHold', [
        'orderCancelledByUser',
        'verificationFailed',
      ]),
    ).toEqual(['orderCancelledByUser', 'verificationFailed']);
  });

  it('preserves backend order when metadata is missing', () => {
    const availableEvents: OrderEventType[] = [
      'orderCancelledByUser',
      'paymentSuccessful',
    ];

    expect(
      orderEvents('PendingPayment', availableEvents, {
        states: null,
        transitions: null,
      }),
    ).toEqual(availableEvents);
  });

  it('preserves backend order when a matching transition is missing', () => {
    const availableEvents: OrderEventType[] = [
      'paymentSuccessful',
      'refundProcessed',
      'orderCancelledByUser',
    ];

    expect(orderEvents('PendingPayment', availableEvents)).toEqual(availableEvents);
  });

  it('does not remove or invent events', () => {
    const availableEvents: OrderEventType[] = [
      'orderCancelledByUser',
      'paymentSuccessful',
    ];

    expect(orderEvents('PendingPayment', availableEvents)).toHaveLength(
      availableEvents.length,
    );
    expect(new Set(orderEvents('PendingPayment', availableEvents))).toEqual(
      new Set(availableEvents),
    );
  });
});
