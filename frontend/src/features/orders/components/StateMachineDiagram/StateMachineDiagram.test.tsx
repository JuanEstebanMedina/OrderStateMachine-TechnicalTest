import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  baseDetail,
  cancelledDetail,
  stateMachineDefinition,
} from '../../test/factories';
import { StateMachineDiagram } from './StateMachineDiagram';

describe('StateMachineDiagram', () => {
  it('identifies current, visited, available next, and historical states', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful', 'orderCancelledByUser']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    expect(
      container.querySelector('[data-state="PendingPayment"]'),
    ).toHaveAttribute('data-status', expect.stringContaining('Current'));
    expect(container.querySelector('[data-state="Pending"]')).toHaveAttribute(
      'data-status',
      expect.stringContaining('Visited'),
    );
    expect(container.querySelector('[data-state="Confirmed"]')).toHaveAttribute(
      'data-status',
      expect.stringContaining('Available'),
    );
    expect(container.querySelector('[data-state="Cancelled"]')).toHaveAttribute(
      'data-status',
      expect.stringContaining('Terminal'),
    );
  });

  it('renders historical and available edges from order history and backend metadata', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful', 'orderCancelledByUser']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    expect(container.querySelectorAll('[data-kind="historical"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-kind="available"]')).toHaveLength(2);
    expect(screen.getAllByText(/payment successful/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cancelled by user/i).length).toBeGreaterThan(0);
  });

  it('groups multiple available events to the same destination into one visual edge', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={[
          'paymentFailed',
          'orderCancelled',
          'orderCancelledByUser',
        ]}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={{ ...baseDetail, currentState: 'Pending' }}
      />,
    );

    expect(
      container.querySelectorAll('[data-kind="available"][data-to-state="Cancelled"]'),
    ).toHaveLength(1);
    expect(screen.getAllByText(/payment failed/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/order cancelled/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/cancelled by user/i).length).toBeGreaterThan(0);
  });

  it('does not render possible cancellation edges for a terminal cancelled order', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={[]}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={cancelledDetail}
      />,
    );

    expect(container.querySelectorAll('[data-kind="available"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-kind="historical"]')).toHaveLength(1);
  });

  it('renders the full backend transition inventory inside a disclosure', () => {
    render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    const disclosure = screen.getByText(/view all backend transitions/i)
      .parentElement;
    expect(disclosure).not.toBeNull();
    expect(
      within(disclosure as HTMLElement).getByText(/pending biometrical verification/i),
    ).toBeInTheDocument();
  });

  it('displays a fallback when the graph request fails', () => {
    render(
      <StateMachineDiagram
        availableEvents={[]}
        definition={null}
        error="Network error"
        isLoading={false}
        order={baseDetail}
      />,
    );

    expect(
      screen.getByText(/state-machine diagram unavailable/i),
    ).toBeInTheDocument();
  });
});
