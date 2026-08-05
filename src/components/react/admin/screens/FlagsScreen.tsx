import { useState } from 'react';
import { FLAG_KPIS, FLAG_STAGE, FLAGS } from '@/lib/app/admin-data';
import { Bar, KpiStrip, PageHead, Tag, Toggle } from '../components';
import styles from '../AppAdmin.module.css';

export function FlagsScreen() {
  const [flagState, setFlagState] = useState<Record<string, boolean>>(
    () => Object.fromEntries(FLAGS.map((f) => [f.key, f.on])),
  );
  return (
    <>
      <PageHead title="Feature flags" sub="Roll capabilities out across the platform and toggle them per stage." />
      <KpiStrip items={FLAG_KPIS} cols={4} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {FLAGS.map((f) => (
          <div key={f.key} className={`${styles.card} ${styles.flagRow}`}>
            <div className={styles.flagMeta}>
              <div className={styles.flagName}>
                <span style={{ fontSize: 14.5, fontWeight: 600, letterSpacing: '-.1px' }}>{f.name}</span>
                <Tag {...FLAG_STAGE[f.stage]} />
                <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{f.key}</span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text4)', marginTop: 4 }}>{f.desc}</div>
            </div>
            <div className={styles.flagRollout}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>Rollout</span>
                <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)' }}>{f.rollout}%</span>
              </div>
              <Bar pct={f.rollout} color={f.rollout === 100 ? '#16a34a' : '#4f46e5'} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>{f.ofCount}</div>
            </div>
            <Toggle on={flagState[f.key]} onClick={() => setFlagState((s) => ({ ...s, [f.key]: !s[f.key] }))} />
          </div>
        ))}
      </div>
    </>
  );
}
