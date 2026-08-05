import type { ReactNode } from 'react';
import Icon from '../../Icon';
import { colorFor, initials } from '@/lib/app/admin-data';
import styles from '../AppAdmin.module.css';

export function DrawerShell({
  avatar,
  name,
  badges,
  subtitle,
  actions,
  tabs,
  onClose,
  children,
}: {
  avatar?: { name: string; color?: string };
  name: string;
  badges?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside className={styles.drawer} aria-label={name}>
      <div className={styles.drawerHead}>
        <div className={styles.drawerTitleRow}>
          {avatar && (
            <span className={styles.drawerAvatar} style={{ background: avatar.color ?? colorFor(avatar.name) }} aria-hidden="true">
              {initials(avatar.name)}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className={styles.drawerName}>
              {name}
              {badges}
            </h2>
            {subtitle && <div className={styles.drawerSub}>{subtitle}</div>}
          </div>
          <button type="button" className={styles.drawerClose} aria-label="Close" onClick={onClose}>
            <Icon name="x" size={15} />
          </button>
        </div>
        {actions && <div className={styles.drawerActions}>{actions}</div>}
      </div>
      {tabs}
      <div className={styles.drawerBody}>{children}</div>
    </aside>
  );
}

export function Rows({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <div className={styles.detailRows}>
      {rows.map(([k, v]) => (
        <div key={k} className={styles.detailRow}>
          <span className="k">{k}</span>
          <span className="v">{v}</span>
        </div>
      ))}
    </div>
  );
}
