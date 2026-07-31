import { useEffect, useRef, useState } from 'react';
import type { ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import { readDashboardCache, writeDashboardCache } from '@/lib/app/dashboard-cache';
import Icon from './Icon';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import type { SeriesKey } from './AppAnalytics.types';
import {
  RANGES,
  SERIES,
  buildKpis,
  channelColor,
  channelLabelOf,
  fmtCompact,
  fmtDate,
  niceMax,
  pctOf,
  toCsv,
  totalsOf,
  type ActivityPoint,
  type ChannelBreakdown,
} from './AppAnalytics.logic';
import Sparkline, { ensureSpark } from './shared/Sparkline';
import styles from './AppAnalytics.module.css';

/* ------------------------------------------------------------------ *
 * Account-wide analytics screen (App.dc.html · isAnalytics).
 * Every chart is hand-built inline SVG / CSS — no chart library.
 * ------------------------------------------------------------------ */

export default function AppAnalytics({ live = false }: { live?: boolean } = {}) {
  const [range, setRange] = useState('30d');
  const [channel, setChannel] = useState<ChannelType | 'all'>('all');
  const [daily, setDaily] = useState<ActivityPoint[]>([]);
  const [byChannel, setByChannel] = useState<ChannelBreakdown[]>([]);
  const [bootLoading, setBootLoading] = useState(live);
  const [rangeLoading, setRangeLoading] = useState(false);
  const bootedRef = useRef(false);
  const [visible, setVisible] = useState<Set<SeriesKey>>(
    new Set<SeriesKey>(['sent', 'delivered', 'failed']),
  );
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  };

  const days = RANGES.find((r) => r.key === range)?.days ?? 30;
  /* Channel-filtered activity gets its own cache slot; the unfiltered window
     shares keys with the dashboard so either page warms the other. */
  const actKey = channel === 'all' ? String(days) : `${days}:${channel}`;

  /* Boot: honor ?channel= / ?range= deep links (dashboard performance rows),
     then serve a fresh 30-min cache immediately, otherwise fetch. */
  useEffect(() => {
    if (!live) return;
    const params = new URLSearchParams(window.location.search);
    const urlChannel = params.get('channel');
    const urlRange = params.get('range');
    const bootChannel: ChannelType | 'all' =
      urlChannel && (CHANNEL_ORDER as readonly string[]).includes(urlChannel)
        ? (urlChannel as ChannelType)
        : 'all';
    const bootRange = RANGES.some((r) => r.key === urlRange) ? urlRange! : '30d';
    if (bootChannel !== 'all') setChannel(bootChannel);
    if (bootRange !== '30d') setRange(bootRange);
    const bootDays = RANGES.find((r) => r.key === bootRange)?.days ?? 30;
    const bootKey = bootChannel === 'all' ? String(bootDays) : `${bootDays}:${bootChannel}`;

    let cancelled = false;
    const cached = readDashboardCache();
    const hitDaily = cached?.activityByDays[bootKey];
    const hitChannels = cached?.channelsByDays[String(bootDays)];
    if (hitDaily) setDaily(hitDaily);
    if (hitChannels) setByChannel(hitChannels);
    if (hitDaily && hitChannels) {
      bootedRef.current = true;
      setBootLoading(false);
      return;
    }

    setBootLoading(true);
    const qs = new URLSearchParams({ days: String(bootDays) });
    if (bootChannel !== 'all') qs.set('channel', bootChannel);
    let nextDaily = hitDaily ?? [];
    let nextChannels = hitChannels ?? [];
    let bootFailed = false;
    void Promise.all([
      hitDaily
        ? Promise.resolve()
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?${qs.toString()}`)
            .then((res) => {
              nextDaily = res.data ?? [];
              if (!cancelled) setDaily(nextDaily);
            })
            .catch(() => {
              bootFailed = true;
            }),
      hitChannels
        ? Promise.resolve()
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${bootDays}`)
            .then((res) => {
              nextChannels = res.data ?? [];
              if (!cancelled) setByChannel(nextChannels);
            })
            .catch(() => {
              bootFailed = true;
            }),
    ]).finally(() => {
      if (cancelled) return;
      writeDashboardCache({
        activityByDays: { [bootKey]: nextDaily },
        channelsByDays: { [String(bootDays)]: nextChannels },
      });
      bootedRef.current = true;
      setBootLoading(false);
      if (bootFailed) showToast('Could not load analytics');
    });
    return () => {
      cancelled = true;
    };
    // Boot resolves its filter from the URL itself, not from range/channel state.
  }, [live]);

  /* Keep the address bar in sync so filters are shareable / refresh-safe. */
  useEffect(() => {
    if (!live || !bootedRef.current) return;
    const url = new URL(window.location.href);
    if (channel === 'all') url.searchParams.delete('channel');
    else url.searchParams.set('channel', channel);
    if (range === '30d') url.searchParams.delete('range');
    else url.searchParams.set('range', range);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  }, [channel, range, live]);

  /* Range/channel changes: cache per window+filter, otherwise refetch. Both
     really refilter server-side — the chart reflects the selection rather
     than restyling the same data. */
  useEffect(() => {
    if (!live || !bootedRef.current) return;
    const cached = readDashboardCache();
    const hitDaily = cached?.activityByDays[actKey];
    const hitChannels = cached?.channelsByDays[String(days)];
    if (hitDaily && hitChannels) {
      setDaily(hitDaily);
      setByChannel(hitChannels);
      return;
    }

    let cancelled = false;
    setRangeLoading(true);
    const qs = new URLSearchParams({ days: String(days) });
    if (channel !== 'all') qs.set('channel', channel);
    void Promise.all([
      hitDaily
        ? Promise.resolve(hitDaily)
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?${qs.toString()}`)
            .then((res) => res.data ?? [])
            .catch(() => {
              showToast('Could not load analytics');
              return [] as ActivityPoint[];
            }),
      hitChannels
        ? Promise.resolve(hitChannels)
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${days}`)
            .then((res) => res.data ?? [])
            .catch(() => [] as ChannelBreakdown[]),
    ])
      .then(([act, ch]) => {
        if (cancelled) return;
        setDaily(act);
        setByChannel(ch);
        writeDashboardCache({
          activityByDays: { [actKey]: act },
          channelsByDays: { [String(days)]: ch },
        });
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, channel, days, live]);

  /* One flag drives every skeleton: boot AND any filter change that misses
     the cache repaint as shimmer rather than restyling stale numbers. */
  const loading = bootLoading || rangeLoading;

  const kpis = buildKpis(daily);
  const totals = totalsOf(daily);
  const channelRows =
    channel === 'all' ? byChannel : byChannel.filter((c) => c.channel === channel);
  const totalChannelSends = byChannel.reduce((t, c) => t + c.sent, 0);

  /* Engagement: provider receipts on the tracked channels (email + WhatsApp).
     SMS/voice can't produce opens or clicks, so they never join the denominator. */
  const trackedRows = channelRows.filter((c) => c.channel === 'email' || c.channel === 'whatsapp');
  const engDelivered = trackedRows.reduce((t, c) => t + c.delivered, 0);
  const engOpened = trackedRows.reduce((t, c) => t + (c.opened ?? 0), 0);
  const engClicked = trackedRows.reduce((t, c) => t + (c.clicked ?? 0), 0);
  const engUntrackedFilter = channel === 'sms' || channel === 'voice';

  /* Download exactly the series on screen, rather than claiming an export. */
  const exportCsv = () => {
    const blob = new Blob([toCsv(daily)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maildrill-activity-${range}${channel === 'all' ? '' : `-${channel}`}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(`Exported ${daily.length} days`);
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

  // The charts below assume a non-empty series (skeletons cover fetches, and
  // the empty branch renders inside the layout so the filters stay usable).
  const empty = !loading && daily.length === 0;

  return (
    <div className={`screen ${styles.an}`} style={{ animation: 'fade .3s ease' }}>
      {/* header + selectors */}
      <div className={`screen__head ${styles.head}`}>
        <div>
          <h1 className="screen__h1">Analytics</h1>
          <p className={`screen__sub ${styles.headSub}`}>
            {channel === 'all'
              ? 'Delivery across all channels.'
              : `${CHANNEL[channel].label} delivery.`}
          </p>
        </div>
        <div className={styles.controls}>
          <div className={`aseg ${styles.seg}`} role="group" aria-label="Filter by channel">
            <button
              type="button"
              className={`aseg__opt${channel === 'all' ? ' is-active' : ''}`}
              aria-pressed={channel === 'all'}
              onClick={() => setChannel('all')}
            >
              All channels
            </button>
            {CHANNEL_ORDER.map((ch) => (
              <button
                type="button"
                key={ch}
                className={`aseg__opt ${styles.segCh}${channel === ch ? ' is-active' : ''}`}
                aria-pressed={channel === ch}
                onClick={() => setChannel(ch)}
              >
                <span className={styles.segDot} style={{ background: CHANNEL[ch].color }} />
                {CHANNEL[ch].label}
              </button>
            ))}
          </div>
          <div className={`aseg ${styles.seg}`} role="group" aria-label="Date range">
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
          <button type="button" className="sbtn" onClick={exportCsv} disabled={loading || empty}>
            <Icon name="download" size={15} />
            Export
          </button>
        </div>
      </div>

      {empty ? (
        <div className={`acrd ${styles.empty}`}>
          <p className={styles.emptyTitle}>No delivery yet</p>
          <p className={styles.emptyBody}>
            {channel === 'all'
              ? 'Charts appear here once campaigns start sending in this range.'
              : `Nothing sent on ${CHANNEL[channel].label} in this range. Try another channel or wider range.`}
          </p>
        </div>
      ) : (
        <>
          {/* KPI trend strip */}
          <div className={styles.kpis} aria-busy={loading}>
            {loading &&
              [0, 1, 2].map((i) => (
                <div key={i} className={`acrd ${styles.kpi}`} aria-hidden="true">
                  <div className={styles.kpiTop}>
                    <div className={`skeleton ${styles.skelLine}`} />
                    <div className={`skeleton ${styles.skelLineSm}`} />
                  </div>
                  <div className={`skeleton ${styles.skelValue}`} />
                  <div className={`skeleton ${styles.skelSpark}`} />
                </div>
              ))}
            {!loading &&
              kpis.map((k, i) => {
                const color = SERIES[i]?.color ?? '#4f46e5';
                const last = k.series[k.series.length - 1]?.value ?? 0;
                const series = ensureSpark(k.series, last, 'Now');
                return (
                  <div key={k.label} className={`acrd ${styles.kpi}`}>
                    <div className={styles.kpiTop}>
                      <span className={styles.kpiLbl}>{k.label}</span>
                      <span
                        className={`${styles.kpiDelta} ${
                          k.tone === 'success'
                            ? styles.kpiDeltaUp
                            : k.tone === 'danger'
                              ? styles.kpiDeltaDown
                              : styles.kpiDeltaFlat
                        } tnum`}
                      >
                        {k.sub}
                      </span>
                    </div>
                    <div className={`${styles.kpiVal} tnum`}>{k.value}</div>
                    <Sparkline
                      className={styles.kpiSpark}
                      series={series}
                      color={color}
                      format="number"
                    />
                  </div>
                );
              })}
          </div>

          {/* hero trend chart */}
          <section
            className={`acrd ${styles.hero}`}
            aria-label="Delivery over time"
            aria-busy={loading}
          >
            <div className={styles.cardHead}>
              <div>
                <h2 className="acrd__title">Delivery over time</h2>
                {loading ? (
                  <div
                    className={`skeleton ${styles.skelLine}`}
                    style={{ width: 180, marginTop: 6 }}
                  />
                ) : (
                  <p className={`${styles.cardSub} tnum`}>
                    Daily volume · {fmtDate(daily[0].date)} –{' '}
                    {fmtDate(daily[daily.length - 1].date)}
                  </p>
                )}
              </div>
              <div className={styles.heroTotal}>
                {loading ? (
                  <div className={`skeleton ${styles.skelValue}`} />
                ) : (
                  <>
                    <span className={`${styles.heroNum} tnum`}>
                      {totals.sent.toLocaleString('en-US')}
                    </span>
                    <span className={styles.heroLbl}>messages sent</span>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className={`skeleton ${styles.skelHero}`} aria-hidden="true" />
            ) : (
              <>
                <div className={styles.legend}>
                  {SERIES.map((s) => {
                    const on = visible.has(s.key);
                    return (
                      <button
                        key={s.key}
                        type="button"
                        className={styles.leg}
                        aria-pressed={on}
                        onClick={() => toggleSeries(s.key)}
                      >
                        <span
                          className={styles.legSw}
                          style={{ background: on ? s.color : 'var(--muted2)' }}
                        />
                        {s.label}
                      </button>
                    );
                  })}
                </div>

                <TrendChart visible={visible} series={daily} />
              </>
            )}
          </section>

          {/* by channel — real send/delivery counts per channel */}
          <div className={`${styles.row} ${styles.row2}`}>
            <section className={`acrd ${styles.panel}`} aria-busy={loading}>
              <h2 className={styles.panelTitle}>By channel</h2>
              {loading ? (
                <div className={channel === 'all' ? styles.channelGrid : styles.channelStack}>
                  {(channel === 'all' ? [0, 1, 2, 3] : [0]).map((i) => (
                    <div key={i} className={styles.barRow} aria-hidden="true">
                      <div className={styles.barTop}>
                        <div className={`skeleton ${styles.skelLine}`} />
                        <div className={`skeleton ${styles.skelLineSm}`} />
                      </div>
                      <div className={`skeleton ${styles.skelBar}`} />
                    </div>
                  ))}
                </div>
              ) : channelRows.length === 0 ? (
                <p className={styles.panelEmpty}>Nothing sent on this channel yet.</p>
              ) : (
                <div className={channel === 'all' ? styles.channelGrid : styles.channelStack}>
                  {channelRows.map((c) => {
                    const share = totalChannelSends > 0 ? (c.sent / totalChannelSends) * 100 : 0;
                    const ch = c.channel as ChannelType;
                    const canFocus =
                      (CHANNEL_ORDER as readonly string[]).includes(c.channel) && channel === 'all';
                    return canFocus ? (
                      <button
                        key={c.channel}
                        type="button"
                        className={styles.barBtn}
                        onClick={() => setChannel(ch)}
                        aria-label={`Focus analytics on ${channelLabelOf(c.channel)}`}
                      >
                        <div className={styles.barTop}>
                          <span className={styles.barLbl}>{channelLabelOf(c.channel)}</span>
                          <span className={`${styles.barMeta} tnum`}>
                            {c.sent.toLocaleString('en-US')} · {share.toFixed(1)}%
                          </span>
                        </div>
                        <div className={styles.track}>
                          <div
                            className={styles.fill}
                            style={{
                              width: `${Math.max(share, 1.5)}%`,
                              background: channelColor(c.channel),
                            }}
                          />
                        </div>
                      </button>
                    ) : (
                      <div key={c.channel} className={styles.barRow}>
                        <div className={styles.barTop}>
                          <span className={styles.barLbl}>{channelLabelOf(c.channel)}</span>
                          <span className={`${styles.barMeta} tnum`}>
                            {c.sent.toLocaleString('en-US')} · {share.toFixed(1)}%
                          </span>
                        </div>
                        <div className={styles.track}>
                          <div
                            className={styles.fill}
                            style={{
                              width: `${Math.max(share, 1.5)}%`,
                              background: channelColor(c.channel),
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={`acrd ${styles.panel}`} aria-busy={loading}>
              <h2 className={styles.panelTitle}>Engagement</h2>
              {loading ? (
                [0, 1].map((i) => (
                  <div key={i} className={styles.barRow} aria-hidden="true">
                    <div className={styles.barTop}>
                      <div className={`skeleton ${styles.skelLine}`} />
                      <div className={`skeleton ${styles.skelLineSm}`} />
                    </div>
                    <div className={`skeleton ${styles.skelBar}`} />
                  </div>
                ))
              ) : engUntrackedFilter ? (
                <p className={styles.panelEmpty}>
                  {channel === 'sms' ? 'SMS' : 'Voice'} deliveries can't report opens or clicks —
                  engagement receipts exist only on email and WhatsApp.
                </p>
              ) : engDelivered === 0 ? (
                <p className={styles.panelEmpty}>
                  No tracked deliveries in this range yet. Opens and clicks appear here once email
                  or WhatsApp sends land.
                </p>
              ) : (
                (
                  [
                    { label: 'Opened', count: engOpened, color: 'var(--accent)' },
                    { label: 'Clicked', count: engClicked, color: 'var(--success)' },
                  ] as const
                ).map((m) => (
                  <div key={m.label} className={styles.barRow}>
                    <div className={styles.barTop}>
                      <span className={styles.barLbl}>{m.label}</span>
                      <span className={`${styles.barMeta} tnum`}>
                        {m.count.toLocaleString('en-US')} · {pctOf(m.count, engDelivered)}
                      </span>
                    </div>
                    <div className={styles.track}>
                      <div
                        className={styles.fill}
                        style={{
                          width: `${m.count > 0 ? Math.max((m.count / engDelivered) * 100, 1.5) : 0}%`,
                          background: m.color,
                        }}
                      />
                    </div>
                  </div>
                ))
              )}
            </section>
          </div>

          {/* channel performance table */}
          <section className={`acrd ${styles.table}`} aria-busy={loading}>
            <div className="acrd__head">
              <h2 className="acrd__title">Channel performance</h2>
              <span className={styles.tableSub}>
                {channel === 'all'
                  ? 'Delivery per channel'
                  : `Focused on ${CHANNEL[channel].label}`}
              </span>
            </div>
            <div className={styles.ct}>
              <div className={styles.ctInner}>
                <div className={styles.ctHead}>
                  <div>Channel</div>
                  <div className={styles.ctR}>Sent</div>
                  <div className={styles.ctR}>Delivered</div>
                  <div className={styles.ctR}>Failed</div>
                  <div>Delivery rate</div>
                </div>
                {loading &&
                  [0, 1, 2, 3].map((i) => (
                    <div key={i} className={styles.ctRow} aria-hidden="true">
                      <div className={styles.ctCh}>
                        <span className={`skeleton ${styles.skelIc}`} />
                        <div className={`skeleton ${styles.skelLine}`} />
                      </div>
                      <div
                        className={`skeleton ${styles.skelLineSm}`}
                        style={{ marginLeft: 'auto' }}
                      />
                      <div
                        className={`skeleton ${styles.skelLineSm}`}
                        style={{ marginLeft: 'auto' }}
                      />
                      <div
                        className={`skeleton ${styles.skelLineSm}`}
                        style={{ marginLeft: 'auto' }}
                      />
                      <div className={`skeleton ${styles.skelBar}`} style={{ marginTop: 0 }} />
                    </div>
                  ))}
                {!loading && channelRows.length === 0 && (
                  <p className={styles.tableEmpty}>No channel activity in this range.</p>
                )}
                {!loading &&
                  channelRows.map((row) => {
                    const ch = (row.channel as ChannelType) ?? 'email';
                    const m = CHANNEL[ch] ?? CHANNEL.email;
                    const rate = row.sent > 0 ? (row.delivered / row.sent) * 100 : 0;
                    return (
                      <div key={row.channel} className={styles.ctRow}>
                        <div className={styles.ctCh}>
                          <span
                            className={styles.ctChip}
                            style={{ background: m.tint, color: m.color }}
                          >
                            <Icon name={m.icon} size={14} />
                          </span>
                          <span className={styles.ctChname}>{m.label}</span>
                        </div>
                        <div className={`${styles.ctNum} tnum`}>
                          {row.sent.toLocaleString('en-US')}
                        </div>
                        <div className={`${styles.ctDel} tnum`}>
                          {row.delivered.toLocaleString('en-US')}
                        </div>
                        <div className={`${styles.ctNum} tnum`}>
                          {row.failed.toLocaleString('en-US')}
                        </div>
                        <div className={styles.ctRate}>
                          <div className={styles.ctMini}>
                            <div
                              className={styles.ctMiniFill}
                              style={{
                                width: `${rate}%`,
                                background: m.color,
                              }}
                            />
                          </div>
                          <span className={`${styles.ctRateVal} tnum`}>
                            {pctOf(row.delivered, row.sent)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>
        </>
      )}

      {toast && (
        <div
          className={styles.toast}
          role="status"
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
        >
          <span className={styles.toastIc}>
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Hand-built interactive line/area chart over `analyticsSeries`.
 * Legend (parent) toggles series; hovering a column reveals a tooltip.
 * Fixed 900×280 viewBox scales uniformly, so tooltip positions can be
 * expressed as simple percentages of the viewBox.
 * ------------------------------------------------------------------ */
function TrendChart({ visible, series }: { visible: Set<SeriesKey>; series: ActivityPoint[] }) {
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

  const n = series.length;
  const active = SERIES.filter((s) => visible.has(s.key));

  const maxVal = Math.max(1, ...active.flatMap((s) => series.map((p) => p[s.key])));
  const yMax = niceMax(maxVal);

  const x = (i: number) => ML + (i / (n - 1)) * plotW;
  const y = (v: number) => MT + plotH - (v / yMax) * plotH;

  const grid = [0, 1, 2, 3, 4];
  const step = plotW / (n - 1);

  /* Thin the day labels so they never collide: at most ~8 across the axis,
     with the final day always labeled (and the stepped label nearest to it
     dropped so the two can't touch). */
  const labelEvery = Math.max(1, Math.ceil(n / 8));
  const showLabel = (i: number) =>
    i === n - 1 || (i % labelEvery === 0 && n - 1 - i >= labelEvery / 2);

  const sentVisible = visible.has('sent');
  const areaPath = sentVisible
    ? `M ${x(0)},${y(series[0].sent)} ` +
      series.map((p, i) => `L ${x(i)},${y(p.sent)}`).join(' ') +
      ` L ${x(n - 1)},${baseY} L ${x(0)},${baseY} Z`
    : '';

  return (
    <div className={styles.chartwrap} onMouseLeave={() => setHover(null)}>
      <svg
        className={styles.chart}
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Daily delivery from ${fmtDate(series[0].date)} to ${fmtDate(series[n - 1].date)}`}
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
              <line
                x1={ML}
                y1={gy}
                x2={ML + plotW}
                y2={gy}
                style={{ stroke: 'var(--divider)' }}
                strokeWidth="1"
              />
              <text
                x={ML - 8}
                y={gy + 3.5}
                textAnchor="end"
                style={{ fill: 'var(--text4)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
                className="tnum"
              >
                {fmtCompact((yMax * g) / 4)}
              </text>
            </g>
          );
        })}

        {/* x labels — thinned; the last is end-anchored so it can't clip */}
        {series.map((p, i) =>
          showLabel(i) ? (
            <text
              key={p.date}
              x={x(i)}
              y={H - 10}
              textAnchor={i === n - 1 ? 'end' : 'middle'}
              style={{ fill: 'var(--text4)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}
              className="tnum"
            >
              {fmtDate(p.date)}
            </text>
          ) : null,
        )}

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
          className={styles.tip}
          style={{
            left: `${(x(hover) / W) * 100}%`,
            transform:
              hover <= 1
                ? 'translateX(4px)'
                : hover >= n - 2
                  ? 'translateX(-100%) translateX(-4px)'
                  : 'translateX(-50%)',
          }}
        >
          <div className={styles.tipDate}>{fmtDate(series[hover].date)}</div>
          {active.map((s) => (
            <div key={s.key} className={styles.tipRow}>
              <span className={styles.tipSw} style={{ background: s.color }} />
              <span className={styles.tipLbl}>{s.label}</span>
              <span className={`${styles.tipVal} tnum`}>
                {series[hover][s.key].toLocaleString('en-US')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
