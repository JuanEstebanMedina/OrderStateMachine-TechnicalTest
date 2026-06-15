import { describe, expect, it } from 'vitest';

import {
  createMobileJourneyItems,
  createOrderJourney,
  describeTransition,
  getGraphicalStatePosition,
  groupAvailableTransitions,
} from './orderJourney';
import { baseDetail, stateMachineDefinition } from '../../test/factories';

describe('orderJourney helpers', () => {
  it('derives historical path, current state, visited states, and available destinations', () => {
    const model = createOrderJourney(baseDetail, stateMachineDefinition, [
      'paymentSuccessful',
    ]);

    expect(model.currentState).toBe('PendingPayment');
    expect(model.historicalEdges).toHaveLength(1);
    expect(model.visitedStates.has('Pending')).toBe(true);
    expect(model.availableNextStates.has('Confirmed')).toBe(true);
  });

  it('groups multiple events to one destination', () => {
    const edges = groupAvailableTransitions(
      stateMachineDefinition.transitions,
      'Pending',
      ['paymentFailed', 'orderCancelled', 'orderCancelledByUser'],
    );

    const cancelledEdge = edges.find((edge) => edge.toState === 'Cancelled');
    expect(cancelledEdge?.eventTypes).toEqual([
      'orderCancelledByUser',
      'paymentFailed',
      'orderCancelled',
    ]);
  });

  it('derives terminal states and accessible descriptions', () => {
    const model = createOrderJourney(baseDetail, stateMachineDefinition, [
      'paymentSuccessful',
    ]);

    expect(model.terminalStates.has('Cancelled')).toBe(true);
    expect(describeTransition(model.historicalEdges[0]!)).toMatch(
      /historical: pending to pending payment/i,
    );
  });

  it('creates mobile textual representation and tolerates unsupported graphical states', () => {
    const definition = {
      ...stateMachineDefinition,
      states: [...stateMachineDefinition.states, 'ManualReview'],
    };
    const model = createOrderJourney(baseDetail, definition, ['paymentSuccessful']);
    const mobileItems = createMobileJourneyItems(definition, model);

    expect(mobileItems.some((item) => item.state === 'ManualReview')).toBe(true);
    expect(getGraphicalStatePosition('ManualReview')).toBeNull();
  });
});
