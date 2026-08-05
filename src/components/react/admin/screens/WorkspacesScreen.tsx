import { useState } from 'react';
import { WORKSPACES } from '@/lib/app/admin-data';
import type { ChipOption, ScreenProps } from '../types';
import { ChipRow, DataTable, ExportBtn, PageHead } from '../components';
import { workspaceColumns } from './columns';
import styles from '../AppAdmin.module.css';

const PLAN_CHIPS: ChipOption[] = [
  { id: 'all', label: 'All plans' },
  { id: 'enterprise', label: 'Enterprise' },
  { id: 'scale', label: 'Scale' },
  { id: 'growth', label: 'Growth' },
  { id: 'starter', label: 'Starter' },
];

const STATUS_CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'active', label: 'Active' },
  { id: 'trial', label: 'Trial' },
  { id: 'past_due', label: 'Past due' },
  { id: 'suspended', label: 'Suspended' },
];

export function WorkspacesScreen({ onSelect }: ScreenProps) {
  const [plan, setPlan] = useState('all');
  const [status, setStatus] = useState('all');
  const columns = workspaceColumns();
  const rows = WORKSPACES.filter(
    (w) => (plan === 'all' || w.plan === plan) && (status === 'all' || w.status === status),
  );
  return (
    <>
      <PageHead
        title="Workspaces"
        sub="Every registered workspace with plan, usage, revenue, and health at a glance."
        actions={<ExportBtn />}
      />
      <div className={`${styles.card} ${styles.cardOverflow}`}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            All workspaces <span className={`tnum ${styles.countPill}`}>{rows.length}</span>
          </h2>
          <ChipRow options={PLAN_CHIPS} value={plan} onChange={setPlan} />
        </div>
        <div className={styles.cardHead} style={{ borderTop: 'none' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>
            Status
          </span>
          <ChipRow options={STATUS_CHIPS} value={status} onChange={setStatus} />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          onRow={(w) => onSelect({ kind: 'workspace', data: w })}
          minWidth={940}
          pageSize={10}
        />
      </div>
    </>
  );
}
