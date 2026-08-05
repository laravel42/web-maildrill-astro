import Icon from '../../Icon';
import { BLOG_KPIS, BLOG_POSTS, PUBLISH, fmtInt, type BlogPost, type Kpi } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard, Tag, liveColumn } from '../components';
import { useLiveToggles } from '../useLiveToggles';

function blogKpis(rows: BlogPost[]): Kpi[] {
  const by = (s: BlogPost['status']) => rows.filter((p) => p.status === s).length;
  return [
    { icon: 'blog', label: 'Posts', value: fmtInt(rows.length), delta: 'in /content', tone: 'flat' },
    { icon: 'check-circle', label: 'Published', value: fmtInt(by('published')), delta: 'live on /blog', tone: 'flat' },
    { icon: 'edit', label: 'Drafts', value: fmtInt(by('draft')), delta: 'in progress', tone: 'flat' },
    { icon: 'clock', label: 'Scheduled', value: fmtInt(by('scheduled')), delta: 'upcoming', tone: 'flat' },
  ];
}

export function BlogScreen({ onSelect, rows }: ScreenProps & { rows?: BlogPost[] | null }) {
  const toggles = useLiveToggles();
  const data = rows ?? BLOG_POSTS;
  const kpis = rows ? blogKpis(rows) : BLOG_KPIS;
  const columns: Column<BlogPost>[] = [
    {
      key: 'title',
      header: 'Title',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{p.title}</span>
          {p.featured && <span className="mono" style={{ fontSize: 10, fontWeight: 600, color: '#ff441f', background: 'rgba(255,68,31,.1)', borderRadius: 5, padding: '1px 6px' }}>FEATURED</span>}
        </div>
      ),
    },
    { key: 'tag', header: 'Topic', render: (p) => <Tag label={p.tag} fg={p.tagColor} bg={`${p.tagColor}1a`} /> },
    { key: 'author', header: 'Author', render: (p) => <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{p.author}</span> },
    { key: 'updated', header: 'Updated', render: (p) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{p.updated}</span> },
    { key: 'status', header: 'Status', render: (p) => <Pill p={PUBLISH[p.status]} /> },
    liveColumn<BlogPost>(toggles, (p) => `post:${p.title}`),
  ];
  return (
    <>
      <PageHead
        title="Blog posts"
        sub="Manage the articles shown on the public /blog page — publish, unpublish, and edit copy."
        actions={
          <button type="button" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            New post
          </button>
        }
      />
      <KpiStrip items={kpis} cols={4} />
      <TableCard title="Posts" count={data.length}>
        <DataTable columns={columns} rows={data} onRow={(p) => onSelect({ kind: 'post', data: p })} minWidth={900} />
      </TableCard>
    </>
  );
}
