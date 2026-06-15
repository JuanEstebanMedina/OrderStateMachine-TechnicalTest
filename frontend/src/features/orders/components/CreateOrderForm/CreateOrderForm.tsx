import { type FormEvent, useState } from 'react';
import { Plus } from 'lucide-react';

import styles from './CreateOrderForm.module.css';
import type { CreateOrderRequest } from '../../model/order.types';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import { ProductIdsField } from '../ProductIdsField/ProductIdsField';
import { parseProductIds } from '../ProductIdsField/productIdsParser';
import buttonStyles from '../../../../shared/styles/buttons.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

type CreateOrderFormProps = Readonly<{
  isSubmitting: boolean;
  onCreate: (request: CreateOrderRequest) => Promise<void>;
}>;

type FormErrors = {
  productIds?: string;
  amount?: string;
  submit?: string;
};

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
    <section
      className={`${layoutStyles.panel} ${styles.createPanel}`}
      aria-labelledby="create-order-title"
    >
      <div className={layoutStyles.panelHeading}>
        <h2 className={layoutStyles.panelTitle} id="create-order-title">
          Create order
        </h2>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <ProductIdsField
          value={productIdsValue}
          onChange={setProductIdsValue}
          error={errors.productIds}
        />
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="amount">
            Amount in USD
          </label>
          <input
            id="amount"
            className={formStyles.control}
            type="number"
            min="0"
            step="0.01"
            value={amountValue}
            onChange={(event) => setAmountValue(event.target.value)}
            aria-describedby={errors.amount ? 'amount-error' : undefined}
          />
          {errors.amount ? (
            <p className={formStyles.fieldError} id="amount-error">
              {errors.amount}
            </p>
          ) : null}
        </div>
        {errors.submit ? (
          <p className={formStyles.fieldError}>{errors.submit}</p>
        ) : null}
        <button
          type="submit"
          className={`${buttonStyles.button} ${buttonStyles.primary} ${styles.submitButton}`}
          disabled={isSubmitting}
        >
          <Plus aria-hidden="true" size={18} />
          {isSubmitting ? 'Creating' : 'Create order'}
        </button>
      </form>
    </section>
  );
}
