import { useState } from 'react';
import Icon from '../../Icon';
import {
  INV_STATUS,
  INVOICES,
  PLAN,
  ROLE,
  USERS,
  WS_STATUS,
  fmtCompact,
  fmtInt,
  fmtUsd,
  type AdminWorkspace,
} from '@/lib/app/admin-data';
import { Avatar, Bar, Pill, Tag } from '../components';
import { quotaColor } from '../format';
import { DrawerShell, Rows } from './DrawerShell';
import styles from '../AppAdmin.module.css';

export function WorkspaceDrawer({ w, onClose }: { w: AdminWorkspace; onClose: () => void }) {
  const [wsTab, setWsTab] = useState<'overview' | 'users' | 'usage' | 'billing'>('overview');
  const tabs = (['overview', 'users', 'usage', 'billing'] as const).map((t) => (
    <button
      key={t}
      type="button"
      className={`${styles.drawerTab}${wsTab === t ? ` ${styles.drawerTabActive}` : ''}`}
      onClick={() => setWsTab(t)}
    >
      {t[0].toUpperCase() + t.slice(1)}
    </button>
  ));
  const kpis: [string, string][] = [
    ['Users', `${w.users}`],
    ['MRR', fmtUsd(w.mrr)],
    ['Sends · 30d', fmtCompact(w.email30 + w.sms30 + w.wa30)],
    ['Deliverability', `${w.deliv}%`],
  ];
  const channels = [
    { label: 'Email', color: '#4f46e5', value: w.email30 },
    { label: 'SMS', color: '#0891b2', value: w.sms30 },
    { label: 'WhatsApp', color: '#16a34a', value: w.wa30 },
  ];
  const maxCh = Math.max(...channels.map((c) => c.value), 1);
  return (
    <DrawerShell
      onClose={onClose}
      avatar={{ name: w.owner }}
      name={w.name}
      badges={<Tag {...PLAN[w.plan]} />}
      subtitle={<span className="mono">{w.domain} · {w.region} · since {w.created}</span>}
      actions={
        <>
          <button type="button" className="pbtn" style={{ padding: '8px 13px' }}>
            <Icon name="eye" size={14} />
            Impersonate
          </button>
          <button type="button" className="sbtn" style={{ padding: '8px 13px' }}>Adjust quota</button>
          <button type="button" className="sbtn" style={{ marginLeft: 'auto', padding: '8px 13px', color: '#dc2626' }}>Suspend</button>
        </>
      }
      tabs={<div className={styles.drawerTabs}>{tabs}</div>}
    >
      {wsTab === 'overview' && (
        <div style={{ animation: 'fade .2s ease' }}>
          <div className={styles.detailGrid}>
            {kpis.map(([label, value]) => (
              <div key={label} className={styles.miniCard}>
                <div className={styles.miniLabel}>{label}</div>
                <div className={`tnum ${styles.miniValue}`}>{value}</div>
              </div>
            ))}
          </div>
          <div className={styles.eyebrow}>Owner & contact</div>
          <Rows
            rows={[
              ['Owner', w.owner],
              ['Email', <span className="mono" style={{ fontSize: 12 }}>{w.email}</span>],
              ['Workspace ID', <span className="mono" style={{ fontSize: 12 }}>{w.id}</span>],
              ['Region', w.region],
              ['Created', w.created],
              ['Last active', w.active],
            ]}
          />
          <div className={styles.eyebrow}>Feature flags</div>
          <div className={styles.chipList}>
            {w.flags.length ? (
              w.flags.map((f) => <span key={f} className={styles.flagPill}>{f}</span>)
            ) : (
              <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>No flags enabled.</span>
            )}
          </div>
        </div>
      )}

      {wsTab === 'users' && (
        <div style={{ animation: 'fade .2s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 13, color: 'var(--text4)' }}>{w.users} members</div>
            <button type="button" className="sbtn" style={{ padding: '6px 10px', fontSize: 12 }}>Manage roles</button>
          </div>
          {USERS.filter((u) => u.ws === w.name)
            .concat(USERS.slice(0, 3))
            .slice(0, 5)
            .map((u, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderTop: '1px solid var(--divider)' }}>
                <Avatar name={u.name} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag {...ROLE[u.role]} />
                  <div style={{ fontSize: 10.5, color: 'var(--text4)', marginTop: 4 }}>{u.last}</div>
                </div>
              </div>
            ))}
        </div>
      )}

      {wsTab === 'usage' && (
        <div style={{ animation: 'fade .2s ease' }}>
          <div className={styles.eyebrow}>Sends this month · by channel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15, marginBottom: 26 }}>
            {channels.map((c) => (
              <div key={c.label}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={styles.swatch} style={{ background: c.color }} />
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{c.label}</span>
                  </div>
                  <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>{fmtInt(c.value)}</span>
                </div>
                <Bar pct={(c.value / maxCh) * 100} color={c.color} />
              </div>
            ))}
          </div>
          <div className={styles.eyebrow}>Quota & limits</div>
          <div className={styles.miniCard}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Monthly send quota</span>
              <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: quotaColor(w.quota) }}>{w.quota}% used</span>
            </div>
            <Bar pct={w.quota} color={quotaColor(w.quota)} />
            <div className="tnum" style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 8 }}>
              {fmtInt(Math.round((w.quota / 100) * w.quotaCap))} of {fmtInt(w.quotaCap)} messages
            </div>
          </div>
        </div>
      )}

      {wsTab === 'billing' && (
        <div style={{ animation: 'fade .2s ease' }}>
          <div className={styles.detailGrid}>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>MRR</div>
              <div className={`tnum ${styles.miniValue}`}>{fmtUsd(w.mrr)}</div>
            </div>
            <div className={styles.miniCard}>
              <div className={styles.miniLabel}>Lifetime value</div>
              <div className={`tnum ${styles.miniValue}`}>{fmtUsd(w.ltv)}</div>
            </div>
          </div>
          <Rows
            rows={[
              ['Plan', PLAN[w.plan].label],
              ['Billing status', <Pill p={WS_STATUS[w.status]} />],
              ['Payment method', <span className="mono" style={{ fontSize: 12 }}>{w.card}</span>],
              ['Next invoice', w.nextInvoice],
              ['Seats billed', <span className="tnum">{w.users}</span>],
            ]}
          />
          <div className={styles.eyebrow}>Invoice history</div>
          {w.mrr > 0 ? (
            INVOICES.filter((v) => v.ws === w.name)
              .concat(INVOICES.slice(0, 3))
              .slice(0, 4)
              .map((v, i) => (
                <div key={i} className={styles.detailRow} style={{ paddingBottom: 9, borderBottom: '1px solid var(--divider)' }}>
                  <span className="k">
                    {v.period} · <span className="mono" style={{ fontSize: 11 }}>{v.num}</span>
                  </span>
                  <span className="v" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="tnum">{fmtUsd(v.amount)}</span>
                    <Pill p={INV_STATUS[v.status]} />
                  </span>
                </div>
              ))
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted)', fontSize: 12.5, border: '1px dashed var(--border2)', borderRadius: 12 }}>
              No invoices — this workspace is on a free/trial plan.
            </div>
          )}
        </div>
      )}
    </DrawerShell>
  );
}
