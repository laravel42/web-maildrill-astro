import { CACHE, CACHE_KPIS, type CacheKey } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, TableCard, Tag } from '../components';

const columns: Column<CacheKey>[] = [
  {
    key: 'key',
    header: 'Key',
    render: (c) => (
      <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>
        {c.key}
        {c.hot && <span style={{ marginLeft: 8, fontSize: 10, color: '#d97706', fontWeight: 700 }}>HOT</span>}
      </span>
    ),
  },
  { key: 'type', header: 'Type', render: (c) => <Tag label={c.type} fg="var(--text3)" bg="var(--surface2)" /> },
  { key: 'ttl', header: 'TTL', align: 'right', render: (c) => <span className="tnum" style={{ color: c.ttl === 'no expiry' ? 'var(--muted)' : 'var(--text3)' }}>{c.ttl}</span> },
  { key: 'size', header: 'Size', align: 'right', render: (c) => <span className="tnum" style={{ color: 'var(--text3)' }}>{c.size}</span> },
];

export function CacheScreen({ onSelect }: ScreenProps) {
  return (
    <>
      <PageHead title="Sessions & cache" sub="Redis key/value store — sessions, rate limits, and cached data." />
      <KpiStrip items={CACHE_KPIS} cols={4} />
      <TableCard title="Keys" count={CACHE.length}>
        <DataTable columns={columns} rows={CACHE} onRow={(c) => onSelect({ kind: 'cache', data: c })} minWidth={640} />
      </TableCard>
    </>
  );
}
