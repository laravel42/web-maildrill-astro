import Icon from '../../Icon';
import { FAQ_KPIS, FAQS, PUBLISH, type Faq } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard, liveColumn } from '../components';
import { useLiveToggles } from '../useLiveToggles';

export function FaqScreen({ onSelect }: ScreenProps) {
  const toggles = useLiveToggles();
  const columns: Column<Faq>[] = [
    { key: 'q', header: 'Question', render: (f) => <span style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{f.q}</span> },
    { key: 'updated', header: 'Updated', render: (f) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{f.updated}</span> },
    { key: 'status', header: 'Status', render: (f) => <Pill p={PUBLISH[f.status]} /> },
    liveColumn<Faq>(toggles, (f) => `faq:${f.q}`),
  ];
  return (
    <>
      <PageHead
        title="FAQ entries"
        sub="Questions and answers shown in the FAQ section of the public pricing page."
        actions={
          <button type="button" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            New question
          </button>
        }
      />
      <KpiStrip items={FAQ_KPIS} cols={4} />
      <TableCard title="Questions" count={FAQS.length}>
        <DataTable columns={columns} rows={FAQS} onRow={(f) => onSelect({ kind: 'faq', data: f })} minWidth={760} />
      </TableCard>
    </>
  );
}
