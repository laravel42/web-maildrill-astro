import Icon from '../../Icon';
import { SKILL_KPIS, SKILL_STATUS, SKILLS, type Skill } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard, Tag, liveColumn } from '../components';
import { useLiveToggles } from '../useLiveToggles';

export function SkillsScreen({ onSelect }: ScreenProps) {
  const toggles = useLiveToggles();
  const columns: Column<Skill>[] = [
    {
      key: 'name',
      header: 'Skill',
      render: (k) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{k.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 2, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.desc}</div>
        </div>
      ),
    },
    { key: 'category', header: 'Category', render: (k) => <Tag label={k.category} fg={k.catColor} bg={`${k.catColor}1a`} /> },
    { key: 'trigger', header: 'Trigger', render: (k) => <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{k.trigger}</span> },
    { key: 'model', header: 'Model', render: (k) => <span className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{k.model}</span> },
    { key: 'status', header: 'Status', render: (k) => <Pill p={SKILL_STATUS[k.status]} /> },
    liveColumn<Skill>(toggles, (k) => `skill:${k.name}`),
  ];
  return (
    <>
      <PageHead
        title="Skills"
        sub="Named agent capabilities — each pairs a system prompt with a trigger and a model."
        actions={
          <button type="button" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            New skill
          </button>
        }
      />
      <KpiStrip items={SKILL_KPIS} cols={4} />
      <TableCard title="Skills" count={SKILLS.length}>
        <DataTable columns={columns} rows={SKILLS} onRow={(k) => onSelect({ kind: 'skill', data: k })} minWidth={880} />
      </TableCard>
    </>
  );
}
