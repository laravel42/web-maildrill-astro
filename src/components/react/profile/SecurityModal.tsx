import type { ReactNode } from 'react';
import Icon from '../Icon';
import { useEscapeClose } from '../shared/useEscapeClose';
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
  useEscapeClose(() => {
    if (!locked) onClose();
  });

  return (
    <div
      className={styles.modalOverlay}
      onClick={locked ? undefined : onClose}
      style={{ animation: 'ovfade .18s var(--ease-out)' }}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ animation: 'pop .18s ease' }}
      >
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
      </div>
    </div>
  );
}
