import { useState } from 'react';
import Icon from '../../Icon';
import { AUDIT, AUDIT_CAT, AUDIT_KPIS, type AuditEvent } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, ChipRow, DataTable, ExportBtn, KpiStrip, PageHead, TableCard } from '../components';
import styles from '../AppAdmin.module.css';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'security', label: 'Security' },
  { id: 'auth', label: 'Auth' },
  { id: 'billing', label: 'Billing' },
  { id: 'account', label: 'Account' },
  { id: 'data', label: 'Data' },
];

const columns: Column<AuditEvent>[] = [
  {
    key: 'actor',
    header: 'Actor',
    render: (e) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar name={e.actor} size={30} />
        <span style={{ fontWeight: 600, fontSize: 13 }}>{e.actor}</span>
      </div>
    ),
  },
  {
    key: 'action',
    header: 'Action',
    render: (e) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, color: e.danger ? '#dc2626' : 'var(--text2)' }}>{e.action}</div>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2 }}>{e.target}</div>
      </div>
    ),
  },
  {
    key: 'cat',
    header: 'Category',
    render: (e) => (
      <span className={styles.tag} style={{ color: AUDIT_CAT[e.cat].fg, background: AUDIT_CAT[e.cat].bg }}>
        <Icon name={AUDIT_CAT[e.cat].icon} size={11} />
        {AUDIT_CAT[e.cat].label}
      </span>
    ),
  },
  { key: 'ip', header: 'IP address', render: (e) => <span className="mono" style={{ fontSize: 12, color: 'var(--text4)' }}>{e.ip}</span> },
  { key: 'when', header: 'When', align: 'right', render: (e) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{e.when}</span> },
];

export function AuditScreen({ onSelect }: ScreenProps) {
  const [cat, setCat] = useState('all');
  const rows = cat === 'all' ? AUDIT : AUDIT.filter((e) => e.cat === cat);
  return (
    <>
      <PageHead
        title="Audit log"
        sub="Immutable record of admin actions and security events across every workspace."
        actions={<ExportBtn label="Export log" />}
      />
      <KpiStrip items={AUDIT_KPIS} cols={4} />
      <TableCard title="Events" count={rows.length} chips={<ChipRow options={CHIPS} value={cat} onChange={setCat} />}>
        <DataTable columns={columns} rows={rows} onRow={(e) => onSelect({ kind: 'audit', data: e })} minWidth={880} />
      </TableCard>
    </>
  );
}
