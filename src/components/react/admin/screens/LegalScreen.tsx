import Icon from '../../Icon';
import { LEGAL_DOCS, PUBLISH, type LegalDoc } from '@/lib/app/admin-data';
import { PageHead, Pill } from '../components';
import styles from '../AppAdmin.module.css';

export function LegalScreen({ docs }: { docs?: LegalDoc[] | null }) {
  const data = docs && docs.length ? docs : LEGAL_DOCS;
  return (
    <>
      <PageHead title="Legal pages" sub="The Privacy Policy and Terms of Service published under /legal." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 18 }}>
        {data.map((d) => (
          <div key={d.title} className={styles.card} style={{ padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 36, height: 36, flex: 'none', borderRadius: 10, background: 'var(--surface2)', color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="blog" size={17} />
                </span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>{d.title}</span>
              </div>
              <Pill p={PUBLISH[d.status]} />
            </div>
            <span className={styles.label}>Last updated</span>
            <input className={styles.input} defaultValue={d.updated} style={{ marginBottom: 18 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.4px', color: 'var(--muted)', textTransform: 'uppercase' }}>Sections</span>
              <span className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)' }}>{d.sections.length}</span>
            </div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 18 }}>
              {d.sections.map((s) => (
                <span key={s} className={styles.flagPill} style={{ borderRadius: 8 }}>{s}</span>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="button" className="pbtn" style={{ padding: '8px 14px' }}>
                <Icon name="edit" size={13} />
                Edit content
              </button>
              <a href={d.href} className="lnk" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#4f46e5' }}>
                View live page
                <Icon name="arrow-up-right" size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
