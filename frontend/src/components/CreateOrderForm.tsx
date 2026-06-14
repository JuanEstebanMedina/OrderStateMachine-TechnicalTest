import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';

import type { CreateOrderRequest } from '../types/order';
import { getApiErrorMessage } from '../utils/apiError';

type CreateOrderFormProps = {
  isSubmitting: boolean;
  onCreate: (request: CreateOrderRequest) => Promise<void>;
};

type FormErrors = {
  productIds?: string;
  amount?: string;
  submit?: string;
};

function parseProductIds(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(',')
        .map((productId) => productId.trim())
        .filter(Boolean),
    ),
  );
}

export function CreateOrderForm({
  isSubmitting,
  onCreate,
}: CreateOrderFormProps) {
  const [productIdsValue, setProductIdsValue] = useState('');
  const [amountValue, setAmountValue] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const productIds = parseProductIds(productIdsValue);
    const amount = Number(amountValue);
    const nextErrors: FormErrors = {};

    if (productIds.length === 0) {
      nextErrors.productIds = 'Enter at least one product ID.';
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = 'Enter an amount greater than zero.';
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});

    try {
      await onCreate({ productIds, amount });
      setProductIdsValue('');
      setAmountValue('');
    } catch (error) {
      setErrors({ submit: getApiErrorMessage(error) });
    }
  }

  return (
    <section className="panel create-panel" aria-labelledby="create-order-title">
      <div className="panel-heading">
        <h2 id="create-order-title">Create order</h2>
      </div>
      <form className="stacked-form" onSubmit={handleSubmit} noValidate>
        <div className="form-field">
          <label htmlFor="productIds">Product IDs</label>
          <input
            id="productIds"
            value={productIdsValue}
            onChange={(event) => setProductIdsValue(event.target.value)}
            placeholder="product-1, product-2"
            aria-describedby={errors.productIds ? 'productIds-error' : undefined}
          />
          {errors.productIds ? (
            <p className="field-error" id="productIds-error">
              {errors.productIds}
            </p>
          ) : null}
        </div>
        <div className="form-field">
          <label htmlFor="amount">Amount in USD</label>
          <input
            id="amount"
            type="number"
            min="0"
            step="0.01"
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
            aria-describedby={errors.amount ? 'amount-error' : undefined}
          />
          {errors.amount ? (
            <p className="field-error" id="amount-error">
              {errors.amount}
            </p>
          ) : null}
        </div>
        {errors.submit ? <p className="field-error">{errors.submit}</p> : null}
        <button type="submit" className="button primary" disabled={isSubmitting}>
          <Plus aria-hidden="true" size={18} />
          {isSubmitting ? 'Creating' : 'Create order'}
        </button>
      </form>
    </section>
  );
}
