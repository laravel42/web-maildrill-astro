import styles from '../AppAdmin.module.css';

/** Header pill telling the operator whether the current screen shows real data. */
export function StatusBadge({ live, label }: { live: boolean; label: string }) {
  return (
    <span
      className={`${styles.statusPill} ${live ? styles.statusLive : styles.statusPreview}`}
      title={live ? 'Showing real data from the workspace API' : 'Showing preview data — not wired to a live source yet'}
    >
      <span className={styles.statusDot} />
      {label}
    </span>
  );
}

/** Inline chip marking an individual panel as preview/mock content. */
export function PreviewTag() {
  return <span className={styles.previewTag}>Preview</span>;
}
