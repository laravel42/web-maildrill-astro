import { useState } from 'react';
import Icon from '../../Icon';
import { PRICING_KPIS, RATE_CARDS, REGION_TABS, TIER_ROWS } from '@/lib/app/admin-data';
import { ChipRow, KpiStrip, PageHead, PricingTierRow, Toggle } from '../components';
import styles from '../AppAdmin.module.css';

export function PricingScreen() {
  const [region, setRegion] = useState('US');
  const [promo, setPromo] = useState(true);
  return (
    <>
      <PageHead title="Pricing & plans" sub="Edit the packages and promo shown on the public /pricing page." />
      <KpiStrip items={PRICING_KPIS} cols={4} />
      <div className={styles.card} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 18px', marginBottom: 18 }}>
        <span style={{ width: 38, height: 38, flex: 'none', borderRadius: 10, background: 'rgba(255,68,31,.1)', color: '#ff441f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="sparkle" size={18} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Launch promo</div>
          <div style={{ fontSize: 12.5, color: 'var(--text4)', marginTop: 2 }}>
            Show deeper 15–50% prepay discounts and the promo banner across /pricing.
          </div>
        </div>
        <Toggle on={promo} onClick={() => setPromo((v) => !v)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '4px 0 10px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.5px', color: 'var(--muted)', textTransform: 'uppercase' }}>
          Per-message rates by region
        </div>
        <ChipRow options={REGION_TABS.map((r) => ({ id: r, label: r }))} value={region} onChange={setRegion} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 11, marginBottom: 26 }}>
        <div className={styles.card} style={{ padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
            <span className={styles.swatch} style={{ background: '#8b5cf6' }} />
            One-time number setup
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="mono" style={{ fontSize: 15, color: 'var(--muted)' }}>$</span>
            <input className={styles.input} type="number" defaultValue={25} />
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>Covers SMS, WhatsApp & voice · email is free</div>
        </div>
        {RATE_CARDS.map((r) => (
          <div key={r.label} className={styles.card} style={{ padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, marginBottom: 10 }}>
              <span className={styles.swatch} style={{ background: r.color }} />
              {r.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mono" style={{ fontSize: 15, color: 'var(--muted)' }}>$</span>
              <input className={styles.input} type="number" step={r.step} defaultValue={r.value} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>{r.sub}</div>
          </div>
        ))}
      </div>
      <div className={styles.card} style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>Annual prepay tiers</span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>Discount off list price when billed annually</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px', gap: '10px 20px', alignItems: 'center' }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>Term</div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase', textAlign: 'right' }}>Standard</div>
          <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '.4px', color: '#4f46e5', textTransform: 'uppercase', textAlign: 'right' }}>Promo</div>
          <div style={{ gridColumn: '1/-1', height: 1, background: 'var(--divider)' }} />
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>Monthly</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>0%</span>
          <span className="tnum" style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'right' }}>0%</span>
          {TIER_ROWS.map((t) => (
            <PricingTierRow key={t.name} name={t.name} std={t.std} promo={t.promo} />
          ))}
        </div>
      </div>
    </>
  );
}
