import { useState } from 'react';
import Icon from '../../Icon';
import { CHANNEL_META, EVENT_KPIS, EVENT_STATUS, EVENTS, type WebhookEvent } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard } from '../components';
import styles from '../AppAdmin.module.css';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'ok', label: 'Processed' },
  { id: 'retried', label: 'Retried' },
  { id: 'failed', label: 'Failed' },
];

const columns: Column<WebhookEvent>[] = [
  {
    key: 'type',
    header: 'Event',
    render: (e) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 12.5, letterSpacing: '-.1px' }}>{e.type}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{e.msgId}</div>
      </div>
    ),
  },
  {
    key: 'channel',
    header: 'Channel',
    render: (e) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
        <span style={{ width: 8, height: 8, borderRadius: 3, background: CHANNEL_META[e.channel].dot }} />
        {CHANNEL_META[e.channel].label}
      </span>
    ),
  },
  { key: 'endpoint', header: 'Endpoint', render: (e) => <span className="mono" style={{ fontSize: 11.5, color: 'var(--text3)' }}>{e.endpoint}</span> },
  { key: 'status', header: 'Status', render: (e) => <Pill p={EVENT_STATUS[e.status]} /> },
  { key: 'when', header: 'Received', align: 'right', render: (e) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{e.when}</span> },
];

export function EventsScreen({ onSelect }: ScreenProps) {
  const [filter, setFilter] = useState('all');
  const rows = filter === 'all' ? EVENTS : EVENTS.filter((e) => e.status === filter);
  return (
    <>
      <PageHead
        title="Events"
        sub="Inbound webhook ingestion from Infobip — delivery reports, inbound messages, and status callbacks."
        actions={
          <button type="button" className="sbtn">
            <Icon name="edit" size={15} />
            Webhook settings
          </button>
        }
      />
      <div className={styles.connBanner}>
        <span className={styles.livedot} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Infobip webhook endpoint · connected</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            POST https://events.maildrill.com/webhooks/infobip
          </div>
        </div>
        <span className="tnum" style={{ fontSize: 12, color: 'var(--muted)' }}>last event 2s ago</span>
      </div>
      <KpiStrip items={EVENT_KPIS} cols={4} />
      <TableCard title="Recent events" count={rows.length} chips={<ChipRow options={CHIPS} value={filter} onChange={setFilter} />}>
        <DataTable columns={columns} rows={rows} onRow={(e) => onSelect({ kind: 'event', data: e })} minWidth={820} />
      </TableCard>
    </>
  );
}
