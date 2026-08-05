import { useState } from 'react';
import { LOG_KPIS, LOG_LEVEL, LOGS, type LogLine } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard } from '../components';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Error' },
  { id: 'warn', label: 'Warn' },
  { id: 'info', label: 'Info' },
  { id: 'debug', label: 'Debug' },
];

const columns: Column<LogLine>[] = [
  { key: 'time', header: 'Time', render: (l) => <span className="mono" style={{ fontSize: 12, color: 'var(--text4)' }}>{l.time}</span> },
  { key: 'level', header: 'Level', render: (l) => <Pill p={LOG_LEVEL[l.level]} /> },
  { key: 'svc', header: 'Service', render: (l) => <span className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{l.svc}</span> },
  { key: 'msg', header: 'Message', render: (l) => <span style={{ fontSize: 12.5, color: 'var(--text2)' }}>{l.msg}</span> },
];

export function LogsScreen({ onSelect }: ScreenProps) {
  const [filter, setFilter] = useState('all');
  const rows = filter === 'all' ? LOGS : LOGS.filter((l) => l.level === filter);
  return (
    <>
      <PageHead title="Logs" sub="Live application log stream — info, warnings, and errors across services." />
      <KpiStrip items={LOG_KPIS} cols={4} />
      <TableCard title="Stream" count={rows.length} chips={<ChipRow options={CHIPS} value={filter} onChange={setFilter} />}>
        <DataTable columns={columns} rows={rows} onRow={(l) => onSelect({ kind: 'log', data: l })} minWidth={760} />
      </TableCard>
    </>
  );
}
