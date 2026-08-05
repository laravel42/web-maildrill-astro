import { SEO_KPIS, SEO_ROWS } from '@/lib/app/admin-data';
import type { Column } from '../types';
import { DataTable, KpiStrip, PageHead, TableCard } from '../components';

const lenColor = (n: number, min: number, max: number) => (n < min || n > max ? '#d97706' : '#16a34a');

const columns: Column<(typeof SEO_ROWS)[number]>[] = [
  {
    key: 'page',
    header: 'Page',
    render: (p) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{p.page}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{p.path}</div>
      </div>
    ),
  },
  {
    key: 'title',
    header: 'Meta title',
    render: (p) => (
      <span style={{ fontSize: 12.5, color: 'var(--text3)', maxWidth: 420, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {p.title}
      </span>
    ),
  },
  {
    key: 'titleLen',
    header: 'Title',
    align: 'right',
    render: (p) => (
      <span>
        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: lenColor(p.titleLen, 30, 60) }}>{p.titleLen}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>/60</span>
      </span>
    ),
  },
  {
    key: 'descLen',
    header: 'Desc',
    align: 'right',
    render: (p) => (
      <span>
        <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: lenColor(p.descLen, 70, 160) }}>{p.descLen}</span>
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>/160</span>
      </span>
    ),
  },
];

export function SeoScreen() {
  return (
    <>
      <PageHead title="SEO metadata" sub="Meta titles, descriptions, canonical URLs, and social images for every public page." />
      <KpiStrip items={SEO_KPIS} cols={4} />
      <TableCard title="Pages" count={SEO_ROWS.length}>
        <DataTable columns={columns} rows={SEO_ROWS} minWidth={900} />
      </TableCard>
    </>
  );
}
