import Icon from '../../Icon';
import {
  AT_RISK,
  NEW_SIGNUPS,
  OVERVIEW_KPIS,
  PLATFORM_ACTIVITY,
  WORKSPACES,
  fmtInt,
} from '@/lib/app/admin-data';
import type { OverviewLive } from '../live-types';
import type { ScreenProps } from '../types';
import {
  Avatar,
  Bar,
  DataTable,
  ExportBtn,
  KpiStrip,
  MiniBars,
  PageHead,
  PreviewTag,
  StackedSends,
  TableCard,
} from '../components';
import { workspaceColumns } from './columns';
import styles from '../AppAdmin.module.css';

const CH_LABEL: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', voice: 'Voice' };
const CH_COLOR: Record<string, string> = { email: '#4f46e5', sms: '#0891b2', whatsapp: '#16a34a', voice: '#d97706' };

/** Real, workspace-scoped left column: 30-day sends + per-channel breakdown. */
function LiveSends({ data }: { data: OverviewLive }) {
  const maxSent = Math.max(1, ...data.byChannel.map((c) => c.sent));
  const total30 = data.daily.reduce((t, d) => t + d.sent, 0);
  return (
    <>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
          <h2 className={styles.cardTitle}>Messages sent · 30 days</h2>
          <span className="tnum" style={{ fontSize: 13, fontWeight: 600 }}>{fmtInt(total30)}</span>
        </div>
        <MiniBars
          values={data.daily.map((d) => d.sent)}
          labels={data.daily.map((d, i) =>
            i % 5 === 0 || i === data.daily.length - 1 ? String(new Date(d.date).getUTCDate()) : '',
          )}
          color="#4f46e5"
          format={(v) => `${fmtInt(v)} sent`}
        />
      </div>
      <div className={`${styles.card} ${styles.cardPad}`}>
        <h2 className={styles.cardTitle} style={{ marginBottom: 16 }}>Sends by channel</h2>
        {data.byChannel.length === 0 ? (
          <p className={styles.sub} style={{ margin: 0 }}>No messages sent yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {data.byChannel.map((c) => {
              const color = CH_COLOR[c.channel] ?? '#4f46e5';
              return (
                <div key={c.channel}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{CH_LABEL[c.channel] ?? c.channel}</span>
                    <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color }}>{fmtInt(c.sent)}</span>
                  </div>
                  <Bar pct={(c.sent / maxSent) * 100} color={color} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export function OverviewScreen({ onSelect, live }: ScreenProps & { live?: OverviewLive | null }) {
  const openWorkspace = (w: (typeof WORKSPACES)[number]) => onSelect({ kind: 'workspace', data: w });
  const kpis = live?.kpis ?? OVERVIEW_KPIS;
  return (
    <>
      <PageHead
        title="Platform overview"
        sub={
          live
            ? 'Live usage and delivery signals for this workspace.'
            : 'Every registered workspace, owner, and usage signal across Maildrill.'
        }
        actions={
          <>
            <ExportBtn />
            <button type="button" className="pbtn">
              <Icon name="plus" size={15} stroke={2.2} />
              Invite admin
            </button>
          </>
        }
      />
      <KpiStrip items={kpis} cols={6} />
      <div className={styles.twoCol}>
        <div className={styles.stack}>
          {live ? (
            <LiveSends data={live} />
          ) : (
            <>
              <StackedSends />
              <TableCard title="Workspaces" count={WORKSPACES.length}>
                <DataTable
                  columns={workspaceColumns()}
                  rows={WORKSPACES.slice(0, 9)}
                  onRow={openWorkspace}
                  minWidth={940}
                />
              </TableCard>
            </>
          )}
        </div>

        <div className={styles.stack}>
          <div className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ display: 'flex', color: '#dc2626' }}>
                <Icon name="shield" size={15} />
              </span>
              <h3 className={styles.h3} style={{ margin: 0 }}>
                At-risk accounts
              </h3>
              {live ? (
                <PreviewTag />
              ) : (
                <span className="tnum" style={{ marginLeft: 'auto', fontSize: 11, color: '#dc2626', fontWeight: 600, background: 'var(--danger-bg)', borderRadius: 20, padding: '1px 8px' }}>
                  {AT_RISK.length}
                </span>
              )}
            </div>
            {AT_RISK.map((w) => (
              <button
                type="button"
                key={w.id}
                className={styles.railRow}
                style={{ width: '100%', background: 'none', textAlign: 'left' }}
                onClick={() => openWorkspace(w)}
              >
                <Avatar name={w.owner} size={28} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.railName}>{w.name}</div>
                  <div style={{ fontSize: 11, color: '#dc2626' }}>{w.risk}</div>
                </div>
                <Icon name="chevron-right" size={14} />
              </button>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <span style={{ display: 'flex', color: '#16a34a' }}>
                <Icon name="users" size={15} />
              </span>
              <h3 className={styles.h3} style={{ margin: 0 }}>
                New signups
              </h3>
              {live ? (
                <PreviewTag />
              ) : (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)' }}>this week</span>
              )}
            </div>
            {NEW_SIGNUPS.map((s) => (
              <div key={s.email} className={styles.railRow} style={{ cursor: 'default' }}>
                <Avatar name={s.name} size={28} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className={styles.railName}>{s.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    {s.email}
                  </div>
                </div>
                <span style={{ fontSize: 11, color: 'var(--text4)', whiteSpace: 'nowrap' }}>{s.when}</span>
              </div>
            ))}
          </div>

          <div className={`${styles.card} ${styles.cardPad}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 13 }}>
              <h3 className={styles.h3} style={{ margin: 0 }}>Platform activity</h3>
              {live && <PreviewTag />}
            </div>
            <div className={styles.timeline}>
              {PLATFORM_ACTIVITY.map((a, i) => (
                <div key={i} className={styles.tlItem}>
                  <div className={styles.tlRail}>
                    <span className={styles.tlDot} style={{ background: a.color }} />
                    {i < PLATFORM_ACTIVITY.length - 1 && <span className={styles.tlLine} />}
                  </div>
                  <div style={{ paddingBottom: 2 }}>
                    <div
                      style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--text2)' }}
                      dangerouslySetInnerHTML={{ __html: a.text }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{a.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
