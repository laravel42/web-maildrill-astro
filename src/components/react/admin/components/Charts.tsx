import { useState, type CSSProperties } from 'react';
import { PLATFORM_SENDS } from '@/lib/app/admin-data';
import { Bar } from './Primitives';
import styles from '../AppAdmin.module.css';

/** Interactive stacked column chart of platform sends over the last 14 days. */
export function StackedSends() {
  const [sel, setSel] = useState(PLATFORM_SENDS.length - 1);
  const max = Math.max(...PLATFORM_SENDS.map((d) => d.email + d.sms + d.wa));
  const d = PLATFORM_SENDS[sel];
  const total = d.email + d.sms + d.wa;
  const totals = PLATFORM_SENDS.reduce(
    (a, x) => ({ email: a.email + x.email, sms: a.sms + x.sms, wa: a.wa + x.wa }),
    { email: 0, sms: 0, wa: 0 },
  );
  const h = (v: number) => `${(v / max) * 100}%`;
  return (
    <div className={`${styles.card} ${styles.cardPad}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 14,
          marginBottom: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h2 className={styles.cardTitle}>Platform sends · 14 days</h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 6 }}>
            <span className="tnum" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-.4px' }}>
              {total.toFixed(2)}M
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              {d.day} · <b style={{ color: '#4f46e5' }}>{d.email.toFixed(2)}</b> email ·{' '}
              <b style={{ color: '#0891b2' }}>{d.sms.toFixed(2)}</b> SMS ·{' '}
              <b style={{ color: '#16a34a' }}>{d.wa.toFixed(2)}</b> WA
            </span>
          </div>
        </div>
        <div className={styles.legend}>
          {[
            { c: '#4f46e5', l: 'Email', v: totals.email },
            { c: '#0891b2', l: 'SMS', v: totals.sms },
            { c: '#16a34a', l: 'WhatsApp', v: totals.wa },
          ].map((x) => (
            <div key={x.l} className={styles.legendItem}>
              <span className={styles.swatch} style={{ background: x.c }} />
              {x.l}
              <span className="tnum" style={{ fontWeight: 600 }}>
                {x.v.toFixed(1)}M
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.columns}>
        {PLATFORM_SENDS.map((day, i) => (
          <button
            type="button"
            key={day.day}
            className={styles.col}
            style={{ opacity: i === sel ? 1 : 0.55, background: 'none', border: 0, padding: 0 }}
            onClick={() => setSel(i)}
            title={`${(day.email + day.sms + day.wa).toFixed(2)}M`}
          >
            <div className={styles.colStack}>
              <div style={{ width: '100%', height: h(day.wa), background: '#16a34a', borderRadius: '5px 5px 0 0' }} />
              <div style={{ width: '100%', height: h(day.sms), background: '#0891b2' }} />
              <div style={{ width: '100%', height: h(day.email), background: '#4f46e5' }} />
            </div>
            <span
              className={styles.colLabel}
              style={{ color: i === sel ? 'var(--text2)' : 'var(--muted)', fontWeight: i === sel ? 600 : 400 }}
            >
              {day.day}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function MiniBars({
  values,
  labels,
  color,
  format,
  min = 0,
}: {
  values: number[];
  labels: string[];
  color: string | ((v: number) => string);
  format: (v: number) => string;
  min?: number;
}) {
  const max = Math.max(...values);
  const span = max - min || 1;
  return (
    <div className={styles.columns} style={{ height: 172, gap: 8 }}>
      {values.map((v, i) => (
        <div key={i} className={styles.col} style={{ cursor: 'default' }} title={format(v)}>
          <div
            style={{
              width: '100%',
              maxWidth: 34,
              height: `${((v - min) / span) * 100}%`,
              minHeight: 4,
              borderRadius: '6px 6px 3px 3px',
              background: typeof color === 'function' ? color(v) : color,
              transformOrigin: 'bottom',
              animation: 'grow .5s ease',
            }}
          />
          <span className={styles.colLabel} style={{ fontSize: 10.5 }}>
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Sends split bar for the workspaces table. */
export function SplitBar({ email, sms, wa }: { email: number; sms: number; wa: number }) {
  const total = email + sms + wa || 1;
  return (
    <div className={styles.split}>
      <span style={{ width: `${(email / total) * 100}%`, background: '#4f46e5' }} />
      <span style={{ width: `${(sms / total) * 100}%`, background: '#0891b2' }} />
      <span style={{ width: `${(wa / total) * 100}%`, background: '#16a34a' }} />
    </div>
  );
}

const swatchStyle = (bg: string): CSSProperties => ({
  width: 9,
  height: 9,
  borderRadius: 3,
  background: bg,
  flex: 'none',
  display: 'inline-block',
});

export function AiBars({ bars }: { bars: { name: string; val: string; w: number; color: string }[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      {bars.map((b) => (
        <div key={b.name}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={swatchStyle(b.color)} />
              <span style={{ fontSize: 12.5, fontWeight: 600 }}>{b.name}</span>
            </div>
            <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{b.val}</span>
          </div>
          <Bar pct={b.w} color={b.color} />
        </div>
      ))}
    </div>
  );
}
