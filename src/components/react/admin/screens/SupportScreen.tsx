import { useState } from 'react';
import { PRIORITY, TICKET_KPIS, TICKET_STATUS, TICKETS, type Ticket } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard, Tag } from '../components';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Pending' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'urgent', label: 'Urgent' },
];

const columns: Column<Ticket>[] = [
  {
    key: 'subject',
    header: 'Ticket',
    render: (t) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--muted)', flex: 'none' }}>#{t.id}</span>
        <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{t.subject}</span>
      </div>
    ),
  },
  {
    key: 'ws',
    header: 'Workspace',
    render: (t) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Avatar name={t.ws} size={26} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{t.ws}</span>
      </div>
    ),
  },
  { key: 'category', header: 'Category', render: (t) => <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t.category}</span> },
  { key: 'priority', header: 'Priority', render: (t) => <Tag {...PRIORITY[t.priority]} /> },
  {
    key: 'agent',
    header: 'Agent',
    render: (t) =>
      t.agent ? (
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>{t.agent}</span>
      ) : (
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>Unassigned</span>
      ),
  },
  { key: 'status', header: 'Status', render: (t) => <Pill p={TICKET_STATUS[t.status]} /> },
  { key: 'updated', header: 'Updated', align: 'right', render: (t) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{t.updated}</span> },
];

export function SupportScreen({ onSelect }: ScreenProps) {
  const [filter, setFilter] = useState('all');
  const rows =
    filter === 'all'
      ? TICKETS
      : filter === 'urgent'
        ? TICKETS.filter((t) => t.priority === 'urgent')
        : TICKETS.filter((t) => t.status === filter);
  return (
    <>
      <PageHead title="Support tickets" sub="Every open conversation across all workspaces — priority, ownership, and SLA." />
      <KpiStrip items={TICKET_KPIS} cols={4} />
      <TableCard title="Tickets" count={rows.length} chips={<ChipRow options={CHIPS} value={filter} onChange={setFilter} />}>
        <DataTable columns={columns} rows={rows} onRow={(t) => onSelect({ kind: 'ticket', data: t })} minWidth={1000} />
      </TableCard>
    </>
  );
}
