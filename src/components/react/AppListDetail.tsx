import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import ListEditorModal from './ListEditorModal';
import SubscriberImportModal from './shared/SubscriberImportModal';
import { useToast } from './shared/useToast';
import ToastHost from './shared/ToastHost';
import { api, ApiError } from '@/lib/app/api';
import { routes } from '@/config/routes';
import type { ChannelType } from '@/types/app';
import type { ApiList } from '@/lib/app/list-map';
import type { ApiCampaign } from '@/lib/app/campaign-map';
import type { ApiSubscriber } from '@/lib/app/subscriber-map';
import type { CustomField } from '@/lib/app/custom-fields';
import { downloadCsv, exportFilename, subscribersCsv } from '@/lib/app/subscriber-export';
import {
  buildListDetailView,
  type ApiCustomFieldDef,
  type ApiListStats,
  type ApiSegment,
  type ListDetailView,
} from '@/lib/app/list-detail';
import { ChannelPill } from './shared/CampaignPills';
import { PAGE_SIZE, visiblePageNumbers } from './shared/pagination';
import { agoNow } from './shared/time';
import { CHANNEL_ORDER } from './shared/channels';
import styles from './AppListDetail.module.css';

/*
 * List detail — pixel port of design/list-detail.html, bound to live workspace
 * data. Sections the comp shows from data the backend doesn't record yet
 * (signup sources, imports, owner, sending domain, per-member last open /
 * source) render the standard "—" placeholder or an honest empty line rather
 * than invented values.
 */

/**
 * CSV export window, matching the Subscribers screen: `EXPORT_PAGE` is the
 * cursor endpoint's own ceiling and `EXPORT_MAX` the browser-memory guard.
 */
const EXPORT_PAGE = 100;
const EXPORT_MAX = 10_000;

type Props = {
  initial: ApiListStats;
  campaigns?: ApiCampaign[];
  fields?: ApiCustomFieldDef[];
  segments?: ApiSegment[];
  /** Workspace lists for the import picker; defaults to this list alone. */
  lists?: { id: string; name: string }[];
};

/** One row of the member roster, as `/v1/lists/:id/members` returns it. */
type RosterMember = {
  id: string;
  email: string;
  name: string | null;
  status: string;
  joinedAt: string | null;
  lastCampaignAt: string | null;
};

/* Avatar palette and status labels, restored with the roster. Deterministic
   from the id so a subscriber keeps the same colour between pages. */
const AV: Array<[string, string]> = [
  ['#eef0ff', '#4f46e5'],
  ['#e8f6ee', '#127a45'],
  ['#fdf3e3', '#c2740a'],
  ['#f3f0ff', '#6d28d9'],
  ['#e6f6fa', '#0e7490'],
];

function pickAv(id: string): [string, string] {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AV[h % AV.length] ?? AV[0]!;
}

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}

const ROSTER_STATUS: Record<string, string> = {
  active: 'Active',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  complained: 'Complained',
  invalid: 'Invalid',
};

