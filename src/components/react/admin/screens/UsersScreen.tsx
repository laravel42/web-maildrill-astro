import { useState } from 'react';
import { PLAN, ROLE, USER_KPIS, USERS, type AdminUser } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, ChipRow, DataTable, ExportBtn, KpiStrip, PageHead, Pill, TableCard, Tag } from '../components';
import styles from '../AppAdmin.module.css';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All roles' },
  { id: 'owner', label: 'Owners' },
  { id: 'admin', label: 'Admins' },
  { id: 'editor', label: 'Editors' },
  { id: 'viewer', label: 'Viewers' },
];

const columns: Column<AdminUser>[] = [
  {
    key: 'name',
    header: 'User',
    sortValue: (u) => u.name,
    render: (u) => (
      <div className={styles.cellName}>
        <Avatar name={u.name} />
        <div className={styles.meta}>
          <div className={styles.primary}>{u.name}</div>
          <div className={`mono ${styles.secondary}`}>{u.email}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'ws',
    header: 'Workspace',
    render: (u) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{u.ws}</span>
        <Tag {...PLAN[u.plan]} />
      </div>
    ),
  },
  { key: 'role', header: 'Role', render: (u) => <Tag {...ROLE[u.role]} /> },
  {
    key: 'mfa',
    header: '2FA',
    render: (u) =>
      u.mfa ? (
        <Pill p={{ label: 'On', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' }} />
      ) : (
        <Pill p={{ label: 'Off', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' }} />
      ),
  },
  {
    key: 'status',
    header: 'Status',
    render: (u) =>
      u.active ? (
        <Pill p={{ label: 'Active', fg: '#16a34a', bg: 'var(--success-bg)', dot: '#16a34a' }} />
      ) : (
        <Pill p={{ label: 'Dormant', fg: 'var(--muted)', bg: 'var(--surface2)', dot: 'var(--muted)' }} />
      ),
  },
  {
    key: 'last',
    header: 'Last sign-in',
    align: 'right',
    render: (u) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{u.last}</span>,
  },
];

export function UsersScreen({ onSelect }: ScreenProps) {
  const [role, setRole] = useState('all');
  const rows = role === 'all' ? USERS : USERS.filter((u) => u.role === role);
  return (
    <>
      <PageHead
        title="Users directory"
        sub="Every member across every workspace — roles, access, and sign-in security."
        actions={<ExportBtn />}
      />
      <KpiStrip items={USER_KPIS} cols={4} />
      <TableCard
        title="Members"
        count={rows.length}
        chips={<ChipRow options={CHIPS} value={role} onChange={setRole} />}
      >
        <DataTable
          columns={columns}
          rows={rows}
          onRow={(u) => onSelect({ kind: 'user', data: u })}
          minWidth={900}
          pageSize={10}
        />
      </TableCard>
    </>
  );
}
