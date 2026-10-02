import type { ReactNode } from 'react';
import Icon from '../Icon';
import Modal from '../shared/Modal';
import styles from '../AppProfile.module.css';

/**
 * Modal shell for the security flows (same shape as the Settings modal: head
 * with close, body, footer with Cancel + caller actions). Overlay click and
 * Escape both close unless `locked` — used while a one-time secret (recovery
 * codes) is on screen so a stray click can't destroy the only copy.
 */
export default function SecurityModal({
  title,
  onClose,
  children,
  foot,
  cancelLabel = 'Cancel',
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
  cancelLabel?: string;
  locked?: boolean;
}) {
  return (
    <Modal open onClose={locked ? () => undefined : onClose} title={title} panelClassName={styles.modal}>
      <div className={styles.modalHead}>
        <span className={styles.modalTitle}>{title}</span>
        {!locked && (
          <button type="button" className={styles.modalX} onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        )}
      </div>
      <div className={styles.modalBody}>{children}</div>
      <div className={styles.modalFoot}>
        {!locked && (
          <button type="button" className={styles.btn} onClick={onClose}>
            {cancelLabel}
          </button>
        )}
        {foot}
      </div>
    </Modal>
  );
}
