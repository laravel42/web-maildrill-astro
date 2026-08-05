import { QUEUE_KPIS, QUEUE_STATUS, QUEUES, fmtInt, type Queue } from '@/lib/app/admin-data';
import type { QueuesLive } from '../live-types';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard } from '../components';

const columns: Column<Queue>[] = [
  { key: 'name', header: 'Queue', render: (q) => <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{q.name}</span> },
  { key: 'active', header: 'Active', align: 'right', render: (q) => <span className="tnum" style={{ fontWeight: 600, color: '#4f46e5' }}>{q.active}</span> },
  { key: 'waiting', header: 'Waiting', align: 'right', render: (q) => <span className="tnum" style={{ color: 'var(--text3)' }}>{fmtInt(q.waiting)}</span> },
  { key: 'completed', header: 'Completed', align: 'right', render: (q) => <span className="tnum" style={{ color: 'var(--text4)' }}>{fmtInt(q.completed)}</span> },
  { key: 'failed', header: 'Failed', align: 'right', sortValue: (q) => q.failed, render: (q) => <span className="tnum" style={{ fontWeight: 600, color: q.failed > 50 ? '#dc2626' : 'var(--text3)' }}>{q.failed}</span> },
  { key: 'rate', header: 'Rate', align: 'right', render: (q) => <span className="tnum" style={{ color: 'var(--text3)' }}>{q.rate}</span> },
  { key: 'status', header: 'Status', render: (q) => <Pill p={QUEUE_STATUS[q.status]} /> },
];

export function QueuesScreen({ onSelect, live }: ScreenProps & { live?: QueuesLive | null }) {
  const rows = live?.rows ?? QUEUES;
  const kpis = live?.kpis ?? QUEUE_KPIS;
  return (
    <>
      <PageHead title="Queue manager" sub="BullMQ job queues — throughput, backlog, and failures." />
      <KpiStrip items={kpis} cols={4} />
      <TableCard title="Queues" count={rows.length}>
        <DataTable columns={columns} rows={rows} onRow={(q) => onSelect({ kind: 'queue', data: q })} minWidth={900} />
      </TableCard>
    </>
  );
}
