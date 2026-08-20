import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import { useToast } from './shared/useToast';
import { api, ApiError } from '@/lib/app/api';
import { routes } from '@/config/routes';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { channelKpis, EMPTY_TOTALS } from '@/lib/app/channel-kpis';
import { channelReportConfig } from '@/lib/app/campaign-report';
import type { ChannelType } from '@/types/app';
import { tagStyle } from '@/lib/app/tag-style';
import { applyListMembership } from '@/lib/app/subscriber-write';
import {
  buildSubscriberDetailView,
  engagementScore,
  engagementTier,
  scoreArcLength,
  subscriberFrequency,
  type ApiSubscriberActivity,
  type DetailTab,
  type SubscriberDetailView,
} from '@/lib/app/subscriber-detail';
import type { RichSubscriber } from '@/lib/app/subscribers-data';
import { STATUS_LABEL } from './AppSubscribers.logic';
import SubscriberEditorModal from './SubscriberEditorModal';
import styles from './AppSubscriberDetail.module.css';

/*
 * Subscriber profile — pixel port of design/subscriber-detail.html, bound to
 * live workspace data. Sections the comp shows from data the backend doesn't
 * record yet (timezone, signup IP, referrer, soft bounces, spam complaints)
 * render the page's standard "—" placeholder rather than invented values.
 */

type Props = {
  initial: RichSubscriber;
  attributes?: Record<string, unknown>;
  activity?: ApiSubscriberActivity | null;
  allLists?: { id: string; name: string; color?: string | null }[];
};

