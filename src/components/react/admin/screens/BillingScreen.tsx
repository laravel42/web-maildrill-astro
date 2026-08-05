import {
  BILLING_KPIS,
  MRR_BY_PLAN,
  MRR_TREND,
  PLAN,
  WORKSPACES,
  fmtUsd,
} from '@/lib/app/admin-data';
import type { ScreenProps } from '../types';
import { Avatar, Bar, ExportBtn, KpiStrip, MiniBars, PageHead, Tag } from '../components';
import styles from '../AppAdmin.module.css';

export function BillingScreen({ onSelect }: ScreenProps) {
  return (
    <>
      <PageHead
        title="Billing & revenue"
        sub="Recurring revenue, plan mix, and outstanding invoices across the platform."
        actions={<ExportBtn label="Export report" />}
      />
      <KpiStrip items={BILLING_KPIS} cols={6} />
      <div className={styles.twoCol}>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className={styles.cardTitle}>MRR trend</h2>
              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>last 12 months</span>
            </div>
            <MiniBars
              values={MRR_TREND}
              labels={['A', 'S', 'O', 'N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J']}
              color="#4f46e5"
              format={(v) => `$${v}k`}
            />
          </div>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>
              MRR by plan
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {MRR_BY_PLAN.map((p) => {
                const maxRev = Math.max(...MRR_BY_PLAN.map((x) => x.revenue));
                return (
                  <div key={p.plan}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Tag {...PLAN[p.plan]} />
                        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{p.count}</span>
                      </div>
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
                        {fmtUsd(p.revenue)}
                      </span>
                    </div>
                    <Bar pct={(p.revenue / maxRev) * 100} color={PLAN[p.plan].fg} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <h3 className={styles.h3}>Top accounts by MRR</h3>
            {[...WORKSPACES]
              .sort((a, b) => b.mrr - a.mrr)
              .slice(0, 6)
              .map((w) => (
                <button
                  type="button"
                  key={w.id}
                  className={styles.railRow}
                  style={{ width: '100%', background: 'none', textAlign: 'left' }}
                  onClick={() => onSelect({ kind: 'workspace', data: w })}
                >
                  <Avatar name={w.owner} size={28} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className={styles.railName}>{w.name}</div>
                    <Tag {...PLAN[w.plan]} />
                  </div>
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>
                    {fmtUsd(w.mrr)}
                  </span>
                </button>
              ))}
          </div>
        </div>
      </div>
    </>
  );
}
