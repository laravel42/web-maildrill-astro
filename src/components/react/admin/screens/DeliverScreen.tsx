import {
  DELIV_KPIS,
  DELIV_PROVIDERS,
  DELIV_RATES,
  DELIV_REASONS,
  DELIV_TREND,
  DELIV_WORST,
} from '@/lib/app/admin-data';
import type { DeliverLive } from '../live-types';
import type { ScreenProps } from '../types';
import { Avatar, Bar, KpiStrip, MiniBars, PageHead, PreviewTag } from '../components';
import { delivColor } from '../format';
import styles from '../AppAdmin.module.css';

function DelivTrendCard({ preview }: { preview?: boolean }) {
  return (
    <div className={`${styles.card} ${styles.cardPad}`}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <h2 className={styles.cardTitle}>Deliverability trend</h2>
        {preview ? <PreviewTag /> : <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>12 months · scaled 97–100%</span>}
      </div>
      <MiniBars
        values={DELIV_TREND}
        labels={['A', 'S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J']}
        color={(v) => delivColor(v)}
        format={(v) => `${v}%`}
        min={97}
      />
    </div>
  );
}

function FailureReasonsCard({ preview }: { preview?: boolean }) {
  return (
    <div className={`${styles.card} ${styles.cardPad}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
        <h3 className={styles.h3} style={{ margin: 0 }}>Failure reasons</h3>
        {preview && <PreviewTag />}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
        {DELIV_REASONS.map((r) => (
          <div key={r.label}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={styles.swatch} style={{ background: r.color }} />
                <span style={{ fontSize: 12.5, fontWeight: 500 }}>{r.label}</span>
              </div>
              <span className="tnum" style={{ fontSize: 12.5, fontWeight: 600 }}>{r.pct}%</span>
            </div>
            <Bar pct={r.pct} color={r.color} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Live, workspace-scoped view: real delivered-by-channel + suppression list. */
function LiveDeliver({ data }: { data: DeliverLive }) {
  return (
    <div className={styles.twoCol}>
      <div className={styles.stack}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>Delivered by channel</h2>
          {data.channels.length === 0 ? (
            <p className={styles.sub} style={{ margin: 0 }}>No messages sent yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {data.channels.map((c) => (
                <div key={c.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: c.color }}>{c.value}%</span>
                  </div>
                  <Bar pct={c.value} color={c.color} />
                </div>
              ))}
            </div>
          )}
        </div>
        <DelivTrendCard preview />
      </div>
      <div className={styles.stack}>
        <div className={`${styles.card} ${styles.cardPad}`}>
          <h3 className={styles.h3}>Suppressed addresses</h3>
          {data.suppressions.length === 0 ? (
            <p className={styles.sub} style={{ margin: 0 }}>No suppressions — nothing has bounced or complained.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {data.suppressions.map((s) => (
                <div key={`${s.channel}:${s.address}`} className={styles.railRow} style={{ cursor: 'default', gap: 11 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.address}
                    </div>
                    {s.reason && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.reason}</div>}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap' }}>{s.channel}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <FailureReasonsCard preview />
      </div>
    </div>
  );
}

export function DeliverScreen({ onSelect, live }: ScreenProps & { live?: DeliverLive | null }) {
  if (live) {
    return (
      <>
        <PageHead title="Deliverability" sub="Delivered rate, per-channel performance, and suppressions for this workspace." />
        <KpiStrip items={live.kpis} cols={5} />
        <LiveDeliver data={live} />
      </>
    );
  }
  return (
    <>
      <PageHead title="Deliverability" sub="Platform-wide inbox placement, bounce and complaint trends, and reputation risk." />
      <KpiStrip items={DELIV_KPIS} cols={5} />
      <div className={styles.twoCol}>
        <div className={styles.stack}>
          <DelivTrendCard />
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 className={styles.cardTitle}>Bounce & complaint trend</h2>
              <div className={styles.legend}>
                <span className={styles.legendItem}><span className={styles.swatch} style={{ background: '#ea580c' }} />Bounce</span>
                <span className={styles.legendItem}><span className={styles.swatch} style={{ background: '#dc2626' }} />Complaint</span>
              </div>
            </div>
            <div className={styles.columns}>
              {DELIV_RATES.map((r) => {
                const maxB = Math.max(...DELIV_RATES.map((x) => x.bounce));
                return (
                  <div key={r.m} className={styles.col} style={{ cursor: 'default' }} title={`${r.bounce}% bounce · ${r.complaint}% complaint`}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, width: '100%', height: '100%' }}>
                      <div style={{ width: '44%', maxWidth: 11, height: `${(r.bounce / maxB) * 100}%`, minHeight: 3, background: '#ea580c', borderRadius: '4px 4px 0 0' }} />
                      <div style={{ width: '44%', maxWidth: 11, height: `${(r.complaint / maxB) * 100 * 6}%`, minHeight: 3, background: '#dc2626', borderRadius: '4px 4px 0 0' }} />
                    </div>
                    <span className={styles.colLabel}>{r.m}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>
              Inbox placement by provider
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {DELIV_PROVIDERS.map((p) => (
                <div key={p.label}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{p.label}</span>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: p.color }}>{p.value}%</span>
                  </div>
                  <Bar pct={p.value} color={p.color} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className={styles.stack}>
          <FailureReasonsCard />
          <div className={`${styles.card} ${styles.cardPad}`}>
            <h3 className={styles.h3}>Lowest deliverability</h3>
            {DELIV_WORST.map((w) => (
              <button
                type="button"
                key={w.id}
                className={styles.railRow}
                style={{ width: '100%', background: 'none', textAlign: 'left', gap: 11 }}
                onClick={() => onSelect({ kind: 'workspace', data: w })}
              >
                <Avatar name={w.owner} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className={styles.railName} style={{ marginBottom: 5 }}>{w.name}</div>
                  <Bar pct={w.deliv} color={delivColor(w.deliv)} />
                </div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: delivColor(w.deliv) }}>
                  {w.deliv}%
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
