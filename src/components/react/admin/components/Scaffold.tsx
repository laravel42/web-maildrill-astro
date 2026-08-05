import type { ReactNode } from 'react';
import Icon from '../../Icon';
import { fmtInt } from '@/lib/app/admin-data';
import styles from '../AppAdmin.module.css';

export function PageHead({
  title,
  sub,
  actions,
}: {
  title: string;
  sub: string;
  actions?: ReactNode;
}) {
  return (
    <div className={styles.pageHead}>
      <div>
        <h1 className={styles.h1}>{title}</h1>
        <p className={styles.sub}>{sub}</p>
      </div>
      {actions && <div className={styles.headActions}>{actions}</div>}
    </div>
  );
}

export function ExportBtn({ label = 'Export CSV' }: { label?: string }) {
  return (
    <button type="button" className="sbtn">
      <Icon name="download" size={15} />
      {label}
    </button>
  );
}

export function TableCard({
  title,
  count,
  chips,
  children,
}: {
  title: string;
  count: number;
  chips?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`${styles.card} ${styles.cardOverflow}`}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>
          {title}
          <span className={`tnum ${styles.countPill}`}>{fmtInt(count)}</span>
        </h2>
        {chips}
      </div>
      {children}
    </div>
  );
}
