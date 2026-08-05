import { INV_STATUS, INVOICES, PLAN, fmtUsd, type Invoice } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { Avatar, DataTable, ExportBtn, PageHead, Pill, Tag } from '../components';
import styles from '../AppAdmin.module.css';

const columns: Column<Invoice>[] = [
  { key: 'num', header: 'Invoice', render: (v) => <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{v.num}</span> },
  {
    key: 'ws',
    header: 'Workspace',
    render: (v) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={v.ws} size={28} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{v.ws}</div>
          <Tag {...PLAN[v.plan]} />
        </div>
      </div>
    ),
  },
  { key: 'period', header: 'Period', render: (v) => <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{v.period}</span> },
  { key: 'due', header: 'Due', render: (v) => <span style={{ fontSize: 12.5, color: 'var(--text4)' }}>{v.due}</span> },
  { key: 'status', header: 'Status', render: (v) => <Pill p={INV_STATUS[v.status]} /> },
  {
    key: 'amount',
    header: 'Amount',
    align: 'right',
    sortValue: (v) => v.amount,
    render: (v) => <span className="tnum" style={{ fontSize: 13.5, fontWeight: 600 }}>{fmtUsd(v.amount)}</span>,
  },
];

export function InvoicesScreen({ onSelect }: ScreenProps) {
  const paid = INVOICES.filter((i) => i.status === 'paid').reduce((t, i) => t + i.amount, 0);
  const due = INVOICES.filter((i) => i.status === 'past_due' || i.status === 'open').reduce((t, i) => t + i.amount, 0);
  return (
    <>
      <PageHead
        title="Invoices"
        sub="Every invoice issued across the platform — collected revenue and outstanding balances."
        actions={<ExportBtn label="Export invoices" />}
      />
      <div className={`${styles.card} ${styles.cardOverflow}`}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>
            Invoices <span className={`tnum ${styles.countPill}`}>{INVOICES.length}</span>
          </h2>
          <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
            <span>
              Collected <b className="tnum" style={{ color: '#16a34a' }}>{fmtUsd(paid)}</b>
            </span>
            <span>
              Outstanding <b className="tnum" style={{ color: '#ea580c' }}>{fmtUsd(due)}</b>
            </span>
          </div>
        </div>
        <DataTable columns={columns} rows={INVOICES} onRow={(v) => onSelect({ kind: 'invoice', data: v })} minWidth={880} />
      </div>
    </>
  );
}
