import { useEffect, useRef } from 'react';
import styles from './ConfirmDialog.module.css';

type Props = {
  /** Short question, e.g. "Delete 3 templates?" */
  title: string;
  /** What actually happens — say it plainly, including what can't be undone. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` paints the confirm button red; use it for destructive actions. */
  tone?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation dialog for destructive actions.
 *
 * Focus lands on Cancel rather than Confirm: a stray Enter should not delete
 * anything. Escape and a click on the scrim both cancel, and the keydown is
 * captured so an editor or drawer behind this doesn't also close.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div className={styles.overlay} onClick={onCancel} style={{ animation: 'ovfade .18s ease' }}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={message ? 'confirm-message' : undefined}
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'pop .18s ease' }}
      >
        <h2 id="confirm-title" className={styles.title}>
          {title}
        </h2>
        {message && (
          <p id="confirm-message" className={styles.message}>
            {message}
          </p>
        )}
        <div className={styles.actions}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? styles.confirmDanger : styles.confirm}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
