import { AxiosError, type AxiosResponse } from 'axios';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OpenOrderForm } from './OpenOrderForm';

function createNotFoundError() {
  return new AxiosError(
    'Not found',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status: 404,
      statusText: 'Not Found',
      data: { detail: 'Order not found' },
      headers: {},
      config: {},
    } as AxiosResponse,
  );
}

describe('OpenOrderForm', () => {
  it('submits a complete UUID with surrounding whitespace trimmed', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn().mockResolvedValue(undefined);

    render(<OpenOrderForm isLoading={false} onOpen={onOpen} />);

    await user.type(
      screen.getByLabelText(/order uuid/i),
      ' 11111111-1111-1111-1111-111111111111 ',
    );
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(onOpen).toHaveBeenCalledWith(
      '11111111-1111-1111-1111-111111111111',
    );
  });

  it('rejects invalid UUID values before calling the API', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn().mockResolvedValue(undefined);

    render(<OpenOrderForm isLoading={false} onOpen={onOpen} />);

    await user.type(screen.getByLabelText(/order uuid/i), 'not-a-uuid');
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(screen.getByRole('alert')).toHaveTextContent(/complete order uuid/i);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('shows backend errors', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn().mockRejectedValue(createNotFoundError());

    render(<OpenOrderForm isLoading={false} onOpen={onOpen} />);

    await user.type(
      screen.getByLabelText(/order uuid/i),
      '11111111-1111-1111-1111-111111111111',
    );
    await user.click(screen.getByRole('button', { name: /^open order$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/order not found/i);
  });

  it('disables submission while loading', () => {
    render(<OpenOrderForm isLoading onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: /opening/i })).toBeDisabled();
  });
});
