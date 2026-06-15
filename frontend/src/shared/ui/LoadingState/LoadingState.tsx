import styles from './LoadingState.module.css';

type LoadingStateProps = Readonly<{
  label?: string;
}>;

export function LoadingState({ label = 'Loading' }: LoadingStateProps) {
  return (
    <output
      className={styles.loadingState}
      aria-live="polite"
    >
      <span className={styles.loadingDot} aria-hidden="true" />
      {label}
    </output>
  );
}
