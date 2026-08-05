import Icon from '../../Icon';
import type { Kpi } from '@/lib/app/admin-data';
import styles from '../AppAdmin.module.css';

export function KpiCard({ k }: { k: Kpi }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiHead}>
        <span className={styles.ic}>
          <Icon name={k.icon} size={14} />
        </span>
        {k.label}
      </div>
      <div className={`tnum ${styles.kpiValue}`}>{k.value}</div>
      <div className={`tnum ${styles.kpiDelta} ${styles[k.tone]}`}>{k.delta}</div>
    </div>
  );
}

export function KpiStrip({ items, cols }: { items: Kpi[]; cols: number }) {
  return (
    <div className={styles.kpis} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {items.map((k) => (
        <KpiCard key={k.label} k={k} />
      ))}
    </div>
  );
}
