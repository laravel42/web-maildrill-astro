import type { Campaign } from '@/types/app';
import Icon from './Icon';
import { CHANNEL } from './shared/channels';
import { ago } from './shared/time';
import {
  activity,
  buildGetStarted,
  buildKpis,
  buildRecent,
  buildSpark,
  channelPerf,
  isStepDone,
  statusLabel,
  type ActivityPoint,
  type Summary,
} from './AppDashboard.logic';
import styles from './AppDashboard.module.css';

export default function AppDashboard({
  summary = null,
  campaigns = [],
  daily = [],
  greeting = 'Hello',
}: {
  summary?: Summary | null;
  campaigns?: Campaign[];
  daily?: ActivityPoint[];
  greeting?: string;
} = {}) {
  const kpis = buildKpis(summary);
  const recent = buildRecent(campaigns);
  const getStarted = buildGetStarted(summary);
  const spark = buildSpark(daily);
  const sentInWindow = daily.reduce((t, d) => t + d.sent, 0);
  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      {/* greeting */}
      <div className={styles.greet}>
        <div>
          <h1 className="screen__h1">{greeting} 👋</h1>
          <p className="screen__sub">Here's what's happening with your workspace today.</p>
        </div>
        <div className={styles.actions}>
          <a href="/dashboard/campaigns" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            Create campaign
          </a>
          <a href="/dashboard/subscribers" className="sbtn">
            <Icon name="upload" size={15} />
            Import contacts
          </a>
        </div>
      </div>

      {/* KPI strip */}
      <div className={styles.kpis}>
        {kpis.map((k) => (
          <div key={k.label} className="akpi">
            <div className="akpi__label">{k.label}</div>
            <div className="akpi__value tnum">{k.value}</div>
            <div className={`akpi__delta ${k.up ? 'akpi__delta--up' : 'akpi__delta--flat'} tnum`}>
              {k.delta}
            </div>
          </div>
        ))}
      </div>

      {/* recent campaigns + activity */}
      <div className={styles.row}>
        <div className="acrd" style={{ overflow: 'hidden' }}>
          <div className="acrd__head">
            <h2 className="acrd__title">Recent campaigns</h2>
            <a href="/dashboard/campaigns" className="acrd__link">
              View all
            </a>
          </div>
          <div className={styles.ctHead}>
            <span>Campaign</span>
            <span>Status</span>
            <span>Recipients</span>
            <span>Open</span>
            <span>Updated</span>
          </div>
          {recent.length === 0 && (
            <p className={styles.cardEmpty}>
              No campaigns yet — create your first and it shows up here.
            </p>
          )}
          {recent.map((c) => (
            <a key={c.id} href="/dashboard/campaigns" className={styles.ctRow}>
              <span className={styles.ctName}>{c.name}</span>
              <span>
                <span className={`astatus astatus--${c.status}`}>{statusLabel[c.status]}</span>
              </span>
              <span className={`tnum ${styles.muted3}`}>
                {c.recipients.toLocaleString('en-US')}
              </span>
              <span className={`tnum ${styles.muted3}`}>
                {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
              </span>
              <span className={styles.muted}>{ago(c.updatedAt)}</span>
            </a>
          ))}
        </div>

        <div className="acrd" style={{ overflow: 'hidden' }}>
          <div className="acrd__head">
            <h2 className="acrd__title">Recent activity</h2>
          </div>
          {activity.length === 0 && (
            <p className={styles.cardEmpty}>
              Workspace activity lands here as things happen — sends, imports, and edits.
            </p>
          )}
          <div className={styles.activity}>
            {activity.map((a, i) => (
              <div key={i} className={styles.act}>
                <span className={styles.actIc} style={{ background: a.bg, color: a.color }}>
                  <Icon name={a.icon} size={15} />
                </span>
                <div>
                  <div className={styles.actText}>{a.text}</div>
                  <div className={styles.actTime}>{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* performance by channel */}
      <div className={`acrd ${styles.perf}`}>
        <div className={styles.perfHead}>
          <h2 className="acrd__title">Performance by channel</h2>
          <a href="/dashboard/analytics" className="acrd__link">
            View analytics
          </a>
        </div>
        {channelPerf.length === 0 && (
          <p className={styles.cardEmpty} style={{ padding: 0 }}>
            Per-channel volume appears once your campaigns start sending.
          </p>
        )}
        <div className={styles.perfList}>
          {channelPerf.map((p) => {
            const meta = CHANNEL[p.channel];
            return (
              <div key={p.channel} className={styles.perfRow}>
                <span
                  className={styles.perfIc}
                  style={{ background: meta.tint, color: meta.color }}
                >
                  <Icon name={meta.icon} size={14} />
                </span>
                <div className={styles.perfLabel}>
                  <div className={styles.perfName}>{meta.label}</div>
                  <div className={`tnum ${styles.perfSent}`}>{p.sent} sent</div>
                </div>
                <div className={styles.perfBar}>
                  <div className={styles.perfBarlabels}>
                    <span>Open {p.open}</span>
                    <span>Click {p.click}</span>
                  </div>
                  <div className="abar">
                    <div
                      className="abar__fill"
                      style={{
                        width: `${p.openW}%`,
                        background: meta.color,
                        animation: 'grow .5s ease',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* sparkline + get started */}
      <div className={styles.row} style={{ marginBottom: 0 }}>
        <div className={`acrd ${styles.spark}`}>
          <div className={styles.perfHead}>
            <h2 className="acrd__title">Performance · last 30 days</h2>
          </div>
          <div className={styles.sparkBody}>
            <div className={styles.sparkStat}>
              <div className={styles.sparkLbl}>Messages sent</div>
              <div className={`tnum ${styles.sparkVal}`}>
                {sentInWindow.toLocaleString('en-US')}
              </div>
              <div className={`tnum ${styles.sparkDelta}`} />
            </div>
            {!spark.line && (
              <p className={styles.cardEmpty} style={{ padding: '0 0 4px' }}>
                Daily send volume plots here once there is activity to chart.
              </p>
            )}
            {spark.line && (
              <svg
                width="100%"
                height="70"
                viewBox="0 0 100 32"
                preserveAspectRatio="none"
                className={styles.sparkSvg}
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="dashspk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4f46e5" stopOpacity="0.18" />
                    <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points={spark.area} fill="url(#dashspk)" stroke="none" />
                <polyline
                  points={spark.line}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
        </div>

        <div className={`acrd ${styles.start}`}>
          <h2 className="acrd__title" style={{ marginBottom: 13 }}>
            Get started
          </h2>
          {getStarted.map((g) => (
            <div key={g.label} className={styles.startItem} style={{ background: g.bg }}>
              <span
                className={styles.startDisc}
                style={{ borderColor: g.ring, background: g.fill }}
              >
                {isStepDone(g) && (
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="3.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className={styles.startLbl} style={{ color: g.text }}>
                {g.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
