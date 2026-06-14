import styles from './LoadingState.module.css';

type LoadingStateProps = {
  label?: string;
};

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <div
      className={`${styles.moduleScope} loading-state`}
      role="status"
      aria-live="polite"
    >
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  );
}