export default function AppListDetail({
  initial,
  campaigns = [],
  fields = [],
  segments = [],
  lists,
}: Props) {
  const [list, setList] = useState(initial);

  /**
   * The member roster, one page at a time.
   *
   * This used to load the whole list — `members?limit=1000` on every page
   * view, ~86KB rendered — which is why it was removed. It is back because
   * "who is actually on this list" is a fair question to ask from the list,
   * but it reads a page rather than the membership: `offset` moves, the
   * request size does not, and nothing is fetched until the section is
   * reached.
   */
  const [roster, setRoster] = useState<RosterMember[]>([]);
  const [rosterPage, setRosterPage] = useState(1);
  const [rosterLoading, setRosterLoading] = useState(true);
  const [rosterFailed, setRosterFailed] = useState(false);
  /** What is typed, and what has actually been sent — debounced apart. */
  const [rosterQuery, setRosterQuery] = useState('');
  const [rosterNeedle, setRosterNeedle] = useState('');
  /** Matching members. Falls back to the list total until the first response. */
  const [rosterTotalMatched, setRosterTotalMatched] = useState<number | null>(null);

  // 300ms after typing stops. Firing per keystroke would issue a request and a
  // count per character against a 636-row membership for no better answer.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setRosterNeedle(rosterQuery.trim());
      setRosterPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [rosterQuery]);

  const rosterTotal = rosterTotalMatched ?? list.memberCount ?? 0;
  const rosterPageCount = Math.max(1, Math.ceil(rosterTotal / PAGE_SIZE));
  const rosterSafePage = Math.min(rosterPage, rosterPageCount);

  useEffect(() => {
    let cancelled = false;
    setRosterLoading(true);
    setRosterFailed(false);
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((rosterSafePage - 1) * PAGE_SIZE),
    });
    if (rosterNeedle) qs.set('q', rosterNeedle);
    api
      .get<{ data: RosterMember[]; total?: number }>(`lists/${list.id}/members?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setRoster(res.data ?? []);
        // The server counts the same predicate it paged, so the pager follows
        // the filter instead of the whole membership.
        setRosterTotalMatched(res.total ?? null);
      })
      .catch(() => {
        // An empty table with no explanation reads as "this list has nobody",
        // which is a different and much worse claim than "we could not load
        // it" — so the failure is stated rather than rendered as emptiness.
        if (!cancelled) setRosterFailed(true);
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [list.id, rosterSafePage, rosterNeedle]);
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  // "Public signup form" has no backing column yet — optimistic local only.
  const [publicForm, setPublicForm] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Copy');
  const [hoverWeek, setHoverWeek] = useState<number | null>(null);
  const { toast, show } = useToast();
  const menuRef = useRef<HTMLDivElement>(null);

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

  const view: ListDetailView = useMemo(
    () => buildListDetailView(list, campaigns, fields, segments),
    [list, campaigns, fields, segments],
  );

  /* Every counter on this page comes from one endpoint, so one re-read puts
     all of them back in agreement after a write — no field-by-field patching
     of a number the server derives. */
  const refreshStats = async () => {
    try {
      setList(await api.get<ApiListStats>(`lists/${list.id}/stats`));
    } catch {
      /* best-effort: the write itself succeeded, the page is just one stale read */
    }
  };

  const maxJoin = Math.max(1, ...view.weeks.map((w) => w.joins));
  const barPct = (n: number) => (n <= 0 ? 0 : Math.max(4, Math.round((n / maxJoin) * 96)));

  const desc = (list.notes ?? '').trim();

  const patchSetting = async (key: 'gdprConsent', next: boolean, label: string) => {
    const prev = list[key] ?? false;
    setList((l) => ({ ...l, [key]: next }));
    try {
      await api.patch(`lists/${list.id}`, { [key]: next });
      show(`${label} ${next ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setList((l) => ({ ...l, [key]: prev }));
      show(e instanceof ApiError ? e.message : 'Could not save changes');
    }
  };

  const deleteList = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.del(`lists/${list.id}`);
      window.location.href = routes.app.lists;
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not delete list');
      setBusy(false);
    }
  };

  /* Fetched when the button is pressed, and paged with cursors, rather than
     read out of a roster the page had already loaded. That roster was one
     `members?limit=1000` request, so on this workspace's 2,000-member lists
     "Export subscribers" wrote out half the list and said nothing. Same
     endpoint, filters and columns as the Subscribers screen's export, so the
     two files round-trip through the import mapper identically. */
  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    setMenuOpen(false);
    try {
      const all: ApiSubscriber[] = [];
      let cursor: string | null = null;
      for (let fetched = 0; fetched < EXPORT_MAX; fetched += EXPORT_PAGE) {
        const qs = new URLSearchParams({
          listId: list.id,
          limit: String(EXPORT_PAGE),
          sort: 'created',
          dir: 'desc',
        });
        if (cursor) qs.set('cursor', cursor);
        const res: { items?: ApiSubscriber[]; next_cursor: string | null } = await api.get(
          `subscribers?${qs}`,
        );
        all.push(...(res.items ?? []));
        cursor = res.next_cursor;
        if (!cursor) break;
      }
      const customFields = await api
        .get<{ data: CustomField[] }>('custom-fields')
        .then((r) => r.data)
        .catch(() => [] as CustomField[]);
      downloadCsv(exportFilename(list.name || list.id), subscribersCsv(all, customFields));
      show(`Exported ${all.length.toLocaleString('en-US')} subscribers`);
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not export subscribers');
    } finally {
      setExporting(false);
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(view.embedSnippet);
      setCopyLabel('Copied');
    } catch {
      setCopyLabel('Press ⌘C');
    }
    window.setTimeout(() => setCopyLabel('Copy'), 1400);
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

  const gdprOn = Boolean(list.gdprConsent);
  const listChannels = CHANNEL_ORDER.filter((ch) =>
    ((list.channels as ChannelType[] | undefined) ?? ['email']).includes(ch),
  );

  return (
    <div className={styles.wrap}>
      <main className={styles.page}>
        <button
          type="button"
          className={styles.back}
          onClick={() => {
            window.location.assign(routes.app.lists);
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
          Lists
        </button>
        <section className={styles.identity}>
          <div className={styles.identityMain}>
            <h1 className={styles.identityName}>
              {list.name}
              <span className={styles.identityChans}>
                {listChannels.map((ch) => (
                  <ChannelPill key={ch} channel={ch} />
                ))}
              </span>
            </h1>
            {desc ? <p className={styles.identityDesc}>{desc}</p> : null}
          </div>
          <div className={styles.identityAside}>
            <div className={styles.identityActions}>
              <button className="pbtn" type="button" onClick={() => setImportOpen(true)}>
                <Icon name="upload" size={15} />
                Import subscribers
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
                  <Icon name="more" size={16} stroke={2.4} />
                </button>
                {menuOpen && (
                  <div className={styles.menu} role="menu">
                    <button
                      className={styles.menuItem}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setEditorOpen(true);
                      }}
                    >
                      <svg {...menuIcon}>
                        <path d="M11 4h2M4 11v2M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z" />
                      </svg>
                      Edit list details
                    </button>
                    <button
                      className={styles.menuItem}
                      type="button"
                      disabled={exporting}
                      onClick={() => void exportCsv()}
                    >
                      <svg {...menuIcon}>
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                      </svg>
                      {exporting ? 'Exporting…' : 'Export subscribers (CSV)'}
                    </button>
                    <button
                      className={`${styles.menuItem} ${styles.menuDanger}`}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setConfirmDelete(true);
                      }}
                    >
                      <svg {...menuIcon}>
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      </svg>
                      Delete list
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className={styles.layout}>
          <div className={styles.colMain}>
            <section className={`${styles.card} ${styles.health}`} aria-label="List health">
              <div className={styles.healthTop}>
                <div>
                  <p className={styles.overline}>Recipients</p>
                  <div className={styles.healthCount}>
                    <span className={`${styles.healthTotal} ${styles.tnum}`}>
                      {view.total.toLocaleString('en-US')}
                    </span>
                    <span
                      className={styles.healthGrowth}
                      style={view.growthUp ? undefined : { color: 'var(--danger-text)' }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m3 17 6-6 4 4 8-8" />
                        <path d="M17 7h4v4" />
                      </svg>
                      {view.growthLabel}
                    </span>
                  </div>
                </div>
                <div className={styles.healthRight}>
                  <p className={styles.overline}>Deliverable</p>
                  <p className={`${styles.healthDeliverable} ${styles.tnum}`}>
                    {view.deliverableLabel}
                  </p>
                </div>
              </div>
              <div className={styles.healthBar}>
                {view.health.map((s) =>
                  s.pct > 0 ? (
                    <span
                      key={s.key}
                      className={styles.healthSeg}
                      style={{ width: `${s.pct}%`, background: s.color }}
                      title={`${s.label} · ${s.value.toLocaleString('en-US')}`}
                    />
                  ) : null,
                )}
              </div>
              <div className={styles.healthLegend}>
                {view.health.map((s) => (
                  <div key={s.key}>
                    <p className={styles.healthLabel}>
                      <span className={styles.swatch} style={{ background: s.color }} />
                      {s.label}
                    </p>
                    <p className={`${styles.healthValue} ${styles.tnum}`}>
                      {s.value.toLocaleString('en-US')}
                    </p>
                    <p className={`${styles.healthPct} ${styles.tnum}`}>{s.pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </section>

            <section className={`${styles.card} ${styles.chart}`} aria-label="List growth">
              <div className={styles.chartHead}>
                <div>
                  <h2 className={styles.cardTitle}>List growth</h2>
                  <p className={styles.chartSub}>Joins per week, last 12 weeks</p>
                </div>
                <div className={styles.legend}>
                  <span>
                    <span className={styles.swatch} style={{ background: 'var(--accent)' }} />
                    Joined
                  </span>
                </div>
              </div>
              <ul className={styles.barChart} onMouseLeave={() => setHoverWeek(null)}>
                {view.weeks.map((w, i) => (
                  <li
                    key={w.label}
                    className={`${styles.barGroup}${hoverWeek === i ? ` ${styles.barGroupHover}` : ''}`}
                    onMouseEnter={() => setHoverWeek(i)}
                  >
                    {hoverWeek === i && (
                      <div className={styles.barTip} role="tooltip">
                        <div className={`${styles.barTipVal} ${styles.tnum}`}>
                          +{w.joins} joined
                        </div>
                        <div className={styles.barTipLbl}>{w.label}</div>
                      </div>
                    )}
                    <span className={styles.bars}>
                      <span
                        className={`${styles.bar} ${styles.barJoin}`}
                        style={{ height: `${barPct(w.joins)}%` }}
                        aria-hidden="true"
                      />
                      <span
                        className={`${styles.bar} ${styles.barLeft}`}
                        style={{ height: `${w.left}%` }}
                        aria-hidden="true"
                      />
                    </span>
                    <span className={styles.barLabel}>{w.label}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* ---- MEMBER ROSTER ----
                Restored, but a page at a time. The version removed here loaded
                `members?limit=1000` on every view and rendered ~86KB; this asks
                for PAGE_SIZE rows at an offset, so the cost of the section does
                not grow with the size of the list. Deep filtering still belongs
                on the Subscribers screen, which has the server-side filters. */}
            <section className={`${styles.card} ${styles.tabsCard}`}>
              <div className={styles.rosterHead}>
                <h2 className={styles.cardTitle}>Subscribers</h2>
                <span className={styles.rosterCount}>
                  {rosterTotal.toLocaleString('en-US')}{' '}
                  {rosterNeedle
                    ? rosterTotal === 1
                      ? 'match'
                      : 'matches'
                    : rosterTotal === 1
                      ? 'member'
                      : 'members'}
                </span>
                {/* Searches the whole membership server-side, not the ten rows
                    on screen — the count beside the heading and the pager both
                    follow it, which is the difference between a filter and a
                    decoration. */}
                <div className={styles.rosterSearch}>
                  <Icon name="search" size={14} className={styles.rosterSearchIcon} />
                  <input
                    type="search"
                    className={styles.rosterInput}
                    placeholder="Search name or email…"
                    value={rosterQuery}
                    onChange={(e) => setRosterQuery(e.target.value)}
                    aria-label="Search this list's subscribers"
                  />
                </div>
              </div>

              {rosterFailed ? (
                <p className={styles.empty}>Could not load the members of this list.</p>
              ) : rosterLoading && roster.length === 0 ? (
                <p className={styles.empty}>Loading members…</p>
              ) : roster.length === 0 ? (
                <p className={styles.empty}>
                  {rosterNeedle
                    ? `No subscriber on this list matches “${rosterNeedle}”.`
                    : 'No subscribers on this list yet.'}
                </p>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Subscriber</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Last campaign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map((m) => {
                      const name = m.name || m.email;
                      const [avBg, avInk] = pickAv(m.id);
                      const go = () => {
                        window.location.href = routes.app.subscriber(m.id);
                      };
                      return (
                        <tr
                          key={m.id}
                          className={styles.person}
                          role="link"
                          tabIndex={0}
                          onClick={go}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              go();
                            }
                          }}
                        >
                          <td>
                            <div className={styles.personCell}>
                              <span
                                className={styles.personAvatar}
                                style={{ background: avBg, color: avInk }}
                              >
                                {initialsOf(name)}
                              </span>
                              <div className={styles.personId}>
                                <span className={styles.personName}>{name}</span>
                                <span className={styles.personEmail}>{m.email}</span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`astatus astatus--${m.status}`}>
                              <span
                                className={styles.dot}
                                style={{
                                  background: m.status === 'active' ? '#16a34a' : 'currentColor',
                                }}
                              />
                              {ROSTER_STATUS[m.status] ?? m.status}
                            </span>
                          </td>
                          <td className={styles.tnum}>{m.joinedAt ? agoNow(m.joinedAt) : '—'}</td>
                          <td className={styles.tnum}>
                            {m.lastCampaignAt ? agoNow(m.lastCampaignAt) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {rosterPageCount > 1 && (
                <div className={styles.rosterFoot}>
                  <span className={styles.rosterRange}>
                    {((rosterSafePage - 1) * PAGE_SIZE + 1).toLocaleString('en-US')}–
                    {Math.min(rosterSafePage * PAGE_SIZE, rosterTotal).toLocaleString('en-US')} of{' '}
                    {rosterTotal.toLocaleString('en-US')}
                  </span>
                  <div className={styles.pager}>
                  <button
                    type="button"
                    className={styles.pg}
                    disabled={rosterSafePage === 1}
                    onClick={() => setRosterPage((n) => Math.max(1, n - 1))}
                    aria-label="Previous page"
                  >
                    <Icon name="chevron-right" size={15} className={styles.pgflip} />
                  </button>
                  {visiblePageNumbers(rosterSafePage, rosterPageCount).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.pgn} tnum${n === rosterSafePage ? ' is-on' : ''}`}
                      aria-current={n === rosterSafePage ? 'page' : undefined}
                      onClick={() => setRosterPage(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={styles.pg}
                    disabled={rosterSafePage === rosterPageCount}
                    onClick={() => setRosterPage((n) => Math.min(rosterPageCount, n + 1))}
                    aria-label="Next page"
                    >
                      <Icon name="chevron-right" size={15} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <aside className={styles.colRail}>
            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Details</p>
              <div className="adetail">
                <span className="adetail__k">Created</span>
                <span className="adetail__v">{view.createdLabel}</span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Last campaign</span>
                <span className="adetail__v">{view.lastCampaignLabel}</span>
              </div>
              {/* Three percentages, two denominators. The first two divide by
                  MESSAGES attempted across every campaign that targeted this
                  list; the third divides by the ROSTER. Each one now carries
                  the whole it is a share of, and the third is labelled
                  "Unsubscribed" rather than "Unsubscribe rate" — it counts
                  members holding that status, not opt-outs from a send. See
                  the derivation note in lib/app/list-detail.ts. */}
              <div className="adetail">
                <span className="adetail__k">Delivery rate</span>
                <span className="adetail__v tnum">
                  {view.deliveredRate}
                  <span className={styles.railBasis}> {view.sendBasis}</span>
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Failed rate</span>
                <span className="adetail__v tnum">
                  {view.failedRate}
                  <span className={styles.railBasis}> {view.sendBasis}</span>
                </span>
              </div>
              <div className="adetail">
                <span className="adetail__k">Unsubscribed</span>
                <span className="adetail__v tnum">
                  {view.unsubRate}
                  <span className={styles.railBasis}> {view.rosterBasis}</span>
                </span>
              </div>
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Custom fields</p>
              {view.fields.length === 0 ? (
                <p className={styles.railEmpty}>No custom fields defined yet.</p>
              ) : (
                <ul className={styles.fieldList}>
                  {view.fields.map((f) => (
                    <li key={f.id} className={styles.fieldRow}>
                      <div className={styles.fieldMeta}>
                        <span className={styles.fieldLabel}>{f.label}</span>
                        <span className={`${styles.fieldKey} ${styles.mono}`}>
                          {f.key} · {f.typeLabel}
                        </span>
                      </div>
                      <div className={styles.fill}>
                        <div className={styles.fillTrack}>
                          {f.fillPct > 0 && (
                            <div
                              className={styles.fillBar}
                              style={{
                                width: `${f.fillPct}%`,
                                background: f.fillColor,
                              }}
                            />
                          )}
                        </div>
                        <span className={`${styles.tnum} ${styles.fieldFillPct}`}>
                          {f.fillPct}%
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={`${styles.card} ${styles.cardPad}`}>
              <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Settings</p>
              <ul className={styles.settings}>
                <li className={styles.settingRow}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>GDPR consent</p>
                    <p className={styles.stackDesc}>
                      Mark this list as requiring or recording GDPR consent.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${gdprOn ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={gdprOn}
                    aria-label="GDPR consent"
                    onClick={() => void patchSetting('gdprConsent', !gdprOn, 'GDPR consent')}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </li>
                <li className={styles.settingRow}>
                  <div className={styles.stackBody}>
                    <p className={styles.stackTitle}>Public signup form</p>
                    <p className={styles.stackDesc}>
                      Anyone with the hosted link or embed can join this list.
                    </p>
                  </div>
                  <button
                    className={`${styles.switch} ${publicForm ? styles.isOn : ''}`}
                    type="button"
                    role="switch"
                    aria-checked={publicForm}
                    aria-label="Public signup form"
                    onClick={() => setPublicForm((v) => !v)}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </li>
              </ul>
            </section>

            {publicForm && (
              <section className={`${styles.card} ${styles.cardPad}`}>
                <div className={styles.railHead}>
                  <p className={`adrawer__eyebrow ${styles.railEyebrow}`}>Signup form</p>
                  <button
                    className={`sbtn ${styles.copyBtn}`}
                    type="button"
                    onClick={() => void copyEmbed()}
                  >
                    <Icon name="copy" size={12} stroke={2.2} />
                    {copyLabel}
                  </button>
                </div>
                <code className={`${styles.embed} ${styles.mono}`}>{view.embedSnippet}</code>
              </section>
            )}
          </aside>
        </div>
      </main>

      <ToastHost toast={toast} />

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete “${list.name}”?`}
          message="Subscribers stay in the workspace. Campaign history is kept."
          confirmLabel="Delete list"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteList();
          }}
        />
      )}

      {importOpen && (
        <SubscriberImportModal
          initialStep="file"
          initialListIds={[list.id]}
          initialImportListIds={[list.id]}
          hideImportLists
          lists={lists?.length ? lists : [{ id: list.id, name: list.name }]}
          customFieldKeys={fields.map((f) => f.key)}
          onClose={() => setImportOpen(false)}
          onError={show}
          onImported={() => void refreshStats()}
          onCreated={async (_created, values) => {
            await refreshStats();
            show(`${values.email} added`);
          }}
        />
      )}

      {editorOpen && (
        <ListEditorModal
          mode="edit"
          initialName={list.name}
          initialNotes={list.notes ?? ''}
          initialColor={list.color ?? undefined}
          initialChannels={(list.channels as ChannelType[] | undefined) ?? ['email']}
          initialGdprConsent={Boolean(list.gdprConsent)}
          onClose={() => setEditorOpen(false)}
          onSave={async (values) => {
            try {
              const updated = await api.patch<ApiList>(`lists/${list.id}`, {
                name: values.name,
                notes: values.notes || null,
                color: values.color,
                channels: values.channels,
                gdprConsent: values.gdprConsent,
              });
              setList((l) => ({
                ...l,
                name: updated.name,
                notes: updated.notes ?? values.notes,
                color: updated.color || values.color,
                channels: updated.channels ?? values.channels,
                gdprConsent: updated.gdprConsent ?? values.gdprConsent,
              }));
              setEditorOpen(false);
              show(`List “${values.name}” updated`);
            } catch (e) {
              show(e instanceof ApiError ? e.message : 'Could not save list');
            }
          }}
        />
      )}
    </div>
  );
}
