import { campaigns, currentUser, lists } from '@/lib/app/mock-data';
import type { ChannelType } from '@/types/app';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';

// Fixed reference "now" (matches the mock data window) — deterministic across
// SSR + hydration, so no mismatch and no Date.now() nondeterminism.
const NOW = new Date('2026-07-17T18:00:00Z').getTime();

function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? '1d ago' : `${days}d ago`;
}

const CHANNEL: Record<ChannelType, { color: string; tint: string; icon: IconName; label: string }> =
  {
    email: { color: 'var(--ch-email)', tint: 'var(--ch-email-tint)', icon: 'mail', label: 'Email' },
    sms: { color: 'var(--ch-sms)', tint: 'var(--ch-sms-tint)', icon: 'sms', label: 'SMS' },
    whatsapp: {
      color: 'var(--ch-whatsapp)',
      tint: 'var(--ch-whatsapp-tint)',
      icon: 'whatsapp',
      label: 'WhatsApp',
    },
    voice: {
      color: 'var(--ch-voice)',
      tint: 'var(--ch-voice-tint)',
      icon: 'voice',
      label: 'Voice',
    },
  };

const statusLabel: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  paused: 'Paused',
};

const totalSubs = lists.reduce((sum, l) => sum + l.subscribers, 0);
const sentCount = campaigns.filter((c) => c.status === 'sent').length;

const kpis = [
  {
    label: 'Active subscribers',
    value: totalSubs.toLocaleString('en-US'),
    delta: '↑ 1,006 this month',
    up: true,
  },
  { label: 'Lists', value: String(lists.length), delta: 'All active', up: false },
  { label: 'Campaigns', value: String(campaigns.length), delta: `${sentCount} sent`, up: false },
  { label: 'Emails sent today', value: '0', delta: '—', up: false },
  { label: 'Open rate', value: '43%', delta: '↑ 4% vs 30d', up: true },
  { label: 'Click rate', value: '12%', delta: '↑ 2% vs 30d', up: true },
];

const recent = campaigns.slice(0, 4);

const activity: { icon: IconName; bg: string; color: string; text: string; time: string }[] = [
  {
    icon: 'subscribers',
    bg: 'var(--accent-tint)',
    color: 'var(--accent)',
    text: 'Imported 300 contacts to VIP buyers',
    time: '2 hours ago',
  },
  {
    icon: 'edit',
    bg: 'var(--surface2)',
    color: 'var(--text4)',
    text: 'Winback draft created',
    time: '3 hours ago',
  },
  {
    icon: 'templates',
    bg: 'var(--warning-bg)',
    color: 'var(--warning)',
    text: 'Template "Product launch" updated',
    time: '5 hours ago',
  },
  {
    icon: 'plus',
    bg: 'var(--success-bg)',
    color: 'var(--success-strong)',
    text: 'Recent buyers list created',
    time: 'Yesterday',
  },
];

const channelPerf = [
  { channel: 'email' as ChannelType, sent: '11,240', open: '43.2%', click: '12.1%', openW: 43 },
  { channel: 'sms' as ChannelType, sent: '980', open: '61.4%', click: '24.3%', openW: 61 },
  { channel: 'whatsapp' as ChannelType, sent: '260', open: '88.5%', click: '31.2%', openW: 88 },
  { channel: 'voice' as ChannelType, sent: '95', open: '71.0%', click: '—', openW: 71 },
];

const spark = [32, 34, 33, 38, 36, 40, 39, 43, 41, 44];
function sparkPoints(pts: number[], w: number, h: number): string {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  return pts
    .map(
      (p, i) =>
        `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((p - min) / rng) * h).toFixed(1)}`,
    )
    .join(' ');
}
const sparkLine = sparkPoints(spark, 320, 66);
const sparkArea = `${sparkLine} 320,70 0,70`;

const getStarted = [
  {
    label: 'Import your contacts',
    bg: 'var(--surface2)',
    ring: '#22c55e',
    fill: '#22c55e',
    text: 'var(--text3)',
  },
  {
    label: 'Create your first campaign',
    bg: 'var(--accent-tint)',
    ring: 'var(--accent)',
    fill: 'transparent',
    text: 'var(--accent)',
  },
  {
    label: 'Send your first email',
    bg: 'var(--surface2)',
    ring: 'var(--muted2)',
    fill: 'transparent',
    text: 'var(--text4)',
  },
];

