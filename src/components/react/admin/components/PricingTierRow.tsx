import { useState } from 'react';

export function PricingTierRow({ name, std, promo }: { name: string; std: number; promo: number }) {
  const [s, setS] = useState(std);
  const [p, setP] = useState(promo);
  return (
    <>
      <span style={{ fontSize: 13.5, fontWeight: 600 }}>{name}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <input
          type="number"
          value={s}
          onChange={(e) => setS(Number(e.target.value))}
          style={{ width: 60, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: 13, textAlign: 'right', fontFamily: 'inherit', color: 'var(--text)', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: 'var(--muted)', width: 10 }}>%</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
        <input
          type="number"
          value={p}
          onChange={(e) => setP(Number(e.target.value))}
          style={{ width: 60, boxSizing: 'border-box', padding: '7px 9px', borderRadius: 8, border: '1px solid #4f46e5', background: 'var(--accent-tint)', fontSize: 13, fontWeight: 600, textAlign: 'right', fontFamily: 'inherit', color: '#4f46e5', outline: 'none' }}
        />
        <span style={{ fontSize: 12, color: '#4f46e5', width: 10 }}>%</span>
      </div>
    </>
  );
}
