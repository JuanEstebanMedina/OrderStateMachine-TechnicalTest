import { X } from 'lucide-react';

import styles from './FeedbackAlert.module.css';
import type { FeedbackMessage } from '../../../features/orders/hooks/useOrders';

type FeedbackAlertProps = {
  feedback: FeedbackMessage | null;
  onDismiss: () => void;
};

export function FeedbackAlert({ feedback, onDismiss }: FeedbackAlertProps) {
  if (!feedback) {
    return null;
  }

  return (
    <div
      className={`${styles.moduleScope} feedback feedback-${feedback.type}`}
      role={feedback.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
    >
      <span>{feedback.message}</span>
      <button
        type="button"
        className="icon-button"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