export default function AppDashboard() {
  return (
    <div className="screen dash">
      {/* greeting */}
      <div className="dash__greet">
        <div>
          <h1 className="screen__h1">Good evening, {currentUser.name} 👋</h1>
          <p className="screen__sub">Here's what's happening with your workspace today.</p>
        </div>
        <div className="dash__actions">
          <a href="/app/campaigns" className="pbtn">
            <Icon name="plus" size={15} stroke={2.2} />
            Create campaign
          </a>
          <a href="/app/subscribers" className="sbtn">
            <Icon name="upload" size={15} />
            Import contacts
          </a>
        </div>
      </div>

      {/* KPI strip */}
      <div className="dash__kpis">
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
      <div className="dash__row">
        <div className="acrd" style={{ overflow: 'hidden' }}>
          <div className="acrd__head">
            <h2 className="acrd__title">Recent campaigns</h2>
            <a href="/app/campaigns" className="acrd__link">
              View all
            </a>
          </div>
          <div className="dash__ct-head">
            <span>Campaign</span>
            <span>Status</span>
            <span>Recipients</span>
            <span>Open</span>
            <span>Updated</span>
          </div>
          {recent.map((c) => (
            <a key={c.id} href="/app/campaigns" className="dash__ct-row">
              <span className="dash__ct-name">{c.name}</span>
              <span>
                <span className={`astatus astatus--${c.status}`}>{statusLabel[c.status]}</span>
              </span>
              <span className="tnum dash__muted3">{c.recipients.toLocaleString('en-US')}</span>
              <span className="tnum dash__muted3">
                {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
              </span>
              <span className="dash__muted">{ago(c.updatedAt)}</span>
            </a>
          ))}
        </div>

        <div className="acrd" style={{ overflow: 'hidden' }}>
          <div className="acrd__head">
            <h2 className="acrd__title">Recent activity</h2>
          </div>
          <div className="dash__activity">
            {activity.map((a, i) => (
              <div key={i} className="dash__act">
                <span className="dash__act-ic" style={{ background: a.bg, color: a.color }}>
                  <Icon name={a.icon} size={15} />
                </span>
                <div>
                  <div className="dash__act-text">{a.text}</div>
                  <div className="dash__act-time">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* performance by channel */}
      <div className="acrd dash__perf">
        <div className="dash__perf-head">
          <h2 className="acrd__title">Performance by channel</h2>
          <a href="/app/analytics" className="acrd__link">
            View analytics
          </a>
        </div>
        <div className="dash__perf-list">
          {channelPerf.map((p) => {
            const meta = CHANNEL[p.channel];
            return (
              <div key={p.channel} className="dash__perf-row">
                <span
                  className="dash__perf-ic"
                  style={{ background: meta.tint, color: meta.color }}
                >
                  <Icon name={meta.icon} size={14} />
                </span>
                <div className="dash__perf-label">
                  <div className="dash__perf-name">{meta.label}</div>
                  <div className="tnum dash__perf-sent">{p.sent} sent</div>
                </div>
                <div className="dash__perf-bar">
                  <div className="dash__perf-barlabels">
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
      <div className="dash__row" style={{ marginBottom: 0 }}>
        <div className="acrd dash__spark">
          <div className="dash__perf-head">
            <h2 className="acrd__title">Performance · last 30 days</h2>
          </div>
          <div className="dash__spark-body">
            <div className="dash__spark-stat">
              <div className="dash__spark-lbl">Open rate</div>
              <div className="tnum dash__spark-val">43%</div>
              <div className="tnum dash__spark-delta">↑ 4%</div>
            </div>
            <svg
              width="100%"
              height="70"
              viewBox="0 0 320 70"
              preserveAspectRatio="none"
              className="dash__spark-svg"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="dashspk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#4f46e5" stopOpacity="0.18" />
                  <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline points={sparkArea} fill="url(#dashspk)" stroke="none" />
              <polyline
                points={sparkLine}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <div className="acrd dash__start">
          <h2 className="acrd__title" style={{ marginBottom: 13 }}>
            Get started
          </h2>
          {getStarted.map((g) => (
            <div key={g.label} className="dash__start-item" style={{ background: g.bg }}>
              <span
                className="dash__start-disc"
                style={{ borderColor: g.ring, background: g.fill }}
              >
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
              </span>
              <span className="dash__start-lbl" style={{ color: g.text }}>
                {g.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .dash { animation: fade .3s ease; }
        .dash__greet { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 26px; flex-wrap: wrap; }
        .dash__actions { display: flex; gap: 10px; flex: none; }
        .dash__actions a { text-decoration: none; }
        .dash__kpis { display: grid; grid-template-columns: repeat(6, 1fr); gap: 14px; margin-bottom: 18px; }
        .dash__row { display: grid; grid-template-columns: 1.55fr 1fr; gap: 18px; margin-bottom: 18px; }
        .dash__muted { color: var(--muted); font-size: 12px; }
        .dash__muted3 { color: var(--text3); }

        .dash__ct-head, .dash__ct-row {
          display: grid; grid-template-columns: 1.6fr .9fr .7fr .6fr .7fr; align-items: center;
          padding: 12px 19px;
        }
        .dash__ct-head {
          font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .3px;
          text-transform: uppercase; border-bottom: 1px solid var(--surface2); padding: 10px 19px;
        }
        .dash__ct-row {
          border-bottom: 1px solid var(--divider); font-size: 13px; color: var(--text);
          transition: background .12s var(--ease-out);
        }
        .dash__ct-row:last-child { border-bottom: none; }
        .dash__ct-row:hover { background: var(--surface2); }
        .dash__ct-name { font-weight: 500; }

        .dash__activity { padding: 6px 19px 13px; }
        .dash__act { display: flex; gap: 11px; padding: 10px 0; border-bottom: 1px solid var(--divider); }
        .dash__act:last-child { border-bottom: none; }
        .dash__act-ic { width: 29px; height: 29px; flex: none; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .dash__act-text { font-size: 12.5px; line-height: 1.35; color: var(--text2); }
        .dash__act-time { font-size: 11px; color: var(--muted); margin-top: 2px; }

        .dash__perf { padding: 17px 20px; margin-bottom: 18px; }
        .dash__perf-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .dash__perf-list { display: flex; flex-direction: column; gap: 14px; }
        .dash__perf-row { display: flex; align-items: center; gap: 13px; }
        .dash__perf-ic { width: 30px; height: 30px; flex: none; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
        .dash__perf-label { flex: none; width: 78px; }
        .dash__perf-name { font-size: 13px; font-weight: 600; }
        .dash__perf-sent { font-size: 11px; color: var(--muted); }
        .dash__perf-bar { flex: 1; min-width: 0; }
        .dash__perf-barlabels { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-bottom: 4px; }

        .dash__spark { padding: 17px 20px; }
        .dash__spark-body { display: flex; gap: 28px; align-items: flex-end; }
        .dash__spark-stat { flex: none; }
        .dash__spark-lbl { font-size: 11.5px; color: var(--muted); }
        .dash__spark-val { font-size: 23px; font-weight: 600; letter-spacing: -.5px; margin-top: 3px; }
        .dash__spark-delta { font-size: 11.5px; color: var(--success); font-weight: 500; margin-top: 3px; }
        .dash__spark-svg { flex: 1; }

        .dash__start { padding: 17px 19px; }
        .dash__start-item { display: flex; align-items: center; gap: 10px; padding: 10px 11px; border-radius: 10px; margin-bottom: 6px; }
        .dash__start-disc { width: 19px; height: 19px; flex: none; border-radius: 50%; border: 1.6px solid; display: flex; align-items: center; justify-content: center; }
        .dash__start-lbl { font-size: 12.5px; font-weight: 500; }

        @media (max-width: 1180px) { .dash__kpis { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 1000px) { .dash__row { grid-template-columns: 1fr; } }
        @media (max-width: 640px) {
          .dash__kpis { grid-template-columns: repeat(2, 1fr); }
          .dash__ct-head span:nth-child(3), .dash__ct-row span:nth-child(3) { display: none; }
        }
      `}</style>
    </div>
  );
}
