import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MobileOrderJourney } from './MobileOrderJourney';
import { createOrderJourney } from './orderJourney';
import { baseDetail, stateMachineDefinition } from '../../test/factories';

describe('MobileOrderJourney', () => {
  it('renders current, visited, historical, and available journey text', () => {
    const model = createOrderJourney(baseDetail, stateMachineDefinition, [
      'paymentSuccessful',
    ]);

    render(<MobileOrderJourney definition={stateMachineDefinition} model={model} />);

    expect(screen.getAllByText(/pending payment/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/current/i)).toBeInTheDocument();
    expect(screen.getByText(/payment successful/i)).toBeInTheDocument();
    expect(screen.getByText(/historical transitions/i)).toBeInTheDocument();
  });
});
