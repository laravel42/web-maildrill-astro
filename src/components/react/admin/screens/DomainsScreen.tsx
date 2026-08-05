import { useState } from 'react';
import { DNS, DOMAIN_KPIS, DOMAIN_STATUS, DOMAINS, type Domain } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard } from '../components';
import styles from '../AppAdmin.module.css';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'verified', label: 'Verified' },
  { id: 'issues', label: 'Issues' },
  { id: 'pending', label: 'Pending' },
];

const dns = (state: Domain['spf']) => (
  <Pill p={DNS[state] ?? DNS.warn}>{(DNS[state] ?? DNS.warn).label}</Pill>
);

const columns: Column<Domain>[] = [
  {
    key: 'domain',
    header: 'Domain',
    render: (d) => (
      <div className={styles.cellName}>
        <Avatar name={d.ws} size={28} />
        <div className={styles.meta}>
          <div className={`mono ${styles.primary}`} style={{ fontSize: 13 }}>{d.domain}</div>
          <div className={styles.secondary}>{d.ws}</div>
        </div>
      </div>
    ),
  },
  { key: 'spf', header: 'SPF', render: (d) => dns(d.spf) },
  { key: 'dkim', header: 'DKIM', render: (d) => dns(d.dkim) },
  { key: 'dmarc', header: 'DMARC', render: (d) => dns(d.dmarc) },
  {
    key: 'bounce',
    header: 'Bounce',
    align: 'right',
    sortValue: (d) => d.bounce,
    render: (d) => <span className="tnum" style={{ fontWeight: 600, color: d.bounce > 1 ? '#d97706' : 'var(--text2)' }}>{d.bounce}%</span>,
  },
  {
    key: 'complaint',
    header: 'Complaint',
    align: 'right',
    sortValue: (d) => d.complaint,
    render: (d) => <span className="tnum" style={{ fontWeight: 600, color: d.complaint > 0.08 ? '#dc2626' : 'var(--text2)' }}>{d.complaint}%</span>,
  },
  { key: 'status', header: 'Status', render: (d) => <Pill p={DOMAIN_STATUS[d.status]} /> },
];

export function DomainsScreen({ onSelect }: ScreenProps) {
  const [filter, setFilter] = useState('all');
  const rows = filter === 'all' ? DOMAINS : DOMAINS.filter((d) => d.status === filter);
  return (
    <>
      <PageHead title="Sending domains" sub="Domain authentication and reputation health across every workspace." />
      <KpiStrip items={DOMAIN_KPIS} cols={4} />
      <TableCard title="Domains" count={rows.length} chips={<ChipRow options={CHIPS} value={filter} onChange={setFilter} />}>
        <DataTable columns={columns} rows={rows} onRow={(d) => onSelect({ kind: 'domain', data: d })} minWidth={1000} />
      </TableCard>
    </>
  );
}
