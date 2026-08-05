import { GUIDE_KPIS, GUIDES, PUBLISH, fmtInt, type Guide, type Kpi } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard, Tag, liveColumn } from '../components';
import { useLiveToggles } from '../useLiveToggles';

function guideKpis(rows: Guide[]): Kpi[] {
  const by = (s: Guide['status']) => rows.filter((g) => g.status === s).length;
  const avg = rows.length ? Math.round(rows.reduce((t, g) => t + g.mins, 0) / rows.length) : 0;
  return [
    { icon: 'guides', label: 'Guides', value: fmtInt(rows.length), delta: 'in /content', tone: 'flat' },
    { icon: 'check-circle', label: 'Published', value: fmtInt(by('published')), delta: 'live on /guides', tone: 'flat' },
    { icon: 'edit', label: 'Drafts', value: fmtInt(by('draft')), delta: 'in progress', tone: 'flat' },
    { icon: 'clock', label: 'Avg. read', value: `${avg} min`, delta: 'per guide', tone: 'flat' },
  ];
}

export function GuidesScreen({ onSelect, rows }: ScreenProps & { rows?: Guide[] | null }) {
  const toggles = useLiveToggles();
  const data = rows ?? GUIDES;
  const kpis = rows ? guideKpis(rows) : GUIDE_KPIS;
  const columns: Column<Guide>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (g) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{g.title}</span>
          {g.feat && <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: '#ff441f', background: 'rgba(255,68,31,.1)', borderRadius: 5, padding: '1px 6px' }}>FEATURED</span>}
        </div>
      ),
    },
    { key: 'cat', header: 'Category', render: (g) => <Tag label={g.cat} fg={g.catColor} bg={`${g.catColor}1a`} /> },
    { key: 'mins', header: 'Read', render: (g) => <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text3)' }}>{g.mins} min</span> },
    { key: 'updated', header: 'Updated', render: (g) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{g.updated}</span> },
    { key: 'status', header: 'Status', render: (g) => <Pill p={PUBLISH[g.status]} /> },
    liveColumn<Guide>(toggles, (g) => `guide:${g.title}`),
  ];
  return (
    <>
      <PageHead title="Guides" sub="Playbooks shown on the public /guides page. Toggle a guide live or take it down." />
      <KpiStrip items={kpis} cols={4} />
      <TableCard title="Guides" count={data.length}>
        <DataTable columns={columns} rows={data} onRow={(g) => onSelect({ kind: 'guide', data: g })} minWidth={840} />
      </TableCard>
    </>
  );
}
