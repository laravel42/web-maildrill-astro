import { useState } from 'react';
import { analyticsSeries } from '@/lib/app/mock-data';
import type { AnalyticsPoint, ChannelType } from '@/types/app';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';

/* ------------------------------------------------------------------ *
 * Account-wide analytics screen (App.dc.html · isAnalytics).
 * Every chart is hand-built inline SVG / CSS — no chart library.
 * The hero trend chart is driven by the shared `analyticsSeries`
 * fixture; the remaining panels use the design's account rollup
 * numbers, defined locally below.
 * ------------------------------------------------------------------ */

/* Fixed reference window label — deterministic across SSR + hydration. */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}`;
}

const CHANNEL: Record<ChannelType, { color: string; tint: string; icon: IconName; label: string }> = {
  email: { color: 'var(--ch-email)', tint: 'var(--ch-email-tint)', icon: 'mail', label: 'Email' },
  sms: { color: 'var(--ch-sms)', tint: 'var(--ch-sms-tint)', icon: 'sms', label: 'SMS' },
  whatsapp: { color: 'var(--ch-whatsapp)', tint: 'var(--ch-whatsapp-tint)', icon: 'whatsapp', label: 'WhatsApp' },
  voice: { color: 'var(--ch-voice)', tint: 'var(--ch-voice-tint)', icon: 'voice', label: 'Voice' },
};
const CHANNEL_KEYS: ChannelType[] = ['email', 'sms', 'whatsapp', 'voice'];

/* Range chips — visual toggle only (source data is static). */
const RANGES: { key: string; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: '12m', label: '12 months' },
];

/* ---- KPI trend strip (§1.2) ---- */
const KPIS: { label: string; value: string; delta: string; line: string; spark: number[] }[] = [
  { label: 'Open rate', value: '43%', delta: '↑ 4%', line: '#4f46e5', spark: [32, 34, 33, 38, 36, 40, 39, 43] },
  { label: 'Click rate', value: '12%', delta: '↑ 2%', line: '#8b5cf6', spark: [8, 9, 8, 10, 9, 11, 10, 12] },
  { label: 'Delivered', value: '97.8%', delta: '↑ 0.3%', line: '#059669', spark: [96, 97, 96.5, 97.2, 97, 97.5, 97.6, 97.8] },
  { label: 'Unsub rate', value: '0.4%', delta: '↓ 0.1%', line: '#d97706', spark: [0.7, 0.6, 0.65, 0.55, 0.5, 0.48, 0.45, 0.4] },
];

/* ---- Per-channel comparison bars (§1.3b) ---- */
const BY_CHANNEL: { ch: ChannelType; label: string; sent: string; pct: string; w: number; color: string }[] = [
  { ch: 'email', label: 'Email', sent: '11,240', pct: '90%', w: 90, color: '#4f46e5' },
  { ch: 'sms', label: 'SMS', sent: '980', pct: '8%', w: 8, color: '#8b5cf6' },
  { ch: 'whatsapp', label: 'WhatsApp', sent: '260', pct: '2%', w: 2, color: '#c4b5fd' },
  { ch: 'voice', label: 'Voice', sent: '95', pct: '0.7%', w: 0.7, color: '#d97706' },
];

/* ---- Channel performance table (§1.4) ---- */
const CHANNEL_PERF: {
  ch: ChannelType;
  sent: string;
  delivered: string;
  open: string;
  openW: number;
  click: string;
  clickW: number;
}[] = [
  { ch: 'email', sent: '11,240', delivered: '98.6%', open: '43.2%', openW: 43, click: '12.1%', clickW: 12 },
  { ch: 'sms', sent: '980', delivered: '99.2%', open: '61.4%', openW: 61, click: '24.3%', clickW: 24 },
  { ch: 'whatsapp', sent: '260', delivered: '99.8%', open: '88.5%', openW: 88, click: '31.2%', clickW: 31 },
  { ch: 'voice', sent: '95', delivered: '96.4%', open: '71.0%', openW: 71, click: '—', clickW: 0 },
];

/* ---- Engagement funnel (§1.5a) ---- */
const FUNNEL: { stage: string; value: string; pct: string; w: number; color: string }[] = [
  { stage: 'Sent', value: '12,480', pct: '100%', w: 100, color: '#4f46e5' },
  { stage: 'Delivered', value: '12,210', pct: '97.8%', w: 97.8, color: '#6366f1' },
  { stage: 'Opened', value: '5,240', pct: '42.9%', w: 42.9, color: '#8b5cf6' },
  { stage: 'Clicked', value: '1,490', pct: '12.2%', w: 12.2, color: '#a78bfa' },
];

/* ---- Top devices (§1.5b) ---- */
const DEVICES: { label: string; pct: string; w: number; color: string }[] = [
  { label: 'Desktop', pct: '58%', w: 58, color: '#4f46e5' },
  { label: 'Mobile', pct: '36%', w: 36, color: '#8b5cf6' },
  { label: 'Tablet', pct: '6%', w: 6, color: '#c4b5fd' },
];

/* ---- Top campaigns (§1.6a) ---- */
const TOP_CAMPAIGNS: { name: string; open: string; w: number }[] = [
  { name: 'Product Launch', open: '45%', w: 100 },
  { name: 'Welcome Series', open: '42%', w: 93 },
  { name: 'Spring Preview', open: '38%', w: 84 },
  { name: 'Holiday Deals', open: '31%', w: 69 },
];

/* ---- Top links clicked (§1.6b) ---- */
const TOP_LINKS: { url: string; clicks: string }[] = [
  { url: 'maildrill.app/summer-sale', clicks: '842' },
  { url: 'maildrill.app/shop/new', clicks: '516' },
  { url: 'maildrill.app/blog/tips', clicks: '298' },
  { url: 'maildrill.app/pricing', clicks: '173' },
];

/* ---- Hero trend chart series (over analyticsSeries) ---- */
type SeriesKey = 'sent' | 'delivered' | 'opened' | 'clicked';
const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'sent', label: 'Sent', color: '#4f46e5' },
  { key: 'delivered', label: 'Delivered', color: '#6366f1' },
  { key: 'opened', label: 'Opened', color: '#8b5cf6' },
  { key: 'clicked', label: 'Clicked', color: '#a78bfa' },
];

/* Sparkline point generator (§1.2 `spk`): normalize per-series, map to w×h. */
function sparkPoints(pts: number[], w: number, h: number): string {
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const rng = max - min || 1;
  return pts
    .map((p, i) => `${((i / (pts.length - 1)) * w).toFixed(1)},${(h - ((p - min) / rng) * h).toFixed(1)}`)
    .join(' ');
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const f = n <= 1 ? 1 : n <= 1.5 ? 1.5 : n <= 2 ? 2 : n <= 3 ? 3 : n <= 4 ? 4 : n <= 5 ? 5 : n <= 6 ? 6 : n <= 8 ? 8 : 10;
  return f * pow;
}
function fmtCompact(v: number): string {
  if (v >= 1000) {
    const k = v / 1000;
    return `${k % 1 === 0 ? k.toString() : k.toFixed(1)}k`;
  }
  return String(Math.round(v));
}

/* Reconcile the hero trend with the funnel/channel rollup (§1.5a Sent = 12,480):
   scale the shared daily series so its total matches every other panel. */
const ROLLUP_SENDS = 12_480;
const RAW_TOTAL = analyticsSeries.reduce((s, p) => s + p.sent, 0);
const HERO_SCALE = ROLLUP_SENDS / RAW_TOTAL;
const HERO_SERIES: AnalyticsPoint[] = analyticsSeries.map((p) => ({
  ...p,
  sent: Math.round(p.sent * HERO_SCALE),
  delivered: Math.round(p.delivered * HERO_SCALE),
  opened: Math.round(p.opened * HERO_SCALE),
  clicked: Math.round(p.clicked * HERO_SCALE),
}));
const TOTAL_SENDS = HERO_SERIES.reduce((s, p) => s + p.sent, 0);

/* =================================================================== */

export default function AppAnalytics() {
  const [range, setRange] = useState('30d');
  const [channel, setChannel] = useState<ChannelType | 'all'>('all');
  const [visible, setVisible] = useState<Set<SeriesKey>>(new Set<SeriesKey>(['sent', 'opened', 'clicked']));
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const toggleSeries = (key: SeriesKey) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size === 1) return prev; // keep at least one series shown
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

  /* dim non-selected channels when a specific channel is focused */
  const dim = (ch: ChannelType): number => (channel !== 'all' && ch !== channel ? 0.32 : 1);

  return (
    <div className="screen an">
      {/* header + selectors */}
      <div className="screen__head an__head">
        <div>
          <h1 className="screen__h1">Analytics</h1>
          <p className="screen__sub">Delivery and engagement across all channels.</p>
        </div>
        <div className="an__controls">
          <div className="aseg an__seg" role="group" aria-label="Filter by channel">
            <button
              type="button"
              className={`aseg__opt${channel === 'all' ? ' is-active' : ''}`}
              aria-pressed={channel === 'all'}
              onClick={() => setChannel('all')}
            >
              All channels
            </button>
            {CHANNEL_KEYS.map((ch) => (
              <button
                type="button"
                key={ch}
                className={`aseg__opt an__seg-ch${channel === ch ? ' is-active' : ''}`}
                aria-pressed={channel === ch}
                onClick={() => setChannel(ch)}
              >
                <span className="an__seg-dot" style={{ background: CHANNEL[ch].color }} />
                {CHANNEL[ch].label}
              </button>
            ))}
          </div>
          <div className="aseg an__seg" role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                type="button"
                key={r.key}
                className={`aseg__opt${range === r.key ? ' is-active' : ''}`}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" className="sbtn" onClick={() => showToast('Preparing analytics export…')}>
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
      </div>

      {/* KPI trend strip */}
      <div className="an__kpis">
        {KPIS.map((k) => (
          <div key={k.label} className="acrd an__kpi">
            <div className="an__kpi-top">
              <span className="an__kpi-lbl">{k.label}</span>
              <span className="an__kpi-delta tnum">{k.delta}</span>
            </div>
            <div className="an__kpi-val tnum">{k.value}</div>
            <svg
              className="an__kpi-spark"
              width="100%"
              height="30"
              viewBox="0 0 120 30"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <polyline
                points={sparkPoints(k.spark, 120, 30)}
                fill="none"
                stroke={k.line}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        ))}
      </div>

      {/* hero trend chart */}
      <section className="acrd an__hero" aria-label="Sends, opens and clicks over time">
        <div className="an__card-head">
          <div>
            <h2 className="acrd__title">Sends, opens &amp; clicks over time</h2>
            <p className="an__card-sub tnum">
              Daily volume · {fmtDate(analyticsSeries[0].date)} – {fmtDate(analyticsSeries[analyticsSeries.length - 1].date)}
            </p>
          </div>
          <div className="an__hero-total">
            <span className="an__hero-num tnum">{TOTAL_SENDS.toLocaleString('en-US')}</span>
            <span className="an__hero-lbl">total sends</span>
          </div>
        </div>

        <div className="an__legend">
          {SERIES.map((s) => {
            const on = visible.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                className="an__leg"
                aria-pressed={on}
                onClick={() => toggleSeries(s.key)}
              >
                <span className="an__leg-sw" style={{ background: on ? s.color : 'var(--muted2)' }} />
                {s.label}
              </button>
            );
          })}
        </div>

        <TrendChart visible={visible} />
      </section>

      {/* funnel + by channel */}
      <div className="an__row an__row--2">
        <section className="acrd an__panel">
          <h2 className="an__panel-title">Engagement funnel</h2>
          {FUNNEL.map((f) => (
            <div key={f.stage} className="an__bar-row">
              <div className="an__bar-top">
                <span className="an__bar-lbl">{f.stage}</span>
                <span className="an__bar-meta tnum">
                  {f.value} · {f.pct}
                </span>
              </div>
              <div className="an__track">
                <div className="an__fill" style={{ width: `${f.w}%`, background: f.color }} />
              </div>
            </div>
          ))}
        </section>

        <section className="acrd an__panel">
          <h2 className="an__panel-title">By channel</h2>
          {BY_CHANNEL.map((c) => (
            <div key={c.ch} className="an__bar-row" style={{ opacity: dim(c.ch), transition: 'opacity .2s ease' }}>
              <div className="an__bar-top">
                <span className="an__bar-lbl">{c.label}</span>
                <span className="an__bar-meta tnum">
                  {c.sent} · {c.pct}
                </span>
              </div>
              <div className="an__track">
                <div className="an__fill" style={{ width: `${Math.max(c.w, 1.5)}%`, background: c.color }} />
              </div>
            </div>
          ))}
        </section>
      </div>

      {/* channel performance table */}
      <section className="acrd an__table">
        <div className="acrd__head">
          <h2 className="acrd__title">Channel performance</h2>
          <span className="an__table-sub">
            {channel === 'all' ? 'Delivery & engagement per channel' : `Focused on ${CHANNEL[channel].label}`}
          </span>
        </div>
        <div className="an__ct">
          <div className="an__ct-inner">
            <div className="an__ct-head">
              <div>Channel</div>
              <div className="an__ct-r">Sent</div>
              <div className="an__ct-r">Delivered</div>
              <div>Open rate</div>
              <div>Click rate</div>
            </div>
            {CHANNEL_PERF.map((row) => {
              const m = CHANNEL[row.ch];
              return (
                <div
                  key={row.ch}
                  className="an__ct-row"
                  style={{ opacity: dim(row.ch), transition: 'opacity .2s ease' }}
                >
                  <div className="an__ct-ch">
                    <span className="an__ct-chip" style={{ background: m.tint, color: m.color }}>
                      <Icon name={m.icon} size={14} />
                    </span>
                    <span className="an__ct-chname">{m.label}</span>
                  </div>
                  <div className="an__ct-num tnum">{row.sent}</div>
                  <div className="an__ct-del tnum">{row.delivered}</div>
                  <div className="an__ct-rate">
                    <div className="an__ct-mini">
                      <div className="an__ct-mini-fill" style={{ width: `${row.openW}%`, background: m.color }} />
                    </div>
                    <span className="an__ct-rate-val tnum">{row.open}</span>
                  </div>
                  <div className="an__ct-rate">
                    <div className="an__ct-mini">
                      <div
                        className="an__ct-mini-fill"
                        style={{ width: `${row.clickW}%`, background: m.color, opacity: 0.6 }}
                      />
                    </div>
                    <span className="an__ct-rate-val tnum">{row.click}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* top campaigns / top links / devices */}
      <div className="an__row an__row--3">
        <section className="acrd an__panel">
          <h2 className="an__panel-title">Top campaigns</h2>
          {TOP_CAMPAIGNS.map((c) => (
            <div key={c.name} className="an__tc-row">
              <span className="an__tc-name" title={c.name}>
                {c.name}
              </span>
              <div className="an__track an__tc-track">
                <div className="an__fill" style={{ width: `${c.w}%`, background: '#4f46e5' }} />
              </div>
              <span className="an__tc-open tnum">{c.open}</span>
            </div>
          ))}
        </section>

        <section className="acrd an__panel">
          <h2 className="an__panel-title">Top links clicked</h2>
          {TOP_LINKS.map((l) => (
            <div key={l.url} className="an__link-row">
              <span className="an__link-url" title={l.url}>
                {l.url}
              </span>
              <span className="an__link-clicks tnum">{l.clicks}</span>
            </div>
          ))}
        </section>

        <section className="acrd an__panel">
          <h2 className="an__panel-title">Top devices</h2>
          {DEVICES.map((d) => (
            <div key={d.label} className="an__dev-row">
              <span className="an__dev-lbl">{d.label}</span>
              <div className="an__track" style={{ flex: 1 }}>
                <div className="an__fill" style={{ width: `${d.w}%`, background: d.color }} />
              </div>
              <span className="an__dev-pct tnum">{d.pct}</span>
            </div>
          ))}
        </section>
      </div>

      {toast && (
        <div className="an__toast" role="status">
          <span className="an__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .an { animation: fade .3s ease; max-width: 1600px; }
        .an__head { align-items: flex-start; }
        .an__controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .an__seg { flex-wrap: wrap; }
        .an__seg-ch { display: inline-flex; align-items: center; gap: 6px; }
        .an__seg-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; }

        /* KPI strip */
        .an__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .an__kpi { padding: 16px 18px; }
        .an__kpi-top { display: flex; align-items: baseline; justify-content: space-between; }
        .an__kpi-lbl { font-size: 12px; color: var(--muted); font-weight: 500; }
        .an__kpi-delta { font-size: 11.5px; font-weight: 600; color: #16a34a; }
        .an__kpi-val { font-size: 26px; font-weight: 600; letter-spacing: -.6px; margin-top: 8px; }
        .an__kpi-spark { display: block; margin-top: 10px; }

        /* hero */
        .an__hero { padding: 18px 20px; margin-bottom: 18px; }
        .an__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .an__card-sub { font-size: 12.5px; color: var(--muted); margin: 5px 0 0; }
        .an__hero-total { text-align: right; flex: none; }
        .an__hero-num { display: block; font-size: 20px; font-weight: 600; letter-spacing: -.4px; }
        .an__hero-lbl { font-size: 11.5px; color: var(--muted); }
        .an__legend { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 4px; }
        .an__leg { display: inline-flex; align-items: center; gap: 7px; padding: 5px 11px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); font-size: 12px; font-weight: 600; color: var(--text2); transition: opacity .15s var(--ease-out), border-color .15s var(--ease-out); }
        .an__leg:hover { border-color: var(--border2); }
        .an__leg[aria-pressed="false"] { opacity: .5; }
        .an__leg-sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }

        .an__chartwrap { position: relative; width: 100%; margin-top: 6px; }
        .an__chart { display: block; width: 100%; height: auto; }
        .an__tip { position: absolute; top: 6px; pointer-events: none; z-index: 2; min-width: 132px; background: var(--surface); border: 1px solid var(--border2); border-radius: 10px; box-shadow: var(--shadow-md); padding: 9px 11px; }
        .an__tip-date { font-size: 11.5px; font-weight: 600; color: var(--text2); margin-bottom: 6px; }
        .an__tip-row { display: flex; align-items: center; gap: 7px; font-size: 12px; margin-top: 3px; }
        .an__tip-sw { width: 8px; height: 8px; border-radius: 2px; flex: none; }
        .an__tip-lbl { color: var(--muted); }
        .an__tip-val { margin-left: auto; font-weight: 600; color: var(--text2); }

        /* generic rows */
        .an__row { display: grid; gap: 18px; margin-bottom: 18px; }
        .an__row--2 { grid-template-columns: 1.4fr 1fr; }
        .an__row--3 { grid-template-columns: repeat(3, 1fr); margin-bottom: 0; }
        .an__panel { padding: 18px 20px; }
        .an__panel-title { font-size: 14px; font-weight: 600; margin: 0 0 16px; }

        .an__bar-row { margin-bottom: 16px; }
        .an__bar-row:last-child { margin-bottom: 0; }
        .an__bar-top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
        .an__bar-lbl { font-size: 12.5px; font-weight: 500; color: var(--text3); }
        .an__bar-meta { font-size: 12.5px; color: var(--muted); }
        .an__track { height: 10px; background: var(--surface2); border-radius: 6px; overflow: hidden; }
        .an__fill { height: 100%; border-radius: 6px; transform-origin: left; animation: grow .5s ease; }

        /* channel performance table */
        .an__table { overflow: hidden; margin-bottom: 18px; }
        .an__table-sub { font-size: 12px; color: var(--muted); }
        .an__ct { overflow-x: auto; }
        .an__ct-inner { min-width: 640px; }
        .an__ct-head, .an__ct-row { display: grid; grid-template-columns: 1.6fr .9fr 1fr 1.4fr 1.4fr; align-items: center; }
        .an__ct-head { padding: 11px 20px; font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .3px; text-transform: uppercase; border-bottom: 1px solid var(--surface2); }
        .an__ct-r { text-align: right; }
        .an__ct-row { padding: 14px 20px; border-bottom: 1px solid var(--divider); }
        .an__ct-row:last-child { border-bottom: none; }
        .an__ct-ch { display: flex; align-items: center; gap: 11px; }
        .an__ct-chip { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex: none; }
        .an__ct-chname { font-weight: 600; font-size: 13px; }
        .an__ct-num { font-size: 13px; color: var(--text3); text-align: right; }
        .an__ct-del { font-size: 13px; font-weight: 600; color: var(--success-strong); text-align: right; }
        .an__ct-rate { display: flex; align-items: center; gap: 10px; }
        .an__ct-mini { flex: 1; height: 7px; background: var(--surface2); border-radius: 6px; overflow: hidden; }
        .an__ct-mini-fill { height: 100%; border-radius: 6px; transform-origin: left; animation: grow .5s ease; }
        .an__ct-rate-val { width: 40px; text-align: right; font-size: 12.5px; font-weight: 600; color: var(--text2); }

        /* top devices */
        .an__dev-row { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; }
        .an__dev-row:last-child { margin-bottom: 0; }
        .an__dev-lbl { width: 66px; font-size: 12.5px; color: var(--text3); font-weight: 500; flex: none; }
        .an__dev-pct { width: 42px; text-align: right; font-size: 12.5px; font-weight: 600; color: var(--text2); flex: none; }

        /* top campaigns */
        .an__tc-row { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
        .an__tc-row:last-child { margin-bottom: 0; }
        .an__tc-name { width: 120px; flex: none; font-size: 12.5px; font-weight: 500; color: var(--text2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .an__tc-track { flex: 1; height: 8px; }
        .an__tc-open { width: 40px; text-align: right; font-size: 12.5px; font-weight: 600; color: var(--success-strong); flex: none; }

        /* top links */
        .an__link-row { display: flex; align-items: center; gap: 12px; padding: 9px 0; border-bottom: 1px solid var(--divider); }
        .an__link-row:last-child { border-bottom: none; }
        .an__link-url { flex: 1; min-width: 0; font-size: 12.5px; color: var(--accent); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .an__link-clicks { font-size: 12.5px; font-weight: 600; color: var(--text3); flex: none; }

        /* toast */
        .an__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: #fff; padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
        .an__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }

        @media (max-width: 1040px) {
          .an__row--2, .an__row--3 { grid-template-columns: 1fr; }
        }
        @media (max-width: 860px) {
          .an__kpis { grid-template-columns: repeat(2, 1fr); }
          .an__controls { width: 100%; }
        }
        @media (max-width: 520px) {
          .an__kpis { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hand-built interactive line/area chart over `analyticsSeries`.
 * Legend (parent) toggles series; hovering a column reveals a tooltip.
 * Fixed 900×280 viewBox scales uniformly, so tooltip positions can be
 * expressed as simple percentages of the viewBox.
 * ------------------------------------------------------------------ */
function TrendChart({ visible }: { visible: Set<SeriesKey> }) {
  const [hover, setHover] = useState<number | null>(null);

  const W = 900;
  const H = 280;
  const ML = 46;
  const MR = 14;
  const MT = 16;
  const MB = 30;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;
  const baseY = MT + plotH;

  const series: AnalyticsPoint[] = HERO_SERIES;
  const n = series.length;
  const active = SERIES.filter((s) => visible.has(s.key));

  const maxVal = Math.max(1, ...active.flatMap((s) => series.map((p) => p[s.key])));
  const yMax = niceMax(maxVal);

  const x = (i: number) => ML + (i / (n - 1)) * plotW;
  const y = (v: number) => MT + plotH - (v / yMax) * plotH;

  const grid = [0, 1, 2, 3, 4];
  const step = plotW / (n - 1);

  const sentVisible = visible.has('sent');
  const areaPath = sentVisible
    ? `M ${x(0)},${y(series[0].sent)} ` +
      series.map((p, i) => `L ${x(i)},${y(p.sent)}`).join(' ') +
      ` L ${x(n - 1)},${baseY} L ${x(0)},${baseY} Z`
    : '';

  return (
    <div className="an__chartwrap" onMouseLeave={() => setHover(null)}>
      <svg
        className="an__chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Daily sends, opens and clicks from ${fmtDate(series[0].date)} to ${fmtDate(series[n - 1].date)}`}
      >
        <defs>
          <linearGradient id="an-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#4f46e5" stopOpacity="0.16" />
            <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines + y labels */}
        {grid.map((g) => {
          const gy = MT + plotH - (g / 4) * plotH;
          return (
            <g key={g}>
              <line x1={ML} y1={gy} x2={ML + plotW} y2={gy} style={{ stroke: 'var(--divider)' }} strokeWidth="1" />
              <text
                x={ML - 8}
                y={gy + 3.5}
                textAnchor="end"
                style={{ fill: 'var(--muted2)', fontSize: '11px' }}
                className="tnum"
              >
                {fmtCompact((yMax * g) / 4)}
              </text>
            </g>
          );
        })}

        {/* x labels */}
        {series.map((p, i) => (
          <text
            key={p.date}
            x={x(i)}
            y={H - 10}
            textAnchor="middle"
            style={{ fill: 'var(--muted)', fontSize: '11px' }}
            className="tnum"
          >
            {fmtDate(p.date)}
          </text>
        ))}

        {/* hover guide */}
        {hover != null && (
          <line
            x1={x(hover)}
            y1={MT}
            x2={x(hover)}
            y2={baseY}
            style={{ stroke: 'var(--border2)' }}
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        )}

        {/* area under sent */}
        {sentVisible && <path d={areaPath} fill="url(#an-area)" stroke="none" />}

        {/* series lines */}
        {active.map((s) => (
          <polyline
            key={s.key}
            points={series.map((p, i) => `${x(i)},${y(p[s.key])}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {/* dots */}
        {active.map((s) =>
          series.map((p, i) => (
            <circle
              key={`${s.key}-${i}`}
              cx={x(i)}
              cy={y(p[s.key])}
              r={hover === i ? 4 : 2.5}
              fill={s.color}
              stroke={hover === i ? 'var(--surface)' : 'none'}
              strokeWidth={hover === i ? 2 : 0}
            />
          )),
        )}

        {/* hit areas */}
        {series.map((p, i) => {
          const left = Math.max(ML, x(i) - step / 2);
          const right = Math.min(ML + plotW, x(i) + step / 2);
          return (
            <rect
              key={`hit-${p.date}`}
              x={left}
              y={MT}
              width={right - left}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          );
        })}
      </svg>

      {hover != null && (
        <div
          className="an__tip"
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform: hover <= 1 ? 'translateX(4px)' : hover >= n - 2 ? 'translateX(-100%) translateX(-4px)' : 'translateX(-50%)',
          }}
        >
          <div className="an__tip-date">{fmtDate(series[hover].date)}</div>
          {active.map((s) => (
            <div key={s.key} className="an__tip-row">
              <span className="an__tip-sw" style={{ background: s.color }} />
              <span className="an__tip-lbl">{s.label}</span>
              <span className="an__tip-val tnum">{series[hover][s.key].toLocaleString('en-US')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
