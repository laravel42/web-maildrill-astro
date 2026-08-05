import Icon from '../../Icon';
import {
  LLM_COST,
  LLM_KPIS,
  LLM_PROVIDERS,
  LLM_STATUS,
  LLM_USAGE,
  type LlmProvider,
} from '@/lib/app/admin-data';
import type { Column, ScreenProps } from '../types';
import { AiBars, DataTable, KpiStrip, PageHead, Pill, TableCard, Toggle } from '../components';
import { useLiveToggles } from '../useLiveToggles';
import styles from '../AppAdmin.module.css';

export function LlmScreen({ onSelect }: ScreenProps) {
  const toggles = useLiveToggles();
  const columns: Column<LlmProvider>[] = [
    {
      key: 'name',
      header: 'Provider',
      render: (p) => (
        <div className={styles.cellName}>
          <span className={styles.tblAvatar} style={{ background: p.color, fontWeight: 700, fontSize: 11.5 }} aria-hidden="true">
            {p.initial}
          </span>
          <div className={styles.meta}>
            <div className={styles.primary}>{p.name}</div>
            <div className={`mono ${styles.secondary}`}>{p.vendor}</div>
          </div>
        </div>
      ),
    },
    { key: 'models', header: 'Models', render: (p) => <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text3)' }}>{p.modelCount}</span> },
    { key: 'default', header: 'Default model', render: (p) => <span className="mono" style={{ fontSize: 12, color: 'var(--text3)' }}>{p.defaultModel}</span> },
    { key: 'latency', header: 'Latency', sortValue: (p) => p.latency, render: (p) => <span className="tnum" style={{ fontSize: 12.5, color: 'var(--text4)' }}>{p.latency}ms</span> },
    { key: 'status', header: 'Status', render: (p) => <Pill p={LLM_STATUS[p.status]} /> },
    {
      key: 'on',
      header: 'Enabled',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Toggle on={toggles.isLive(`llm:${p.name}`, p.on)} onClick={() => toggles.toggleLive(`llm:${p.name}`, p.on)} />
        </div>
      ),
    },
  ];
  return (
    <>
      <PageHead
        title="LLM providers"
        sub="Connect model providers and choose which models power Maildrill's AI features."
        actions={
          <button type="button" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            Add provider
          </button>
        }
      />
      <KpiStrip items={LLM_KPIS} cols={4} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16, marginBottom: 22 }}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 className={styles.cardTitle}>Token usage · 30 days</h2>
            <span className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>2.4B total</span>
          </div>
          <AiBars bars={LLM_USAGE} />
        </div>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
            <h2 className={styles.cardTitle}>Estimated cost · 30 days</h2>
            <span className="tnum" style={{ fontSize: 12.5, color: 'var(--muted)' }}>$4,180 total</span>
          </div>
          <AiBars bars={LLM_COST} />
        </div>
      </div>
      <TableCard title="Providers" count={LLM_PROVIDERS.length}>
        <DataTable columns={columns} rows={LLM_PROVIDERS} onRow={(p) => onSelect({ kind: 'llm', data: p })} minWidth={880} />
      </TableCard>
    </>
  );
}
