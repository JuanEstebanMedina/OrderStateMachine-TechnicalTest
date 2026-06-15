import { X } from 'lucide-react';

import styles from './FeedbackAlert.module.css';
import type { FeedbackMessage } from '../../types/feedback';
import buttonStyles from '../../styles/buttons.module.css';

type FeedbackAlertProps = Readonly<{
  feedback: FeedbackMessage | null;
  onDismiss: () => void;
}>;

export function FeedbackAlert({ feedback, onDismiss }: FeedbackAlertProps) {
  if (!feedback) {
    return null;
  }

  const className = `${styles.feedback} ${
    feedback.type === 'success' ? styles.feedbackSuccess : styles.feedbackError
  }`;

  if (feedback.type === 'error') {
    return (
      <div className={className} role="alert" aria-live="polite">
        <span>{feedback.message}</span>
        <button
          type="button"
          className={buttonStyles.iconButton}
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className={className} aria-live="polite">
      <output>{feedback.message}</output>
      <button
        type="button"
        className={buttonStyles.iconButton}
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        <X aria-hidden="true" size={18} />
      </button>
    </div>
  );
}
