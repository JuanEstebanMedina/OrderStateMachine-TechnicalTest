import { AxiosError, type AxiosResponse } from 'axios';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { EventForm } from './EventForm';

function createConflictError() {
  return new AxiosError(
    'Conflict',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      status: 409,
      statusText: 'Conflict',
      data: { detail: 'Invalid order transition' },
      headers: {},
      config: {},
    } as AxiosResponse,
  );
}

describe('EventForm', () => {
  const defaultProps = {
    isDisabled: false,
    isLoading: false,
    isSubmitting: false,
    loadError: null,
    onRetry: vi.fn(),
  };

  it('renders only events returned by the backend', () => {
    render(
      <EventForm
        {...defaultProps}
        availableEvents={['noVerificationNeeded']}
        onApply={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('option', { name: /no verification needed/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: /payment successful/i }),
    ).not.toBeInTheDocument();
  });

  it('renders the no-events state', () => {
    render(
      <EventForm
        {...defaultProps}
        availableEvents={[]}
        onApply={vi.fn()}
      />,
    );

    expect(
      screen.getByText(/no further transitions are available/i),
    ).toBeInTheDocument();
  });

  it('rejects invalid JSON', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <EventForm
        {...defaultProps}
        availableEvents={['noVerificationNeeded']}
        onApply={onApply}
      />,
    );

    fireEvent.change(screen.getByLabelText(/metadata json/i), {
      target: { value: '{bad' },
    });
    await user.click(screen.getByRole('button', { name: /apply event/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/json/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('rejects arrays and primitive JSON values', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <EventForm
        {...defaultProps}
        availableEvents={['noVerificationNeeded']}
        onApply={onApply}
      />,
    );

    fireEvent.change(screen.getByLabelText(/metadata json/i), {
      target: { value: '[]' },
    });
    await user.click(screen.getByRole('button', { name: /apply event/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/json object/i);

    fireEvent.change(screen.getByLabelText(/metadata json/i), {
      target: { value: 'true' },
    });
    await user.click(screen.getByRole('button', { name: /apply event/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/json object/i);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('submits the selected event and object metadata', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockResolvedValue(undefined);

    render(
      <EventForm
        {...defaultProps}
        availableEvents={['noVerificationNeeded', 'paymentFailed']}
        onApply={onApply}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^event$/i), 'paymentFailed');
    fireEvent.change(screen.getByLabelText(/metadata json/i), {
      target: { value: '{"source":"checkout"}' },
    });
    await user.click(screen.getByRole('button', { name: /apply event/i }));

    expect(onApply).toHaveBeenCalledWith({
      eventType: 'paymentFailed',
      metadata: { source: 'checkout' },
    });
  });

  it('displays a conflict error', async () => {
    const user = userEvent.setup();
    const onApply = vi.fn().mockRejectedValue(createConflictError());

    render(
      <EventForm
        {...defaultProps}
        availableEvents={['noVerificationNeeded']}
        onApply={onApply}
      />,
    );

    await user.click(screen.getByRole('button', { name: /apply event/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        /invalid order transition/i,
      );
    });
  });

  it('shows available-events loading and retry error independently', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const { rerender } = render(
      <EventForm
        {...defaultProps}
        availableEvents={[]}
        isLoading
        onApply={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent(/loading available/i);

    rerender(
      <EventForm
        {...defaultProps}
        availableEvents={[]}
        loadError="Available events failed"
        onApply={vi.fn()}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(/available events failed/i);
    await user.click(
      screen.getByRole('button', { name: /retry available events/i }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
