import { useEffect, useRef, useState } from 'react';
import type { Campaign, ChannelType } from '@/types/app';
import { api } from '@/lib/app/api';
import { toCampaigns, type ApiCampaign } from '@/lib/app/campaign-map';
import {
  readDashboardCache,
  writeDashboardCache,
} from '@/lib/app/dashboard-cache';
import { RANGES, type ChannelBreakdown } from './AppAnalytics.logic';
import type { FeedItem } from './AppDashboard.types';
import Icon from './Icon';
import { CHANNEL } from './shared/channels';
import { agoNow } from './shared/time';
import {
  buildGetStarted,
  buildKpis,
  buildRecent,
  buildSpark,
  campaignSentAt,
  FEED_META,
  isStepDone,
  rangeSubtitle,
  sparkTitle,
  type ActivityPoint,
  type Summary,
} from './AppDashboard.logic';
import styles from './AppDashboard.module.css';

export default function AppDashboard({
  greeting = 'Hello',
  live = false,
}: {
  greeting?: string;
  /** When true, fetch aggregates from the BFF (no SSR data blocking). */
  live?: boolean;
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
    const cached = readDashboardCache();
    const cachedDaily = cached?.activityByDays[String(fetchDays)];
    const cachedChannels = cached?.channelsByDays[String(days)];

    if (cached) {
      setSummary(cached.summary);
      setCampaigns(cached.campaigns);
      setActivity(cached.feed);
      if (cachedDaily) setDaily(cachedDaily);
      if (cachedChannels) setChannels(cachedChannels);
      if (cachedDaily && cachedChannels) {
        bootedRef.current = true;
        setBootLoading(false);
        return;
      }
    }

    setBootLoading(true);

    let nextSummary = cached?.summary ?? null;
    let nextCampaigns = cached?.campaigns ?? [];
    let nextFeed = cached?.feed ?? [];
    let nextDaily = cachedDaily ?? [];
    let nextChannels = cachedChannels ?? [];

    void Promise.all([
      cached
        ? Promise.resolve()
        : api
            .get<Summary>('stats/summary')
            .then((s) => {
              nextSummary = s;
              if (!cancelled) setSummary(s);
            })
            .catch(() => {}),
      cached
        ? Promise.resolve()
        : api
            .get<{ data: ApiCampaign[] }>('campaigns')
            .then((res) => {
              nextCampaigns = toCampaigns(res.data ?? []);
              if (!cancelled) setCampaigns(nextCampaigns);
            })
            .catch(() => {}),
      cachedDaily
        ? Promise.resolve()
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?days=${fetchDays}`)
            .then((act) => {
              nextDaily = act.data ?? [];
              if (!cancelled) setDaily(nextDaily);
            })
            .catch(() => {}),
      cachedChannels
        ? Promise.resolve()
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${days}`)
            .then((ch) => {
              nextChannels = ch.data ?? [];
              if (!cancelled) setChannels(nextChannels);
            })
            .catch(() => {}),
      cached
        ? Promise.resolve()
        : api
            .get<{ data: FeedItem[] }>('stats/feed')
            .then((feed) => {
              nextFeed = feed.data ?? [];
              if (!cancelled) setActivity(nextFeed);
            })
            .catch(() => {}),
    ]).finally(() => {
      if (cancelled) return;
      writeDashboardCache({
        summary: nextSummary,
        campaigns: nextCampaigns,
        feed: nextFeed,
        activityByDays: { [String(fetchDays)]: nextDaily },
        channelsByDays: { [String(days)]: nextChannels },
      });
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
    const cached = readDashboardCache();
    const hitDaily = cached?.activityByDays[String(fetchDays)];
    const hitChannels = cached?.channelsByDays[String(days)];
    if (hitDaily && hitChannels) {
      setDaily(hitDaily);
      setChannels(hitChannels);
      return;
    }

    let cancelled = false;
    setRangeLoading(true);

    void Promise.all([
      hitDaily
        ? Promise.resolve(hitDaily)
        : api
            .get<{ data: ActivityPoint[] }>(`stats/activity?days=${fetchDays}`)
            .then((act) => act.data ?? [])
            .catch(() => [] as ActivityPoint[]),
      hitChannels
        ? Promise.resolve(hitChannels)
        : api
            .get<{ data: ChannelBreakdown[] }>(`stats/channels?days=${days}`)
            .then((ch) => ch.data ?? [])
            .catch(() => [] as ChannelBreakdown[]),
    ])
      .then(([act, ch]) => {
        if (cancelled) return;
        setDaily(act);
        setChannels(ch);
        writeDashboardCache({
          activityByDays: { [String(fetchDays)]: act },
          channelsByDays: { [String(days)]: ch },
        });
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
  const inRange = daily.slice(-days);
  const kpis = buildKpis(summary, daily, days);
  const recent = buildRecent(campaigns);
  const getStarted = buildGetStarted(summary);
  const spark = buildSpark(inRange);
  const sentInWindow = inRange.reduce((t, d) => t + d.sent, 0);

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
        {kpis.map((k) => (
          <div key={k.label} className={`akpi${busy ? ` ${styles.boxLoading}` : ''}`}>
            <div className="akpi__label">{k.label}</div>
            {busy ? (
              <>
                <div className={`skeleton ${styles.skelValue}`} aria-hidden="true" />
                <div className={`skeleton ${styles.skelDelta}`} aria-hidden="true" />
                <span className="sr-only">Loading</span>
              </>
            ) : (
              <>
                <div className="akpi__value tnum">{k.value}</div>
                <div className={`akpi__delta akpi__delta--${k.tone} tnum`}>{k.delta}</div>
              </>
            )}
          </div>
        ))}
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
            <span>Open</span>
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
              {recent.map((c) => (
                <a key={c.id} href="/dashboard/campaigns" className={styles.ctRow}>
                  <span className={styles.ctName}>{c.name}</span>
                  <span className={`tnum ${styles.muted3}`}>
                    {c.recipients.toLocaleString('en-US')}
                  </span>
                  <span className={`tnum ${styles.muted3}`}>
                    {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
                  </span>
                  <span className={styles.muted}>{agoNow(campaignSentAt(c))}</span>
                </a>
              ))}
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
                    <div key={`${a.type}-${a.at}-${i}`} className={styles.act}>
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
                    </div>
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
          <a href="/dashboard/analytics" className="acrd__link">
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
                    <div key={p.channel} className={styles.perfRow}>
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
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>

      <div className={styles.row} style={{ marginBottom: 0 }}>
        <div
          className={`acrd ${styles.spark}${busy ? ` ${styles.boxLoading}` : ''}`}
          aria-busy={busy}
        >
          <div className={styles.perfHead}>
            <h2 className="acrd__title">{sparkTitle(days)}</h2>
          </div>
          {busy ? (
            <div className={styles.sparkBody} aria-hidden="true">
              <div className={styles.sparkStat}>
                <div className={styles.sparkLbl}>Messages sent</div>
                <div className={`skeleton ${styles.skelValue}`} />
              </div>
              <div className={`skeleton ${styles.skelChart}`} />
            </div>
          ) : (
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
          )}
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
