import styles from './LoadingState.module.css';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <div
      className={styles.loadingState}
      role="status"
      aria-live="polite"
    >
      <span className={styles.loadingDot} aria-hidden="true" />
      {label}
    </div>
  );
}
