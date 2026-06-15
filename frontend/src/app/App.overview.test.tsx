import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../features/orders/api/ordersApi', () => ({
  applyOrderEvent: vi.fn(),
  createOrder: vi.fn(),
  getAvailableEvents: vi.fn(),
  getHealth: vi.fn(),
  getOrder: vi.fn(),
  listOrders: vi.fn(),
}));

vi.mock('../features/orders/api/stateMachineApi', () => ({
  getStateMachineDefinition: vi.fn(),
}));

import {
  createApiError,
  getOrder,
  openFirstOrder,
  renderOverview,
} from '../test/appTestUtils';
import { baseSummary } from '../features/orders/test/factories';

describe('App overview flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders overview summary, create form, open-by-ID form, and order cards', async () => {
    await renderOverview();

    expect(screen.getByLabelText(/dashboard summary/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /create order/i })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: /open order by id/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('list', { name: /order cards/i })).toBeInTheDocument();
  });

  it('clicking an order card opens the workspace', async () => {
    const user = userEvent.setup();
    await renderOverview();

    await openFirstOrder(user);

    expect(screen.getByRole('button', { name: /back to orders/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /order identity/i })).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(
      baseSummary.orderId,
      expect.any(AbortSignal),
    );
  });

  it('submitting a valid full UUID opens the workspace', async () => {
    const user = userEvent.setup();
    await renderOverview();

    await user.type(screen.getByLabelText(/order uuid/i), ` ${baseSummary.orderId} `);
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(
      await screen.findByRole('button', { name: /back to orders/i }),
    ).toBeInTheDocument();
    expect(getOrder).toHaveBeenCalledWith(
      baseSummary.orderId,
      expect.any(AbortSignal),
    );
  });

  it('rejects an invalid UUID before calling the API', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(getOrder).mockClear();

    await user.type(screen.getByLabelText(/order uuid/i), 'not-a-uuid');
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/complete order uuid/i);
    expect(getOrder).not.toHaveBeenCalled();
  });

  it('shows backend errors for an unknown direct lookup', async () => {
    const user = userEvent.setup();
    await renderOverview();
    vi.mocked(getOrder).mockRejectedValueOnce(createApiError(404, 'Order not found'));

    await user.type(screen.getByLabelText(/order uuid/i), baseSummary.orderId);
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect((await screen.findAllByText(/order not found/i)).length).toBeGreaterThan(0);
  });

  it('back to orders returns to the overview', async () => {
    const user = userEvent.setup();
    await renderOverview();
    await openFirstOrder(user);

    await user.click(screen.getByRole('button', { name: /back to orders/i }));

    expect(screen.getByRole('heading', { name: /create order/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /order identity/i }),
    ).not.toBeInTheDocument();
  });
});
