import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import App from './App';
import {
  getAvailableEvents,
  getHealth,
  getOrder,
  listOrders,
} from './api/orders';
import { getStateMachineDefinition } from './api/stateMachine';
import {
  baseDetail,
  baseSummary,
  stateMachineDefinition,
} from './test/factories';

vi.mock('./api/orders', () => ({
  applyOrderEvent: vi.fn(),
  createOrder: vi.fn(),
  getAvailableEvents: vi.fn(),
  getHealth: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock('./api/stateMachine', () => ({
  getStateMachineDefinition: vi.fn(),
}));

describe('App integration flow', () => {
  it('loads summaries, selects an order, requests detail and available events, and renders detail', async () => {
    const user = userEvent.setup();

    vi.mocked(getHealth).mockResolvedValue({ status: 'ok' });
    vi.mocked(listOrders).mockResolvedValue([baseSummary]);
    vi.mocked(getStateMachineDefinition).mockResolvedValue(stateMachineDefinition);
    vi.mocked(getOrder).mockResolvedValue(baseDetail);
    vi.mocked(getAvailableEvents).mockResolvedValue(['noVerificationNeeded']);

    render(<App />);

    await screen.findByRole('button', { name: '11111111' });
    await user.click(screen.getByRole('button', { name: '11111111' }));

    await waitFor(() => {
      expect(getOrder).toHaveBeenCalledWith(baseSummary.orderId);
      expect(getAvailableEvents).toHaveBeenCalledWith(baseSummary.orderId);
    });

    expect(await screen.findByText(baseDetail.orderId)).toBeInTheDocument();
    expect(screen.getByText('product-1')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /no verification needed/i }),
    ).toBeInTheDocument();
  });
});
