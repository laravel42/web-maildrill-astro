import { useEffect, useRef, useState } from 'react';
import type { Campaign, ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import { toCampaigns, type ApiCampaign } from '@/lib/app/campaign-map';
import {
  readDashboardCache,
  writeDashboardCache,
  type DashboardCache,
} from '@/lib/app/dashboard-cache';
import { RANGES, type ChannelBreakdown } from './AppAnalytics.logic';
import type { FeedItem } from './AppDashboard.types';
import Icon from './Icon';
import { CHANNEL } from './shared/channels';
import { agoNow } from './shared/time';
import { channelReportConfig } from '@/lib/app/campaign-report';
import {
  buildGetStarted,
  buildKpis,
  buildRecent,
  campaignSentAt,
  feedHref,
  FEED_META,
  isStepDone,
  KPI_META,
  QUICK_ACTIONS,
  rangeSubtitle,
  type ActivityPoint,
  type Summary,
} from './AppDashboard.logic';
import Sparkline from './shared/Sparkline';
import styles from './AppDashboard.module.css';

export default function AppDashboard({
  greeting = 'Hello',
  live = false,
  tenantId = null,
}: {
  greeting?: string;
  /** When true, fetch aggregates from the BFF (no SSR data blocking). */
  live?: boolean;
  /** Active workspace — scopes the aggregate cache to it. */
  tenantId?: string | null;
} = {}) {
  const [range, setRange] = useState('7d');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [daily, setDaily] = useState<ActivityPoint[]>([]);
  const [channels, setChannels] = useState<ChannelBreakdown[]>([]);
  const [activity, setActivity] = useState<FeedItem[]>([]);
  const [bootLoading, setBootLoading] = useState(live);
  const [rangeLoading, setRangeLoading] = useState(false);
  const days = RANGES.find((r) => r.key === range)?.days ?? 7;
  const activityRef = useRef<HTMLDivElement>(null);
  const [activityEdge, setActivityEdge] = useState({ top: false, bottom: false });
  const bootedRef = useRef(false);

  /* Boot: serve a fresh 30‑min cache immediately, otherwise fetch aggregates. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const fetchDays = Math.min(days * 2, 365);
    const cached = readDashboardCache(tenantId);
    const cachedDaily = cached?.activityByDays[String(fetchDays)];
    const cachedChannels = cached?.channelsByDays[String(days)];

    if (cached) {
      if (cached.summary) setSummary(cached.summary);
      if (cached.campaigns) setCampaigns(cached.campaigns);
      if (cached.feed) setActivity(cached.feed);
      if (cachedDaily) setDaily(cachedDaily);
      if (cachedChannels) setChannels(cachedChannels);
      if (
        cached.summary &&
        cached.campaigns &&
        cached.feed &&
        cachedDaily &&
        cachedChannels
      ) {
        bootedRef.current = true;
        setBootLoading(false);
        return;
      }
    }

    setBootLoading(true);

    // Each slice is cached only once its own request lands, so one failure
    // (a throttled stats query, say) can't freeze the others behind a
    // half-empty entry until the TTL runs out.
    const fetched: Partial<DashboardCache> = {};

    void Promise.all([
      cached?.summary
        ? Promise.resolve()
        : api
            .get<Summary>('stats/summary')
            .then((s) => {
              fetched.summary = s;
              if (!cancelled) setSummary(s);
            })
            .catch(() => {}),
      cached?.campaigns
        ? Promise.resolve()
        : api
            .get<{ data: ApiCampaign[] }>('campaigns')
            .then((res) => {
              fetched.campaigns = toCampaigns(res.data ?? []);
              if (!cancelled) setCampaigns(fetched.campaigns);
            })
            .catch(() => {}),
      cachedDaily
        ? Promise.resolve()
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?days=${fetchDays}`)
            .then((act) => {
              fetched.activityByDays = { [String(fetchDays)]: act.data ?? [] };
              if (!cancelled) setDaily(act.data ?? []);
            })
            .catch(() => {}),
      cachedChannels
        ? Promise.resolve()
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${days}`)
            .then((ch) => {
              fetched.channelsByDays = { [String(days)]: ch.data ?? [] };
              if (!cancelled) setChannels(ch.data ?? []);
            })
            .catch(() => {}),
      cached?.feed
        ? Promise.resolve()
        : api
            .get<{ data: FeedItem[] }>('stats/feed')
            .then((feed) => {
              fetched.feed = feed.data ?? [];
              if (!cancelled) setActivity(fetched.feed);
            })
            .catch(() => {}),
    ]).finally(() => {
      if (cancelled) return;
      if (Object.keys(fetched).length > 0) writeDashboardCache(tenantId, fetched);
      bootedRef.current = true;
      setBootLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [live]);

  /* Range changes: use cache per window, otherwise refetch activity + channels. */
  useEffect(() => {
    if (!live || !bootedRef.current) return;
    const fetchDays = Math.min(days * 2, 365);
    const cached = readDashboardCache(tenantId);
    const hitDaily = cached?.activityByDays[String(fetchDays)];
    const hitChannels = cached?.channelsByDays[String(days)];
    if (hitDaily && hitChannels) {
      setDaily(hitDaily);
      setChannels(hitChannels);
      return;
    }

    let cancelled = false;
    setRangeLoading(true);

    // Same rule as boot: a window is only cached once its request succeeds,
    // so a failed range never sticks as an empty chart for the whole TTL.
    const fetched: Partial<DashboardCache> = {};

    void Promise.all([
      hitDaily
        ? Promise.resolve(hitDaily)
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?days=${fetchDays}`)
            .then((act) => {
              const points = act.data ?? [];
              fetched.activityByDays = { [String(fetchDays)]: points };
              return points;
            })
            .catch(() => [] as ActivityPoint[]),
      hitChannels
        ? Promise.resolve(hitChannels)
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${days}`)
            .then((ch) => {
              const rows = ch.data ?? [];
              fetched.channelsByDays = { [String(days)]: rows };
              return rows;
            })
            .catch(() => [] as ChannelBreakdown[]),
    ])
      .then(([act, ch]) => {
        if (cancelled) return;
        setDaily(act);
        setChannels(ch);
        if (Object.keys(fetched).length > 0) writeDashboardCache(tenantId, fetched);
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, days, live]);

  const syncActivityEdge = () => {
    const el = activityRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    setActivityEdge({
      top: scrollTop > 4,
      bottom: scrollTop + clientHeight < scrollHeight - 4,
    });
  };

  useEffect(() => {
    syncActivityEdge();
  }, [activity]);

  const busy = bootLoading || rangeLoading;
  const channelTotal = channels.reduce((t, c) => t + c.sent, 0);
  const kpis = buildKpis(summary, daily, days, channels);
  const recent = buildRecent(campaigns);
  const getStarted = buildGetStarted(summary);

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <div className={styles.greet}>
        <div>
          <h1 className="screen__h1">{greeting} 👋</h1>
          <p className="screen__sub">{rangeSubtitle(days)}</p>
        </div>
        <div className={styles.greetRight}>
          <div className={`aseg ${styles.seg}`} role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button
                type="button"
                key={r.key}
                className={`aseg__opt${range === r.key ? ' is-active' : ''}`}
                aria-pressed={range === r.key}
                onClick={() => setRange(r.key)}
                disabled={bootLoading}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.kpis} aria-busy={busy}>
        {kpis.map((k) => {
          const meta = KPI_META[k.key];
          if (busy) {
            return (
              <div key={k.key} className={`akpi ${styles.boxLoading}`}>
                <div className={styles.kpiHead}>
                  <div className="akpi__label">{k.label}</div>
                </div>
                <div className={`skeleton ${styles.skelValue}`} aria-hidden="true" />
                <div className={`skeleton ${styles.skelDelta}`} aria-hidden="true" />
                <span className="sr-only">Loading</span>
              </div>
            );
          }
          const href =
            meta.href === '/dashboard/analytics' ? `${meta.href}?range=${range}` : meta.href;
          return (
            <a key={k.key} href={href} className={`akpi ${styles.kpiLink}`}>
              <div className={styles.kpiHead}>
                <div className="akpi__label">{k.label}</div>
                <Icon name="arrow-up-right" size={13} className={styles.kpiGo} />
              </div>
              <div className={styles.kpiMid}>
                <div className="akpi__value tnum">{k.value}</div>
                {k.spark.length >= 2 && (
                  <span className={styles.kpiSpark} style={{ color: meta.color }}>
                    <Sparkline
                      series={k.spark}
                      color="currentColor"
                      format={k.sparkFormat}
                      height={26}
                    />
                  </span>
                )}
              </div>
              <div className={styles.kpiFoot}>
                <span className={`akpi__delta akpi__delta--${k.tone} tnum`}>{k.delta}</span>
                {k.context && <span className={styles.kpiCtx}>{k.context}</span>}
              </div>
            </a>
          );
        })}
      </div>

      <div className={styles.row}>
        <div
          className={`acrd${bootLoading ? ` ${styles.boxLoading}` : ''}`}
          style={{ overflow: 'hidden' }}
          aria-busy={bootLoading}
        >
          <div className="acrd__head">
            <h2 className="acrd__title">Recent campaigns</h2>
            <a href="/dashboard/campaigns" className="acrd__link">
              View all
            </a>
          </div>
          <div className={styles.ctHead}>
            <span>Campaign</span>
            <span>Recipients</span>
            <span>Open / Seen</span>
            <span>Sent</span>
          </div>
          {bootLoading ? (
            <div aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className={styles.ctRow}>
                  <div className={`skeleton ${styles.skelLine}`} style={{ width: '70%' }} />
                  <div className={`skeleton ${styles.skelLineSm}`} />
                  <div className={`skeleton ${styles.skelLineSm}`} />
                  <div className={`skeleton ${styles.skelLineSm}`} />
                </div>
              ))}
            </div>
          ) : (
            <>
              {recent.length === 0 && (
                <p className={styles.cardEmpty}>
                  Sent campaigns show up here once a send finishes.
                </p>
              )}
              {recent.map((c) => {
                const cfg = channelReportConfig(c.channel);
                const tracksOpen = cfg.rateCards.some((r) => r === 'open' || r === 'seen');
                return (
                  <a
                    key={c.id}
                    href={`/dashboard/campaigns?open=${encodeURIComponent(c.id)}`}
                    className={styles.ctRow}
                  >
                    <span className={styles.ctName}>{c.name}</span>
                    <span className={`tnum ${styles.muted3}`}>
                      {c.recipients.toLocaleString('en-US')}
                    </span>
                    <span
                      className={`tnum ${styles.muted3}`}
                      title={tracksOpen ? cfg.openLabel : 'Not tracked on this channel'}
                    >
                      {tracksOpen && c.openRate != null
                        ? `${Math.round(c.openRate * 100)}%`
                        : '—'}
                    </span>
                    <span className={styles.muted}>{agoNow(campaignSentAt(c))}</span>
                  </a>
                );
              })}
            </>
          )}
        </div>

        <div
          className={`acrd ${styles.activityCard}${bootLoading ? ` ${styles.boxLoading}` : ''}`}
          aria-busy={bootLoading}
        >
          <div className="acrd__head">
            <h2 className="acrd__title">Recent activity</h2>
          </div>
          {bootLoading ? (
            <div className={styles.activity} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={styles.act}>
                  <span className={`skeleton ${styles.skelIc}`} />
                  <div style={{ flex: 1 }}>
                    <div className={`skeleton ${styles.skelLine}`} style={{ width: '80%' }} />
                    <div
                      className={`skeleton ${styles.skelLineSm}`}
                      style={{ marginTop: 6, width: '40%' }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : activity.length === 0 ? (
            <p className={styles.cardEmpty}>
              Workspace activity lands here as things happen — sends, sign-ups, and unsubscribes.
            </p>
          ) : (
            <div
              className={[
                styles.activityWrap,
                activityEdge.top ? styles.activityFadeTop : '',
                activityEdge.bottom ? styles.activityFadeBottom : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                ref={activityRef}
                className={styles.activity}
                onScroll={syncActivityEdge}
                tabIndex={0}
                role="region"
                aria-label="Recent activity"
              >
                {activity.map((a, i) => {
                  const meta = FEED_META[a.type];
                  return (
                    <a
                      key={`${a.type}-${a.at}-${i}`}
                      href={feedHref(a)}
                      className={`${styles.act} ${styles.actLink}`}
                    >
                      <span
                        className={styles.actIc}
                        style={{ background: meta.bg, color: meta.color }}
                      >
                        <Icon name={meta.icon} size={15} />
                      </span>
                      <div>
                        <div className={styles.actText}>{a.title}</div>
                        <div className={styles.actTime}>{agoNow(a.at)}</div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={`acrd ${styles.perf}${busy ? ` ${styles.boxLoading}` : ''}`} aria-busy={busy}>
        <div className={styles.perfHead}>
          <h2 className="acrd__title">
            Performance by channel
            <span className={styles.perfRange}>
              {' '}
              · {RANGES.find((r) => r.key === range)?.label ?? '7 days'}
            </span>
          </h2>
          <a href={`/dashboard/analytics?range=${range}`} className="acrd__link">
            View analytics
          </a>
        </div>
        {busy ? (
          <div className={styles.perfList} aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={styles.perfRow}>
                <span className={`skeleton ${styles.skelIc}`} />
                <div className={styles.perfLabel}>
                  <div className={`skeleton ${styles.skelLine}`} />
                  <div className={`skeleton ${styles.skelLineSm}`} />
                </div>
                <div className={styles.perfBar}>
                  <div className={`skeleton ${styles.skelBar}`} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {channelTotal === 0 && (
              <p className={styles.cardEmpty} style={{ padding: 0 }}>
                Per-channel volume appears once your campaigns start sending.
              </p>
            )}
            <div className={styles.perfList}>
              {channels
                .filter((p) => p.sent > 0)
                .map((p) => {
                  const meta = CHANNEL[(p.channel as ChannelType) ?? 'email'] ?? CHANNEL.email;
                  const share = channelTotal > 0 ? (p.sent / channelTotal) * 100 : 0;
                  return (
                    <a
                      key={p.channel}
                      href={`/dashboard/analytics?channel=${p.channel}&range=${range}`}
                      className={`${styles.perfRow} ${styles.perfLink}`}
                      aria-label={`${meta.label} analytics`}
                    >
                      <span
                        className={styles.perfIc}
                        style={{ background: meta.tint, color: meta.color }}
                      >
                        <Icon name={meta.icon} size={14} />
                      </span>
                      <div className={styles.perfLabel}>
                        <div className={styles.perfName}>{meta.label}</div>
                        <div className={`tnum ${styles.perfSent}`}>
                          {p.sent.toLocaleString('en-US')} sent
                        </div>
                      </div>
                      <div className={styles.perfBar}>
                        <div className={`tnum ${styles.perfBarlabels}`}>
                          <span>{p.delivered.toLocaleString('en-US')} delivered</span>
                          <span>
                            {p.failed.toLocaleString('en-US')} failed · {share.toFixed(0)}% of
                            volume
                          </span>
                        </div>
                        <div className="abar">
                          <div
                            className="abar__fill"
                            style={{
                              width: `${Math.max(share, 2)}%`,
                              background: meta.color,
                              animation: 'grow .5s ease',
                            }}
                          />
                        </div>
                      </div>
                    </a>
                  );
                })}
            </div>
          </>
        )}
      </div>

      <div className={styles.row} style={{ marginBottom: 0 }}>
        <div className={`acrd ${styles.quick}`}>
          <h2 className="acrd__title" style={{ marginBottom: 13 }}>
            Quick actions
          </h2>
          <div className={styles.qaGrid}>
            {QUICK_ACTIONS.map((a) => (
              <a
                key={a.label}
                href={a.href === '/dashboard/analytics' ? `${a.href}?range=${range}` : a.href}
                className={styles.qaTile}
              >
                <span className={styles.qaIc} style={{ background: a.tint, color: a.color }}>
                  <Icon name={a.icon} size={15} />
                </span>
                <span className={styles.qaText}>
                  <span className={styles.qaLabel}>{a.label}</span>
                  <span className={styles.qaDesc}>{a.desc}</span>
                </span>
              </a>
            ))}
          </div>
        </div>

        <div
          className={`acrd ${styles.start}${bootLoading ? ` ${styles.boxLoading}` : ''}`}
          aria-busy={bootLoading}
        >
          <h2 className="acrd__title" style={{ marginBottom: 13 }}>
            Get started
          </h2>
          {bootLoading
            ? [0, 1, 2].map((i) => (
                <div key={i} className={styles.startItem} style={{ background: 'var(--surface2)' }}>
                  <span className={`skeleton ${styles.skelIc}`} style={{ width: 19, height: 19 }} />
                  <div className={`skeleton ${styles.skelLine}`} style={{ width: '60%' }} />
                </div>
              ))
            : getStarted.map((g) => (
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