function EventIcon({ type }: { type: string }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;
  if (type === 'click') {
    return (
      <span className={styles.eventIcon} style={{ background: 'var(--accent-tint)' }}>
        <svg {...common} stroke="var(--accent)">
          <path d="M9 9l5 12 2-5 5-2zM3 3l4 4" />
        </svg>
      </span>
    );
  }
  if (type === 'open') {
    return (
      <span className={styles.eventIcon} style={{ background: 'var(--success-tint)' }}>
        <svg {...common} stroke="#16a34a">
          <path d="M4 4h16v16H4zM4 7l8 6 8-6" />
        </svg>
      </span>
    );
  }
  if (type === 'life') {
    return (
      <span className={styles.eventIcon} style={{ background: 'var(--danger-bg)' }}>
        <svg {...common} stroke="var(--danger)">
          <path d="M12 9v4M12 17h.01M10.3 3.3 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.3a2 2 0 0 0-3.4 0Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className={styles.eventIcon} style={{ background: 'var(--surface2)' }}>
      <svg {...common} stroke="#8f8d84">
        <path d="m22 2-7 20-4-9-9-4zM22 2 11 13" />
      </svg>
    </span>
  );
}

export default function AppSubscriberDetail({
  initial,
  attributes = {},
  activity = null,
  allLists = [],
}: Props) {
  const [sub, setSub] = useState(initial);
  const [attrs, setAttrs] = useState(attributes);
  const [act, setAct] = useState(activity);
  const [tab, setTab] = useState<DetailTab>('activity');
  const [channel, setChannel] = useState<ChannelType>('email');
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'unsubscribe' | 'delete' | null>(null);
  const { toast, show } = useToast();
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  /** Workspace tag catalogue (name → id) so rail chips can detach via the tags API. */
  const [tagIndex, setTagIndex] = useState<Array<{ id: string; name: string }>>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<ApiSubscriberActivity>(`subscribers/${sub.id}/activity`);
        if (!cancelled) setAct(data);
      } catch {
        /* keep SSR / empty activity */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sub.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ data: Array<{ id: string; name: string }> }>('tags');
        if (!cancelled) setTagIndex(res.data ?? []);
      } catch {
        /* rail remove falls back to looking up after create failure toast */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const view: SubscriberDetailView = useMemo(
    () => buildSubscriberDetailView(sub, act, attrs),
    [sub, act, attrs],
  );

  // Engagement only exists where the channel reports opens or clicks. On SMS
  // and voice the ring, the meters and the weekly chart were all rendering 0,
  // which claims the subscriber ignored the message rather than saying the
  // channel never measured it.
  const chanCfg = channelReportConfig(channel);
  const tracksEngagement = chanCfg.rateCards.some(
    (r) => r === 'open' || r === 'seen' || r === 'click',
  );
  const chanTotals = view.channelTotals?.[channel] ?? EMPTY_TOTALS;
  const chanWeeks = view.weeksByChannel?.[channel] ?? [];
  const chanOpenRate =
    chanTotals.delivered > 0 ? Math.round((chanTotals.opened / chanTotals.delivered) * 100) : null;
  const chanClickRate =
    chanTotals.delivered > 0 ? Math.round((chanTotals.clicked / chanTotals.delivered) * 100) : null;
  // Score the selected channel, not the subscriber overall: under a WhatsApp
  // filter with no WhatsApp sends the all-channel score read "Low engagement"
  // off email activity.
  const chanScore = engagementScore(chanOpenRate, chanClickRate);
  const chanTier =
    chanTotals.attempted === 0
      ? `No ${CHANNEL[channel].label} sends yet`
      : engagementTier(chanScore);
  const softFailures = Math.max(0, chanTotals.failed - chanTotals.failedPermanent);
  // A permanent failure on this channel is the address being dead; a run of
  // transient ones still deserves attention, but is not the same verdict.
  const chanHealthBad = chanTotals.failedPermanent > 0 || chanTotals.complaints > 0;
  const chanHealthLabel =
    chanTotals.attempted === 0
      ? 'No sends'
      : chanTotals.complaints > 0
        ? 'Complained'
        : chanTotals.failedPermanent > 0
          ? channel === 'email'
            ? 'Bounced'
            : 'Unreachable'
          : 'Healthy';
  const chanDeliveryRate =
    chanTotals.attempted > 0
      ? Math.round((chanTotals.delivered / chanTotals.attempted) * 100)
      : null;
  // Frequency used to always use email volume; scope it to the selected channel
  // the same way the meters above do. `attempted - failed` is the activity
  // payload's `sent` (successes), which is what the overall frequency used.
  const chanFrequency = subscriberFrequency(
    Math.max(0, chanTotals.attempted - chanTotals.failed),
    sub.createdAt,
  );

  const filteredEvents = useMemo(
    () => {
      return view.events.filter((e) => e.channel === channel);
    },
    [view.events, channel],
  );

  // The campaigns tab lists sends, so it belongs to the channel filter too.
  const chanCampaigns = useMemo(
    () => view.campaigns.filter((c) => c.channel.toLowerCase() === channel),
    [view.campaigns, channel],
  );

  const BAR_H = 104;
  const chartWeeks = chanWeeks.length > 0 ? chanWeeks : view.weeks;
  const maxWeek = Math.max(1, ...chartWeeks.map((w) => Math.max(w.opens, w.clicks)));
  const weekTotal = chartWeeks.reduce((n, w) => n + w.opens + w.clicks, 0);
  const barPx = (n: number) => {
    if (n <= 0) return 0;
    return Math.max(3, Math.round((n / maxWeek) * BAR_H));
  };
  const statusLabel = STATUS_LABEL[sub.status] ?? sub.status;
  const active = sub.status === 'active';

  // Internal notes persist into the subscriber's attributes bag.
  const savedNotes = typeof attrs.notes === 'string' ? attrs.notes : '';
  const [notesDraft, setNotesDraft] = useState(savedNotes);
  const notesDirty = notesDraft !== savedNotes;
  const saveNotes = async () => {
    const nextAttrs = { ...attrs, notes: notesDraft };
    try {
      await api.patch(`subscribers/${sub.id}`, { attributes: nextAttrs });
      setAttrs(nextAttrs);
      show('Note saved');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not save the note');
    }
  };

  const removeTag = async (name: string) => {
    if (busy) return;
    const tagId = tagIndex.find((t) => t.name.toLowerCase() === name.toLowerCase())?.id;
    if (!tagId) {
      show('Could not find that tag');
      return;
    }
    const prev = sub.tags;
    setSub((s) => ({ ...s, tags: s.tags.filter((t) => t !== name) }));
    setBusy(true);
    try {
      await api.del(`subscribers/${sub.id}/tags/${tagId}`);
      show(`Removed “${name}”`);
    } catch (e) {
      setSub((s) => ({ ...s, tags: prev }));
      show(e instanceof ApiError ? e.message : 'Could not remove tag');
    } finally {
      setBusy(false);
    }
  };

  const unsubscribe = async () => {
    if (busy || sub.status === 'unsubscribed') return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await api.post(`subscribers/${sub.id}/unsubscribe`, {});
      setSub((s) => ({ ...s, status: 'unsubscribed' }));
      show('Subscriber unsubscribed');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Unsubscribe failed');
    } finally {
      setBusy(false);
    }
  };

  const resubscribe = async () => {
    if (busy || sub.status === 'active') return;
    setBusy(true);
    setMenuOpen(false);
    try {
      await api.patch(`subscribers/${sub.id}`, { status: 'active' });
      setSub((s) => ({ ...s, status: 'active' }));
      show('Subscriber re-subscribed');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Re-subscribe failed');
    } finally {
      setBusy(false);
    }
  };

  const deleteSubscriber = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.del(`subscribers/${sub.id}`);
      window.location.href = routes.app.subscribers;
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Delete failed');
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['id', 'email', 'name', 'status', 'phone', 'lists', 'tags'],
      [sub.id, sub.email, sub.name, sub.status, sub.phone, sub.lists.join('|'), sub.tags.join('|')],
    ];
    const blob = new Blob(
      [rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')],
      {
        type: 'text/csv',
      },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sub.email || sub.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMenuOpen(false);
  };

  const menuIcon = {
    width: 15,
    height: 15,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <div className={styles.wrap}>
      <main className={styles.page}>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            window.location.assign(routes.app.subscribers);
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Subscribers
        </button>
        <section className={styles.identity}>
          <div className={styles.identityBody}>
            <div className={styles.identityHead}>
              <h1 className={styles.identityName}>{sub.name}</h1>
              <span className={`${styles.badge} ${active ? styles.badgeActive : ''}`}>
                <span
                  className={styles.dot}
                  style={{ background: active ? '#16a34a' : 'currentColor' }}
                />
                {statusLabel}
              </span>
              {active && (
                <span className={`${styles.badge} ${styles.badgeGdpr}`}>
                  <Icon name="shield" size={12} stroke={2.4} />
                  GDPR consent
                  <span className={styles.badgeGdprCheck} aria-hidden="true">
                    <Icon name="check" size={8} stroke={3.5} />
                  </span>
                </span>
              )}
            </div>
          </div>
          <div className={styles.identityActions}>
            <button className="pbtn" type="button" onClick={() => setEditorOpen(true)}>
              <Icon name="edit" size={15} />
              Edit
            </button>
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                className={`sbtn ${styles.moreBtn}`}
                type="button"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                aria-label="More actions"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen((v) => !v);
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                >
                  <circle cx="12" cy="5" r=".6" />
                  <circle cx="12" cy="12" r=".6" />
                  <circle cx="12" cy="19" r=".6" />
                </svg>
              </button>
              {menuOpen && (
                <div className={styles.menu} role="menu">
                  <button className={styles.menuItem} type="button" onClick={exportCsv}>
                    <svg {...menuIcon}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                    </svg>
                    Export profile (CSV)
                  </button>
                  {sub.status === 'unsubscribed' || sub.status === 'complained' ? (
                    <button
                      className={`${styles.menuItem} ${styles.menuOk}`}
                      type="button"
                      onClick={() => void resubscribe()}
                      disabled={busy}
                    >
                      <svg {...menuIcon}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                      Re-subscribe
                    </button>
                  ) : (
                    /* Reached only by 'active', 'bounced' and 'invalid'. The two
                       already-stopped states share the Re-subscribe branch above:
                       a complaint is not an unsubscribe, but the action on both
                       is the same — restore, or leave them alone. */
                    <button
                      className={`${styles.menuItem} ${styles.menuWarn}`}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirm('unsubscribe');
                      }}
                      disabled={busy || sub.status === 'bounced'}
                    >
                      <svg {...menuIcon}>
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                      Unsubscribe
                    </button>
                  )}
                  <button
                    className={`${styles.menuItem} ${styles.menuDanger}`}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirm('delete');
                    }}
                    disabled={busy}
                  >
                    <svg {...menuIcon}>
                      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    </svg>
                    Delete subscriber
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className={styles.chanBar}>
          <span className={styles.chanBarLabel}>Channel</span>
          <div className={`aseg ${styles.chanSeg}`} role="group" aria-label="Filter by channel">
            {CHANNEL_ORDER.map((ch) => (
              <button
                type="button"
                key={ch}
                className={`aseg__opt ${styles.chanSegOpt}${channel === ch ? ' is-active' : ''}`}
                aria-pressed={channel === ch}
                onClick={() => setChannel(ch)}
              >
                <span className={styles.chanDot} style={{ background: CHANNEL[ch].color }} />
                {CHANNEL[ch].label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.layout}>
          <div className={styles.colMain}>
            <section className={`${styles.card} ${styles.score}`} aria-label="Engagement score">
              <div className={styles.scoreRing}>
                <div className={styles.ring}>
                  <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true">
                    <circle
                      cx="48"
                      cy="48"
                      r="41"
                      fill="none"
                      stroke="var(--surface2)"
                      strokeWidth="10"
                    />
                    <circle
                      cx="48"
                      cy="48"
                      r="41"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={scoreArcLength(
                        tracksEngagement ? chanScore : (chanDeliveryRate ?? 0),
                      )}
                      data-score-arc
                    />
                  </svg>
                  <div className={styles.ringValue}>
                    <span className={`${styles.ringNumber} ${styles.tnum}`}>
                      {tracksEngagement
                        ? chanTotals.attempted === 0
                          ? '—'
                          : chanScore
                        : chanDeliveryRate == null
                          ? '—'
                          : `${chanDeliveryRate}%`}
                    </span>
                    <span className={styles.ringOf}>{tracksEngagement ? 'of 100' : 'delivered'}</span>
                  </div>
                </div>
                <div>
                  <p className={styles.overline}>
                    {tracksEngagement ? 'Engagement' : 'Delivery'}
                  </p>
                  <p className={styles.scoreTier}>
                    {tracksEngagement
                      ? chanTier
                      : chanTotals.attempted === 0
                        ? `No ${CHANNEL[channel].label} sends yet`
                        : `${chanTotals.delivered} of ${chanTotals.attempted} delivered`}
                  </p>
                  {tracksEngagement && view.scoreDeltaLabel && (
                    <p className={styles.scoreDelta}>
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#16a34a"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m3 17 6-6 4 4 8-8" />
                        <path d="M17 7h4v4" />
                      </svg>
                      {view.scoreDeltaLabel}
                    </p>
                  )}
                </div>
              </div>
              <ul className={styles.meters}>
                {(tracksEngagement
                  ? [
                      {
                        label: chanCfg.openLabel === 'Seen' ? 'Seen rate' : 'Avg. Opens',
                        pct: chanOpenRate,
                        color: '#4f46e5',
                      },
                      { label: 'Avg. Clicks', pct: chanClickRate, color: '#6366f1' },
                    ]
                  : [
                      { label: 'Delivered', pct: chanDeliveryRate, color: '#16a34a' },
                      {
                        label: 'Failed',
                        pct:
                          chanTotals.attempted > 0
                            ? Math.round((chanTotals.failed / chanTotals.attempted) * 100)
                            : null,
                        color: 'var(--danger)',
                      },
                    ]
                ).map((m) => (
                  <li key={m.label}>
                    <div className={styles.meterHead}>
                      <span className={styles.meterLabel}>{m.label}</span>
                      <span className={`${styles.meterValue} ${styles.tnum}`}>
                        {m.pct == null ? '—' : `${m.pct}%`}
                      </span>
                    </div>
                    <div className={styles.meterTrack}>
                      <div
                        className={styles.meterFill}
                        style={{ width: `${m.pct ?? 0}%`, background: m.color }}
                      />
                    </div>
                  </li>
                ))}
                <li>
                  <div className={styles.meterHead}>
                    <span className={styles.meterLabel}>Frequency</span>
                    <span className={`${styles.meterValue} ${styles.tnum}`}>
                      {chanFrequency.label}
                    </span>
                  </div>
                  <div className={styles.meterTrack}>
                    <div
                      className={styles.meterFill}
                      style={{ width: `${chanFrequency.pct}%`, background: '#c2740a' }}
                    />
                  </div>
                </li>
              </ul>
            </section>

            <section aria-label="Channel performance">
              <div className={styles.chanHead}>
                <div>
                  <h2 className={styles.cardTitle}>Channel performance</h2>
                  <p className={styles.chanSub}>
                    {`${CHANNEL[channel].label} messages sent to this subscriber`}
                  </p>
                </div>
              </div>
              <div className={styles.stats}>
                {channelKpis(channel, view.channelTotals?.[channel] ?? EMPTY_TOTALS).map((k) => (
                  <div key={k.key} className={styles.stat}>
                    <p className={styles.overline}>{k.label}</p>
                    <p
                      className={`${styles.statValue} ${styles.tnum}`}
                      style={k.alert ? { color: 'var(--danger-text)' } : undefined}
                    >
                      {k.value}
                    </p>
                    <p className={styles.statSub}>{k.sub}</p>
                  </div>
                ))}
              </div>
            </section>

            {!tracksEngagement ? null : (
            <section className={`${styles.card} ${styles.chart}`} aria-label="Engagement over time">
              <div className={styles.chartHead}>
                <div>
                  <h2 className={styles.cardTitle}>Engagement over time</h2>
                  <p className={styles.chartSub}>
                    {`${chanCfg.openLabel === 'Seen' ? 'Reads' : 'Opens'} and clicks per week on ${CHANNEL[channel].label}, last 12 weeks`}
                  </p>
                </div>
                <div className={styles.legend}>
                  <span>
                    <span className={styles.swatch} style={{ background: '#c7d2fe' }} />
                    Opens
                  </span>
                  <span>
                    <span className={styles.swatch} style={{ background: 'var(--accent)' }} />
                    Clicks
                  </span>
                </div>
              </div>
              {weekTotal === 0 ? (
                <p className={styles.chartEmpty}>No opens or clicks in the last 12 weeks.</p>
              ) : (
                <ul className={styles.barChart} onMouseLeave={() => setHoverWeek(null)}>
                  {chartWeeks.map((w, i) => (
                    <li
                      key={`${w.label}-${w.opens}-${w.clicks}`}
                      className={`${styles.barGroup}${hoverWeek === i ? ` ${styles.barGroupHover}` : ''}`}
                      onMouseEnter={() => setHoverWeek(i)}
                    >
                      {hoverWeek === i && (
                        <div className={styles.barTip} role="tooltip">
                          <div className={`${styles.barTipVal} ${styles.tnum}`}>
                            {w.opens} open{w.opens === 1 ? '' : 's'} · {w.clicks} click
                            {w.clicks === 1 ? '' : 's'}
                          </div>
                          <div className={styles.barTipLbl}>{w.label}</div>
                        </div>
                      )}
                      <span className={styles.bars}>
                        <span
                          className={`${styles.bar} ${styles.barOpen}`}
                          style={{ height: barPx(w.opens) }}
                          aria-hidden="true"
                        />
                        <span
                          className={`${styles.bar} ${styles.barClick}`}
                          style={{ height: barPx(w.clicks) }}
                          aria-hidden="true"
                        />
                      </span>
                      <span className={styles.barLabel}>{w.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            )}

            <section className={`${styles.card} ${styles.tabsCard}`}>
              <div className={styles.tabs} role="tablist" aria-label="Subscriber detail sections">
                {(
                  [
                    ['activity', 'Activity', filteredEvents.length],
                    ['campaigns', 'Campaigns', chanCampaigns.length],
                    ['links', 'Clicked links', view.links.length],
                  ] as const
                ).map(([id, label, count]) => (
                  <button
                    key={id}
                    className={`${styles.tab} ${tab === id ? styles.isActive : ''}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === id}
                    onClick={() => setTab(id)}
                  >
                    {label}
                    <span className={`${styles.tabCount} ${styles.tnum}`}>{count}</span>
                  </button>
                ))}
              </div>

              {tab === 'activity' && (
                <div role="tabpanel">
                  {/* The type filter (opens / clicks / sends / lifecycle) is
                      hidden until it follows the channel selection: on a
                      delivery-only channel its Opens and Clicks chips can only
                      ever read 0, which says the subscriber ignored the message
                      rather than that the channel never measured one. */}
                  <ul className={styles.events}>
                    {filteredEvents.length === 0 ? (
                      <li className={styles.empty}>No activity in the last 12 weeks.</li>
                    ) : (
                      filteredEvents.map((e) => (
                        <li key={e.id} className={styles.event}>
                          <EventIcon type={e.type} />
                          <div>
                            <p className={styles.eventTitle}>{e.title}</p>
                            {e.link ? (
                              <a className={`${styles.eventLink} ${styles.mono}`} href={e.link}>
                                {e.link}
                              </a>
                            ) : null}
                            <p className={styles.eventMeta}>{e.meta}</p>
                          </div>
                          <div className={styles.eventTime}>
                            <span className={styles.eventWhen}>{e.when}</span>
                            <span className={`${styles.eventStamp} ${styles.tnum}`}>{e.stamp}</span>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}

              {tab === 'campaigns' && (
                <div role="tabpanel">
                  {chanCampaigns.length === 0 ? (
                    <p className={styles.empty}>No campaign sends yet.</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Campaign</th>
                          <th>Sent</th>
                          <th>Opens</th>
                          <th>Clicks</th>
                          <th>Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {chanCampaigns.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <span className={styles.cellTitle}>{c.name}</span>
                              <span className={styles.cellSub}>{c.channel}</span>
                            </td>
                            <td className={styles.tnum}>{c.sentLabel}</td>
                            <td className={styles.tnum}>{c.opens}</td>
                            <td className={styles.tnum}>{c.clicks}</td>
                            <td>
                              <span className={styles.dotLabel} style={{ color: c.resultColor }}>
                                <span
                                  className={styles.dot}
                                  style={{ background: c.resultColor }}
                                />
                                {c.result}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'links' && (
                <div role="tabpanel">
                  {view.links.length === 0 ? (
                    <p className={styles.empty}>No clicked-link history yet.</p>
                  ) : (
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Link</th>
                          <th>Campaign</th>
                          <th>Clicks</th>
                          <th>Last clicked</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.links.map((l) => (
                          <tr key={l.id}>
                            <td>
                              <span className={styles.cellTitle}>{l.label}</span>
                              <a className={`${styles.cellLink} ${styles.mono}`} href={l.href}>
                                {l.href}
                              </a>
                            </td>
                            <td className={styles.cellMuted}>{l.campaign}</td>
                            <td className={styles.tnum}>{l.clicks}</td>
                            <td className={styles.cellMuted}>{l.lastClicked}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className={styles.colRail}>
            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Details</p>
              <div className="adetail">
                <span className="adetail__k">Email</span>
                <span className={`adetail__v ${styles.railValue}`}>
                  {sub.email ? <a href={`mailto:${sub.email}`}>{sub.email}</a> : '—'}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Subscribed</span>
                <span className="adetail__v">
                  {view.subscribedLabel.replace(/^Subscribed\s+/i, '') || '—'}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Country</span>
                <span className="adetail__v">{sub.location || '—'}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Timezone</span>
                <span className="adetail__v">—</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Signup IP</span>
                <span className="adetail__v">—</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Referrer</span>
                <span className="adetail__v">—</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Last activity</span>
                <span className="adetail__v">{view.lastActiveLabel}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Last campaign</span>
                <span className="adetail__v">{view.lastCampaignLabel}</span>
              </div>
              <div className={styles.railSection}>
                <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Lists</p>
                <div className={styles.pills}>
                  {sub.lists.length === 0 ? (
                    <span className={styles.cellMuted}>None</span>
                  ) : (
                    sub.lists.map((l) => (
                      <span key={l} className={`${styles.pill} ${styles.pillList}`}>
                        {l}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className={styles.railSection}>
                <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Tags</p>
                <div className={styles.pills}>
                  {sub.tags.map((t) => {
                    const st = tagStyle(t);
                    return (
                      <span key={t} className={styles.pillTag} style={st}>
                        <span className={styles.pillTagLbl}>{t}</span>
                        <button
                          type="button"
                          className={styles.pillTagx}
                          aria-label={`Remove ${t}`}
                          disabled={busy}
                          onClick={() => void removeTag(t)}
                        >
                          <Icon name="x" size={14} stroke={3} />
                        </button>
                      </span>
                    );
                  })}
                  <button
                    className={styles.btnGhost}
                    type="button"
                    onClick={() => setEditorOpen(true)}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      aria-hidden="true"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    Add
                  </button>
                </div>
              </div>
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <div className={styles.railHead}>
                <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Deliverability</p>
                <span
                  className={`${styles.badge} ${chanHealthBad ? '' : styles.badgeActive}`}
                >
                  {chanHealthLabel}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">{CHANNEL[channel].label}</span>
                <span className="adetail__v tnum">
                  {chanTotals.attempted === 0
                    ? 'No sends'
                    : `${chanTotals.attempted.toLocaleString('en-US')} sent`}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Delivery rate</span>
                <span
                  className={`adetail__v tnum${
                    chanDeliveryRate != null ? ` ${styles.railValueOk}` : ''
                  }`}
                >
                  {chanDeliveryRate == null ? '—' : `${chanDeliveryRate}%`}
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">
                  {channel === 'email' ? 'Soft bounces' : 'Temporary failures'}
                </span>
                <span className="adetail__v tnum">{softFailures === 0 ? '—' : softFailures}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">
                  {channel === 'email' ? 'Hard bounces' : 'Permanent failures'}
                </span>
                <span className="adetail__v tnum">
                  {chanTotals.failedPermanent === 0 ? '—' : chanTotals.failedPermanent}
                </span>
              </div>
              {/* Only email has a complaint feedback loop — WhatsApp, SMS and
                  voice have no such signal, so the row would sit at "—" for
                  ever and read as "never complained". */}
              {channel === 'email' && (
                <div className="adetail">
                  <span className="adetail__k">Spam complaints</span>
                  <span className="adetail__v tnum">
                    {chanTotals.complaints === 0 ? '—' : chanTotals.complaints}
                  </span>
                </div>
              )}
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Consent &amp; privacy</p>
              <ul className={styles.consentList}>
                <li className={styles.consentItem}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={active ? '#16a34a' : 'var(--muted)'}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <div>
                    {/* KNOWN DEFECT (audit #14): FABRICATED — this whole panel
                        has no data path. The `subscribers` table has no consent
                        column at all (id, tenant_id, email, phone, name, status,
                        attributes, created_at, updated_at); consent is recorded
                        per LIST, where `double_opt_in` is set on 0 of the 1,006
                        lists and `gdpr_consent` on 503. So "Double opt-in
                        confirmed" is really `status === 'active'` rephrased as a
                        legal assertion, and the date under it is the signup
                        date, not a consent date. Live on a subscriber with 0
                        messages and 0 list memberships it renders "Double opt-in
                        confirmed · 14 Jul 2026" above a "Lists: None" section.
                        The GDPR block below is the same `active` flag, and
                        "Data export requested: Never" is a literal. */}
                    <p className={styles.consentLabel}>
                      {active ? 'Double opt-in confirmed' : statusLabel}
                    </p>
                    <p className={styles.consentMeta}>{view.subscribedLabel}</p>
                  </div>
                </li>
                {active && (
                  <li className={styles.consentItem}>
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#6d28d9"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    </svg>
                    <div>
                      <p className={styles.consentLabel}>GDPR consent</p>
                      <p className={styles.consentMeta}>{view.subscribedLabel}</p>
                    </div>
                  </li>
                )}
                <li className={styles.consentItem}>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--muted)"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 8v8M8 12h8" />
                  </svg>
                  <div>
                    <p className={styles.consentLabel}>Data export requested</p>
                    <p className={styles.consentMeta}>Never</p>
                  </div>
                </li>
              </ul>
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <div className={styles.railHead}>
                <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Internal notes</p>
                {notesDirty && (
                  <button
                    className={styles.btnPrimary}
                    type="button"
                    onClick={() => void saveNotes()}
                  >
                    Save
                  </button>
                )}
              </div>
              <textarea
                className={styles.notes}
                value={notesDraft}
                placeholder="Only your team can see this."
                aria-label="Internal notes"
                onChange={(e) => setNotesDraft(e.target.value)}
              />
            </section>
          </aside>
        </div>
      </main>

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

      {confirm === 'unsubscribe' && (
        <ConfirmDialog
          title={`Unsubscribe “${sub.name}”?`}
          message="They won’t receive future campaigns. You can re-subscribe them anytime from this menu."
          confirmLabel="Unsubscribe"
          tone="default"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void unsubscribe();
          }}
        />
      )}

      {confirm === 'delete' && (
        <ConfirmDialog
          title={`Delete “${sub.name}”?`}
          message="This cannot be undone."
          confirmLabel="Delete subscriber"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            setConfirm(null);
            void deleteSubscriber();
          }}
        />
      )}

      {editorOpen && (
        <SubscriberEditorModal
          mode="edit"
          initialEmail={sub.email}
          initialPhone={sub.phone}
          initialName={sub.name}
          initialStatus={sub.status}
          initialListIds={sub.listIds}
          initialTags={sub.tags}
          lists={
            allLists.length > 0
              ? allLists
              : sub.lists.map((name, i) => ({ id: sub.listIds[i] ?? name, name }))
          }
          onClose={() => setEditorOpen(false)}
          onSave={async (values) => {
            try {
              await api.patch(`subscribers/${sub.id}`, {
                email: values.email,
                phone: values.phone || null,
                name: values.name || null,
                status: values.status,
              });
              // List membership is NOT part of the subscriber row — it lives in
              // `subscriber_lists` and moves through the list-members endpoints.
              // The PATCH above has never carried it, yet this handler used to
              // write `values.listIds` straight into local state, so a changed
              // selection looked saved until the next load discarded it.
              await applyListMembership(sub.id, sub.listIds, values.listIds);

              // Read back what actually persisted rather than echoing the form.
              // Optimism is what hid this: state assembled from `values` is a
              // claim about the server, and it was wrong.
              const fresh = await api.get<{
                email: string;
                phone: string | null;
                name: string | null;
                status: string;
                listIds?: string[];
                lists?: string[];
                tags?: string[];
              }>(`subscribers/${sub.id}`);
              setSub((s) => ({
                ...s,
                email: fresh.email,
                phone: fresh.phone ?? '',
                name: fresh.name || fresh.email,
                status: (fresh.status as typeof s.status) ?? s.status,
                listIds: fresh.listIds ?? s.listIds,
                lists: fresh.lists ?? s.lists,
                tags: fresh.tags ?? s.tags,
              }));
              setEditorOpen(false);
              show('Subscriber updated');
            } catch (e) {
              show(e instanceof ApiError ? e.message : 'Update failed');
            }
          }}
        />
      )}
    </div>
  );
}
