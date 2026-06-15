import { type FormEvent, useState } from 'react';
import { Search } from 'lucide-react';

import styles from './OpenOrderForm.module.css';
import { getApiErrorMessage } from '../../../../shared/api/apiError';
import buttonStyles from '../../../../shared/styles/buttons.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import layoutStyles from '../../../../shared/styles/layout.module.css';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type OpenOrderFormProps = {
  isLoading: boolean;
  onOpen: (orderId: string) => Promise<unknown>;
};

export function OpenOrderForm({ isLoading, onOpen }: OpenOrderFormProps) {
  const [orderId, setOrderId] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedOrderId = orderId.trim();

    if (!UUID_PATTERN.test(trimmedOrderId)) {
      setError('Enter a complete order UUID.');
      return;
    }

    try {
      setError(null);
      await onOpen(trimmedOrderId);
    } catch (openError) {
      setError(getApiErrorMessage(openError));
    }
  }

  return (
    <section
      className={`${layoutStyles.panel} ${styles.openOrderPanel}`}
      aria-labelledby="open-order-title"
    >
      <div>
        <h2 className={layoutStyles.panelTitle} id="open-order-title">
          Open order by ID
        </h2>
        <p className={styles.description}>
          Paste the complete UUID returned when the order was created.
        </p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={formStyles.field}>
          <label className={formStyles.label} htmlFor="openOrderId">
            Order UUID
          </label>
          <input
            id="openOrderId"
            className={formStyles.control}
            value={orderId}
            onChange={(event) => setOrderId(event.target.value)}
            placeholder="11111111-1111-1111-1111-111111111111"
            aria-describedby={error ? 'openOrderId-error' : undefined}
          />
          {error ? (
            <p
              className={formStyles.fieldError}
              id="openOrderId-error"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
        <button
          type="submit"
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${styles.submitButton}`}
          disabled={isLoading}
        >
          <Search aria-hidden="true" size={18} />
          {isLoading ? 'Opening' : 'Open order'}
        </button>
      </form>
    </section>
  );
}
