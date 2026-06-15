import { X } from 'lucide-react';

import styles from './ProductIdsField.module.css';
import formStyles from '../../../../shared/styles/forms.module.css';
import { parseProductIds } from './productIdsParser';

type ProductIdsFieldProps = {
  error?: string;
  value: string;
  onChange: (value: string) => void;
};

export function ProductIdsField({
  error,
  value,
  onChange,
}: ProductIdsFieldProps) {
  const productIds = parseProductIds(value);
  const describedBy = [
    'productIds-help',
    'productIds-count',
    error ? 'productIds-error' : '',
  ]
    .filter(Boolean)
    .join(' ');

  function removeProductId(productIdToRemove: string) {
    onChange(
      productIds
        .filter((productId) => productId !== productIdToRemove)
        .join('\n'),
    );
  }

  return (
    <div className={formStyles.field}>
      <label className={formStyles.label} htmlFor="productIds">
        Product IDs
      </label>
      <textarea
        id="productIds"
        className={`${formStyles.control} ${formStyles.textarea}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={'product-1, product-2\nproduct-3'}
        aria-describedby={describedBy}
        rows={4}
      />
      <p className={formStyles.helperText} id="productIds-help">
        Paste product IDs separated by commas or line breaks. Empty values and
        duplicates are ignored before submission.
      </p>
      <p className={styles.count} id="productIds-count" aria-live="polite">
        {productIds.length}{' '}
        {productIds.length === 1 ? 'product recognized' : 'products recognized'}
      </p>
      {productIds.length > 0 ? (
        <div className={styles.tokens} aria-label="Recognized product IDs">
          {productIds.map((productId) => (
            <span className={styles.token} key={productId}>
              <span className={styles.tokenText}>{productId}</span>
              <button
                type="button"
                className={styles.removeButton}
                onClick={() => removeProductId(productId)}
                aria-label={`Remove ${productId}`}
              >
                <X aria-hidden="true" size={14} />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      {error ? (
        <p className={formStyles.fieldError} id="productIds-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
