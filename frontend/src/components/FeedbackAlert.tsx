import { X } from 'lucide-react';

import type { FeedbackMessage } from '../hooks/useOrders';

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
      className={`feedback feedback-${feedback.type}`}
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
