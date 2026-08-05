import { useState } from 'react';
import {
  CAMP_STATUS,
  CAMPAIGN_KPIS,
  CAMPAIGNS,
  CHANNEL_META,
  fmtInt,
  type AdminCampaign,
} from '@/lib/app/admin-data';
import type { CampaignsLive } from '../live-types';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, Bar, ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard } from '../components';
import styles from '../AppAdmin.module.css';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'sending', label: 'Sending' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'sent', label: 'Sent' },
  { id: 'paused', label: 'Paused' },
];

const columns: Column<AdminCampaign>[] = [
  {
    key: 'name',
    header: 'Campaign',
    render: (c) => (
      <div className={styles.cellName}>
        <Avatar name={c.ws} size={28} />
        <div className={styles.meta}>
          <div className={styles.primary}>{c.name}</div>
          <div className={styles.secondary}>{c.ws}</div>
        </div>
      </div>
    ),
  },
  { key: 'channel', header: 'Channel', render: (c) => <Pill p={CHANNEL_META[c.channel]} /> },
  {
    key: 'recipients',
    header: 'Recipients',
    align: 'right',
    sortValue: (c) => c.recipients,
    render: (c) => <span className="tnum">{fmtInt(c.recipients)}</span>,
  },
  {
    key: 'progress',
    header: 'Progress',
    minWidth: 150,
    render: (c) => (
      <div className={styles.quota}>
        <div className={styles.quotaTrack} style={{ maxWidth: 96 }}>
          <Bar pct={c.progress} color={CHANNEL_META[c.channel].fg} />
        </div>
        <span className="tnum" style={{ fontSize: 11.5, color: 'var(--text4)', fontWeight: 500 }}>
          {c.progress}%
        </span>
      </div>
    ),
  },
  {
    key: 'open',
    header: 'Open rate',
    align: 'right',
    render: (c) => <span className="tnum" style={{ fontWeight: 600 }}>{c.openRate ? `${c.openRate}%` : '—'}</span>,
  },
  { key: 'status', header: 'Status', render: (c) => <Pill p={CAMP_STATUS[c.status]} /> },
  { key: 'when', header: 'When', align: 'right', render: (c) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{c.when}</span> },
];

export function CampaignsScreen({ onSelect, live }: ScreenProps & { live?: CampaignsLive | null }) {
  const [filter, setFilter] = useState('all');
  const source = live?.rows ?? CAMPAIGNS;
  const kpis = live?.kpis ?? CAMPAIGN_KPIS;
  const rows = filter === 'all' ? source : source.filter((c) => c.status === filter);
  return (
    <>
      <PageHead
        title="Campaigns monitor"
        sub={
          live
            ? 'In-flight, scheduled, and recent sends in this workspace.'
            : 'In-flight, scheduled, and recent sends across every workspace and channel.'
        }
      />
      <KpiStrip items={kpis} cols={4} />
      <TableCard title="Campaigns" count={rows.length} chips={<ChipRow options={CHIPS} value={filter} onChange={setFilter} />}>
        <DataTable columns={columns} rows={rows} onRow={(c) => onSelect({ kind: 'campaign', data: c })} minWidth={1000} />
      </TableCard>
    </>
  );
}
