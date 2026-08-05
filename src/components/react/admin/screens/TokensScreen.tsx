import { useState } from 'react';
import { TOKEN_KPIS, TOKEN_SCOPE, TOKEN_STATUS, TOKENS, type AdminToken } from '@/lib/app/admin-data';
import type { ChipOption, Column, ScreenProps } from '../types';
import { Avatar, ChipRow, DataTable, KpiStrip, PageHead, Pill, TableCard, Tag } from '../components';

const CHIPS: ChipOption[] = [
  { id: 'all', label: 'All scopes' },
  { id: 'admin', label: 'Admin' },
  { id: 'write', label: 'Write' },
  { id: 'read', label: 'Read' },
];

const columns: Column<AdminToken>[] = [
  {
    key: 'name',
    header: 'Token',
    render: (t) => (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{t.name}</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {t.prefix}···
        </div>
      </div>
    ),
  },
  {
    key: 'ws',
    header: 'Workspace',
    render: (t) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <Avatar name={t.ws} size={26} />
        <span style={{ fontSize: 13, fontWeight: 500 }}>{t.ws}</span>
      </div>
    ),
  },
  { key: 'scope', header: 'Scope', render: (t) => <Tag {...TOKEN_SCOPE[t.scope]} /> },
  { key: 'status', header: 'Status', render: (t) => <Pill p={TOKEN_STATUS[t.status]} /> },
  {
    key: 'used',
    header: 'Last used',
    align: 'right',
    render: (t) => <span style={{ fontSize: 12, color: 'var(--text4)' }}>{t.used}</span>,
  },
  {
    key: 'expires',
    header: 'Expires',
    align: 'right',
    render: (t) => <span className="mono" style={{ fontSize: 12, color: 'var(--text4)' }}>{t.expires}</span>,
  },
];

export function TokensScreen({ onSelect }: ScreenProps) {
  const [scope, setScope] = useState('all');
  const rows = scope === 'all' ? TOKENS : TOKENS.filter((t) => t.scope === scope);
  return (
    <>
      <PageHead
        title="API tokens"
        sub="Personal access tokens issued across every workspace — scopes, usage, and rotation."
      />
      <KpiStrip items={TOKEN_KPIS} cols={4} />
      <TableCard
        title="Tokens"
        count={rows.length}
        chips={<ChipRow options={CHIPS} value={scope} onChange={setScope} />}
      >
        <DataTable
          columns={columns}
          rows={rows}
          onRow={(t) => onSelect({ kind: 'token', data: t })}
          minWidth={880}
        />
      </TableCard>
    </>
  );
}
