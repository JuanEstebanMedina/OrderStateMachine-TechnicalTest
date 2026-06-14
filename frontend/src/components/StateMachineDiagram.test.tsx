import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stateMachineDefinition } from '../test/factories';
import { StateMachineDiagram } from './StateMachineDiagram';

describe('StateMachineDiagram', () => {
  it('renders states and known transitions returned by the API', () => {
    render(
      <StateMachineDiagram
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        selectedState={null}
      />,
    );

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByText('Pending payment')).toBeInTheDocument();
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getAllByText('No verification needed').length).toBeGreaterThan(0);
  });

  it('highlights the selected state', () => {
    const { container } = render(
      <StateMachineDiagram
        definition={stateMachineDefinition}
        error={null}
        isLoading={false}
        selectedState="Pending"
      />,
    );

    expect(container.querySelector('.diagram-node.current text')).toHaveTextContent(
      'Pending',
    );
  });

  it('displays a fallback when the graph request fails', () => {
    render(
      <StateMachineDiagram
        definition={null}
        error="Network error"
        isLoading={false}
        selectedState={null}
      />,
    );

    expect(
      screen.getByText(/state-machine diagram unavailable/i),
    ).toBeInTheDocument();
  });
});
