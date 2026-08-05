import { PLAN, WS_STATUS, fmtCompact, fmtUsd, type AdminWorkspace } from '@/lib/app/admin-data';
import type { Column } from '../types';
import { Avatar, Bar, Pill, SplitBar, Tag } from '../components';
import { delivColor, quotaColor } from '../format';
import styles from '../AppAdmin.module.css';

/** Column set for the workspaces table, shared by the overview and workspaces screens. */
export function workspaceColumns(): Column<AdminWorkspace>[] {
  return [
    {
      key: 'name',
      header: 'Workspace',
      render: (w) => (
        <div className={styles.cellName}>
          <Avatar name={w.owner} />
          <div className={styles.meta}>
            <div className={styles.primary}>{w.name}</div>
            <div className={`mono ${styles.secondary}`}>{w.domain}</div>
          </div>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', render: (w) => <Tag {...PLAN[w.plan]} /> },
    {
      key: 'users',
      header: 'Users',
      align: 'right',
      sortValue: (w) => w.users,
      render: (w) => <span className="tnum">{w.users}</span>,
    },
    {
      key: 'sends',
      header: 'Sends · 30d',
      minWidth: 150,
      sortValue: (w) => w.email30 + w.sms30 + w.wa30,
      render: (w) => (
        <div>
          <div className="tnum" style={{ fontSize: 13, fontWeight: 500, marginBottom: 5 }}>
            {fmtCompact(w.email30 + w.sms30 + w.wa30)}
          </div>
          <SplitBar email={w.email30} sms={w.sms30} wa={w.wa30} />
        </div>
      ),
    },
    {
      key: 'mrr',
      header: 'MRR',
      align: 'right',
      sortValue: (w) => w.mrr,
      render: (w) => <span className="tnum" style={{ fontWeight: 600 }}>{fmtUsd(w.mrr)}</span>,
    },
    {
      key: 'deliv',
      header: 'Deliv.',
      align: 'right',
      sortValue: (w) => w.deliv,
      render: (w) => (
        <span className="tnum" style={{ fontWeight: 600, color: delivColor(w.deliv) }}>
          {w.deliv}%
        </span>
      ),
    },
    {
      key: 'quota',
      header: 'Quota',
      minWidth: 110,
      render: (w) => (
        <div className={styles.quota}>
          <div className={styles.quotaTrack}>
            <Bar pct={w.quota} color={quotaColor(w.quota)} />
          </div>
          <span className="tnum" style={{ fontSize: 11.5, color: 'var(--text4)', fontWeight: 500 }}>
            {w.quota}%
          </span>
        </div>
      ),
    },
    { key: 'status', header: 'Status', render: (w) => <Pill p={WS_STATUS[w.status]} /> },
    {
      key: 'active',
      header: 'Last active',
      align: 'right',
      render: (w) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{w.active}</span>,
    },
  ];
}
