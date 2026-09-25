import { useRef } from 'react';
import Modal from './Modal';
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
  /** Optional fields for dialogs that also collect input (e.g. a rename). */
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Confirmation dialog for destructive actions.
 *
 * Focus lands on Cancel rather than Confirm: a stray Enter should not delete
 * anything. Escape and a click on the scrim both cancel. Uses the shared
 * Modal's `confirm` layer so it traps focus above whatever modal opened it
 * (--z-confirm) and stacks correctly with the shared scroll lock / inert.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  tone = 'danger',
  children,
  onConfirm,
  onCancel,
}: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Modal
      open
      onClose={onCancel}
      title={title}
      role="alertdialog"
      layer="confirm"
      initialFocus={cancelRef}
      panelClassName={styles.dialog}
    >
      <h2 className={styles.title}>{title}</h2>
      {message && <p className={styles.message}>{message}</p>}
      {children}
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
    </Modal>
  );
}
