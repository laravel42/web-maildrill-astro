import Icon from '../../Icon';
import { MCP_KPIS, MCP_SERVERS, MCP_STATUS, MCP_TRANSPORT, type McpServer } from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { DataTable, KpiStrip, PageHead, Pill, TableCard, Tag, liveColumn } from '../components';
import { useLiveToggles } from '../useLiveToggles';

export function McpScreen({ onSelect }: ScreenProps) {
  const toggles = useLiveToggles();
  const columns: Column<McpServer>[] = [
    {
      key: 'name',
      header: 'Server',
      render: (m) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13.5, letterSpacing: '-.1px' }}>{m.name}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.endpoint}</div>
        </div>
      ),
    },
    { key: 'transport', header: 'Transport', render: (m) => <Tag {...MCP_TRANSPORT[m.transport]} /> },
    { key: 'tools', header: 'Tools', render: (m) => <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text3)' }}>{m.toolCount}</span> },
    { key: 'scope', header: 'Scope', render: (m) => <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>{m.scope}</span> },
    { key: 'status', header: 'Status', render: (m) => <Pill p={MCP_STATUS[m.status]} /> },
    liveColumn<McpServer>(toggles, (m) => `mcp:${m.name}`),
  ];
  return (
    <>
      <PageHead
        title="MCP servers"
        sub="Model Context Protocol servers that expose tools to Maildrill's agents. Toggle a server or scope its tools."
        actions={
          <button type="button" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            Register server
          </button>
        }
      />
      <KpiStrip items={MCP_KPIS} cols={4} />
      <TableCard title="Servers" count={MCP_SERVERS.length}>
        <DataTable columns={columns} rows={MCP_SERVERS} onRow={(m) => onSelect({ kind: 'mcp', data: m })} minWidth={880} />
      </TableCard>
    </>
  );
}
