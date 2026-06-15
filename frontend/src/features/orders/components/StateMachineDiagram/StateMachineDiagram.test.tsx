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

  it('represents every known backend state in the desktop graph', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful', 'orderCancelledByUser']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    stateMachineDefinition.states.forEach((state) => {
      expect(container.querySelector(`[data-state="${state}"]`)).toBeInTheDocument();
    });
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

  it('renders mobile journey content as the alternative representation', () => {
    render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful', 'orderCancelledByUser']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    expect(screen.getByLabelText(/mobile order journey/i)).toBeInTheDocument();
    expect(screen.getByText(/historical transitions/i)).toBeInTheDocument();
  });

  it('keeps responsive SVG attributes and edge-specific arrow markers', () => {
    const { container } = render(
      <StateMachineDiagram
        availableEvents={['paymentSuccessful', 'orderCancelledByUser']}
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        order={baseDetail}
      />,
    );

    const svg = screen.getByRole('img', {
      name: /contextual order journey diagram/i,
    });
    expect(svg).toHaveAttribute('viewBox', '0 0 1180 520');
    expect(svg).toHaveAttribute('preserveAspectRatio', 'xMidYMid meet');
    expect(container.querySelector('[data-kind="historical"]')).toHaveAttribute(
      'data-marker-kind',
      'arrow-historical',
    );
    expect(
      container.querySelector('[data-kind="available"][data-to-state="Confirmed"]'),
    ).toHaveAttribute('data-marker-kind', 'arrow-available');
    expect(
      container.querySelector('[data-kind="available"][data-to-state="Cancelled"]'),
    ).toHaveAttribute('data-marker-kind', 'arrow-cancelled');
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

  it('does not crash when backend metadata includes unsupported graphical states', () => {
    render(
      <StateMachineDiagram
        availableEvents={[]}
        definition={{
          ...stateMachineDefinition,
          states: [...stateMachineDefinition.states, 'ManualReview'],
        }}
        error={null}
        isLoading={false}
        order={{
          ...baseDetail,
          currentState: 'ManualReview',
          history: [],
        }}
      />,
    );

    expect(screen.getByText(/manual review/i)).toBeInTheDocument();
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
