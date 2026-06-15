import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CreateOrderForm } from './CreateOrderForm';

describe('CreateOrderForm', () => {
  it('parses mixed product ID separators, removes blanks and duplicates, and sends the DTO', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<CreateOrderForm isSubmitting={false} onCreate={onCreate} />);

    await user.type(
      screen.getByLabelText(/product IDs/i),
      ' product-1, product-2\nproduct-1\n\nproduct-3,, ',
    );
    await user.type(screen.getByLabelText(/amount in USD/i), '25.5');
    await user.click(screen.getByRole('button', { name: /create order/i }));

    expect(onCreate).toHaveBeenCalledWith({
      productIds: ['product-1', 'product-2', 'product-3'],
      amount: 25.5,
    });
  });

  it('rejects no valid product IDs', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<CreateOrderForm isSubmitting={false} onCreate={onCreate} />);

    await user.type(screen.getByLabelText(/product IDs/i), ' , , ');
    await user.type(screen.getByLabelText(/amount in USD/i), '10');
    await user.click(screen.getByRole('button', { name: /create order/i }));

    expect(screen.getByText(/enter at least one product id/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid amounts', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);

    render(<CreateOrderForm isSubmitting={false} onCreate={onCreate} />);

    await user.type(screen.getByLabelText(/product IDs/i), 'product-1');
    await user.type(screen.getByLabelText(/amount in USD/i), '0');
    await user.click(screen.getByRole('button', { name: /create order/i }));

    expect(screen.getByText(/amount greater than zero/i)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  it('submits every unique product ID when the preview has many items', async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const productIds = Array.from(
      { length: 24 },
      (_, index) => `bulk-product-${index + 1}`,
    );

    render(<CreateOrderForm isSubmitting={false} onCreate={onCreate} />);

    fireEvent.change(screen.getByLabelText(/product IDs/i), {
      target: { value: productIds.join('\n') },
    });
    await user.type(screen.getByLabelText(/amount in USD/i), '42');
    await user.click(screen.getByRole('button', { name: /create order/i }));

    expect(onCreate).toHaveBeenCalledWith({
      productIds,
      amount: 42,
    });
  });
});
