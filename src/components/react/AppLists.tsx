import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type Dispatch,
  type SetStateAction,
} from 'react';
import Icon from './Icon';
import ToastHost from './shared/ToastHost';
import ConfirmDialog from './shared/ConfirmDialog';
import CustomFieldsModal from './CustomFieldsModal';
import ListEditorModal, { type ListEditorValues } from './ListEditorModal';
import { COLORS } from './ListEditorModal.logic';
import TimeAgo from './shared/TimeAgo';
import { fmtPct, PAGE_SIZE, rows as mockRows, trendPath, weeklyGain } from './AppLists.logic';
import type { ListRow, SortKey, View } from './AppLists.types';
import { api, ApiError } from '@/lib/app/api';
import { toListRow, toListRows, type ApiList } from '@/lib/app/list-map';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import type { ChannelType } from '@/types/app';
import { routes } from '@/config/routes';
import { channelReportConfig } from '@/lib/app/campaign-report';
import { RATE_BUCKETS, parseRatePercent, rateBucket } from '@/lib/app/templates-data';
import { matchesSearchQuery } from '@/lib/app/search-match';
import { tagStyle } from '@/lib/app/tag-style';
import TagFilter from './shared/TagFilter';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import { visiblePageNumbers } from './shared/pagination';
import styles from './AppLists.module.css';

/** Workspace-wide counts behind the channel tabs and the tag menu. */
export type ListFacets = {
  byChannel: Record<string, number>;
  tags: { name: string; count: number }[];
};

/* The rate bands the filter menu shows, as the slugs the API takes. The
   boundaries are the same on both sides — see LIST_RATE_BUCKETS. */
const RATE_SLUG: Record<string, string> = {
  None: 'none',
  'Under 20%': 'low',
  '20 – 40%': 'mid',
  '40%+': 'high',
};

export default function AppLists({
  initial,
  initialTotal,
  initialFacets,
}: {
  initial?: ListRow[];
  /** Lists matching the first page's filters, for the pager. */
  initialTotal?: number;
  /** Workspace tab counts and tag menu, so both render before the first fetch. */
  initialFacets?: ListFacets;
} = {}) {
  // Live workspace lists from SSR when provided; otherwise the fixture preview.
  const live = initial !== undefined;
  /*
   * In live mode this holds ONE page, not the workspace. Everything that used
   * to be derived by filtering it in the browser — the rows, the tab counts,
   * the tag menu, the footer total — now comes from the server, because ten
   * rows cannot answer questions about a thousand lists, and because deriving
   * them here is what forced the endpoint to aggregate every membership row in
   * the workspace before the first list could be drawn.
   */
  /* LATENT DEFECT (fixture leakage): `mockRows` is a FIXTURE — three lists with
     invented trends, open rates and "58.2%"-style strings. It stands in only
     when `initial` is `undefined`, which SSR passes on an API error or a session
     with no `activeTenantId`. In that case a live workspace renders fabricated
     rows with no banner distinguishing them from real ones. The values are
     fictional; only the empty case is safe. */
  const [listRows, setListRows] = useState<ListRow[]>(initial !== undefined ? initial : mockRows);
  const [serverTotal, setServerTotal] = useState<number>(initialTotal ?? 0);
  const [serverFacets, setServerFacets] = useState<ListFacets | null>(initialFacets ?? null);
  const [loadingPage, setLoadingPage] = useState(false);
  /*
   * Keyset paging state. A cursor names the row a page resumes from, so pages
   * are walked rather than jumped to; a page the user has never reached has no
   * cursor and falls back to the server's `page` param for that one request.
   */
  const [cursors, setCursors] = useState<{ key: string; byPage: Record<number, string> }>({
    key: '',
    byPage: {},
  });
  /* Bumped after any mutation, to re-read the page and the facets together — a
     create or a delete changes the total and the tab counts, not just a row. */
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);
  const [query, setQuery] = useState('');
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'opens' | 'clicks' | null>(null);
  const [view, setView] = useState<View>('cards');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 1 });

  // Every tag in the workspace, with list counts. Server-side when live: the
  // page in hand knows only its own twelve rows' tags.
  const allTags = useMemo(() => {
    if (live) return serverFacets?.tags ?? [];
    const freq = new Map<string, number>();
    for (const l of listRows) {
      for (const t of l.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [live, serverFacets, listRows]);
  const toggleTag = (t: string) => {
    setTagSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    resetPage();
  };

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>) => (v: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    resetPage();
  };
  const [openId, setOpenId] = useState<string | null>(null);

  // Legacy pin / bookmark: /dashboard/lists?open=<id> used to open the
  // drawer on this table. Pins now go to the list detail page.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) window.location.replace(routes.app.list(id));
  }, []);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Create-only — name/settings edits live on the list detail page.
  const [editor, setEditor] = useState<{ mode: 'create' } | null>(null);
  // Tabs cut the table by the channels a list is declared for. Email leads: it
  // is every list's default and the only channel needing no subscriber phone.
  const [tab, setTab] = useState<ChannelType>('email');
  const tabCfg = channelReportConfig(tab);
  const showOpenFilter = tabCfg.rateCards.some((r) => r === 'open' || r === 'seen');
  const showClickFilter = tabCfg.rateCards.includes('click');

  /*
   * One string naming the filter set and ordering that a page number and a
   * cursor belong to.
   *
   * Derived during render rather than reset from an effect, and that is the
   * point: an effect that calls setPage(1) has not run by the time the fetch
   * effect fires in the same commit, so switching channel would issue one
   * request carrying the previous channel's cursor. The server refuses it
   * (cursor_shape_mismatch — the guard working as intended) and the right
   * request follows, but it is a wasted round trip on every filter change.
   * Keying the state makes the reset simultaneous.
   */
  const queryKey = useMemo(
    () =>
      JSON.stringify([
        tab,
        query.trim(),
        [...tagSel].sort(),
        [...opensSel].sort(),
        [...clicksSel].sort(),
        sort.key,
        sort.dir,
      ]),
    [tab, query, tagSel, opensSel, clicksSel, sort],
  );
  const page = pageState.key === queryKey ? pageState.page : 1;
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ key: queryKey, page: typeof next === 'function' ? next(page) : next });
  const cursorFor = cursors.key === queryKey ? cursors.byPage : {};
  const resetPage = () => setPage(1);
  const openFilterLabel = tabCfg.openLabel === 'Seen' ? 'Seen' : 'Opens';

  useEffect(() => {
    if (!showOpenFilter) setOpensSel(new Set());
    if (!showClickFilter) setClicksSel(new Set());
    setOpenFilter(null);
  }, [tab, showOpenFilter, showClickFilter]);

  // Quick action: /dashboard/lists?new opens the create editor.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') == null) return;
    setEditor({ mode: 'create' });
    url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);
  const [fieldsOpen, setFieldsOpen] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const createList = async (values: ListEditorValues) => {
    if (!live) {
      setEditor(null);
      showToast(`List “${values.name}” created`);
      return;
    }
    try {
      const created = await api.post<ApiList>('lists', {
        name: values.name,
        notes: values.notes || null,
        color: values.color,
        channels: values.channels,
        gdprConsent: values.gdprConsent,
      });
      // The new list belongs to a page the server decides, and it moves the
      // total and the tab counts — so re-read rather than splice it in here.
      if (live) refresh();
      else setListRows((prev) => [toListRow(created), ...prev]);
      setEditor(null);
      showToast(`List “${values.name}” created`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save list');
    }
  };

  // Set while a delete waits on confirmation.
  const [confirmList, setConfirmList] = useState<{ id: string; name: string } | null>(null);

  /* Optimistic: the row updates immediately and only reverts via a toast if
     the API rejects it. Tags and color are single clicks — waiting on a round
     trip to redraw a chip reads as lag. */
  const patchList = async (
    id: string,
    patch: { tags?: string[]; notes?: string; color?: string },
  ) => {
    const body = {
      ...patch,
      ...(patch.notes !== undefined ? { notes: patch.notes || null } : {}),
    };
    setListRows((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (!live) return;
    try {
      await api.patch(`lists/${id}`, body);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save changes');
    }
  };

  const deleteList = async (id: string, name: string) => {
    if (live) {
      try {
        await api.del(`lists/${id}`);
      } catch (e) {
        showToast(e instanceof ApiError ? e.message : 'Could not delete list');
        return;
      }
    }
    // Dropping the row locally would leave the page one short and the footer
    // total stale; the page and the facets are re-read together instead.
    if (live) refresh();
    else setListRows((prev) => prev.filter((l) => l.id !== id));
    closeDrawer();
    showToast(`List “${name}” deleted`);
  };

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const ch of CHANNEL_ORDER) {
      c[ch] = live
        ? (serverFacets?.byChannel[ch] ?? 0)
        : listRows.filter((l) => (l.channels ?? ['email']).includes(ch)).length;
    }
    return c;
  }, [live, serverFacets, listRows]);

  /*
   * The fixture pipeline: filter and sort the whole set in the browser.
   *
   * Unreachable in live mode — there the server applies every one of these
   * filters and the sort in SQL and hands back exactly one page, so the rows in
   * hand are already the answer. Filtering them again here is what made the old
   * board need all 1,006 lists (and a membership aggregate over the entire
   * workspace) before it could draw ten.
   */
  const fixtureRows = useMemo(() => {
    if (live) return [];
    const q = query.trim().toLowerCase();
    let list = listRows.filter((l) => {
      if (!(l.channels ?? ['email']).includes(tab)) return false;
      if (tagSel.size > 0 && !l.tags.some((t) => tagSel.has(t))) return false;
      if (
        showOpenFilter &&
        opensSel.size &&
        !opensSel.has(rateBucket(parseRatePercent(l.openRate)))
      )
        return false;
      if (
        showClickFilter &&
        clicksSel.size &&
        !clicksSel.has(rateBucket(parseRatePercent(l.clickRate)))
      )
        return false;
      if (!q) return true;
      return (
        matchesSearchQuery(l.name, q) ||
        l.tags.some((t) => matchesSearchQuery(t, q)) ||
        (l.gdprConsent && matchesSearchQuery('gdpr', q))
      );
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let av: number | string = a[key] as number | string;
      let bv: number | string = b[key] as number | string;
      if (key === 'updatedAt') {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      } else if (key === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [live, tab, query, tagSel, opensSel, clicksSel, sort, listRows, showOpenFilter, showClickFilter]);

  // Live: `listRows` is the page the server returned and `serverTotal` counts
  // the whole filtered set. Fixtures: both come from the array in hand.
  const totalRows = live ? serverTotal : fixtureRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const startIdx = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, totalRows);
  const pageRows = live
    ? listRows
    : fixtureRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /*
   * One page of the board, from the server.
   *
   * The server owns every filter the screen offers — channel, tags, search,
   * open/click band — plus the sort and the page window. Nothing above narrows
   * a live page any more.
   */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      channel: tab,
      sort: sort.key,
      dir: sort.dir === 1 ? 'asc' : 'desc',
    });
    // Only `updatedAt` is a timestamp, so only it can carry a keyset cursor;
    // the other columns page by number over the small `lists` table.
    const cursor = sort.key === 'updatedAt' ? cursorFor[page] : undefined;
    if (cursor) qs.set('cursor', cursor);
    else if (page > 1) qs.set('page', String(page));
    if (query.trim()) qs.set('q', query.trim());
    for (const t of tagSel) qs.append('tag', t);
    // Bands are only sent on channels that report them — the same rule that
    // decides whether the filter control exists at all.
    if (showOpenFilter) for (const b of opensSel) qs.append('opens', RATE_SLUG[b] ?? b);
    if (showClickFilter) for (const b of clicksSel) qs.append('clicks', RATE_SLUG[b] ?? b);
    // Count once per filter set: the pager needs a page count, but counting on
    // every Next would be a scan per click.
    if (page === 1) qs.set('withTotal', '1');

    setLoadingPage(true);
    api
      .get<{ items: ApiList[]; next_cursor: string | null; total?: number }>(`lists?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setListRows(toListRows(res.items ?? []));
        // Remember the doorway to the following page so Next stays keyset.
        if (res.next_cursor) {
          const token = res.next_cursor;
          setCursors((c) => ({
            key: queryKey,
            byPage: { ...(c.key === queryKey ? c.byPage : {}), [page + 1]: token },
          }));
        }
        if (res.total !== undefined) setServerTotal(res.total);
      })
      .catch(() => {
        /* keep the page on screen rather than blanking the table */
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
    // `cursorFor` is read but deliberately not depended on: this effect fills
    // it, so listing it would re-run the fetch on its own result. `queryKey` is
    // a function of the filters already listed.
  }, [live, queryKey, tab, sort, page, refreshTick, showOpenFilter, showClickFilter]);

  /* Tab counts and the tag menu describe the workspace, so they are fetched
     once — never per page. One grouped read of `lists`, no membership data. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .get<ListFacets>('lists/facets')
      .then((f) => {
        if (!cancelled) setServerFacets(f);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [live, refreshTick]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  const open = openId ? (listRows.find((l) => l.id === openId) ?? null) : null;
  const closeDrawer = () => {
    setClosing(true);
    window.setTimeout(() => {
      setOpenId(null);
      setClosing(false);
    }, 240);
  };

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Lists</h1>
          <p className="screen__sub">Organize your subscribers into lists.</p>
        </div>
        <div className={styles.headActions}>
          <button type="button" className="sbtn" onClick={() => setFieldsOpen(true)}>
            <Icon name="settings" size={15} />
            Custom fields
          </button>
          <button type="button" className="pbtn" onClick={() => setEditor({ mode: 'create' })}>
            <Icon name="plus" size={15} stroke={2.2} />
            New list
          </button>
        </div>
      </div>

      <div className={`atable ${styles.tablecard}`}>
        {/* channel tabs — which channels each list is declared for */}
        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Channel">
          {CHANNEL_ORDER.map((ch) => {
            const m = CHANNEL[ch];
            const active = tab === ch;
            return (
              <button
                key={ch}
                type="button"
                role="tab"
                aria-selected={active}
                className={`atab${active ? ' is-active' : ''}`}
                onClick={() => {
                  setTab(ch);
                  setPage(1);
                }}
              >
                <Icon name={m.icon} size={13} />
                {m.label}
                <span className="atab__count tnum">{tabCounts[ch] ?? 0}</span>
              </button>
            );
          })}
        </div>

        {/* toolbar: controls on row 1; active filter chips always on their own row */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
            <label className={styles.search}>
              <Icon name="search" size={15} className={styles.searchic} />
              <input
                type="search"
                placeholder="Search lists…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search lists"
              />
            </label>
            <TagFilter
              tags={allTags}
              selected={tagSel}
              onToggle={toggleTag}
              onClear={() => {
                setTagSel(new Set());
                resetPage();
              }}
            />
            {/* Rate filters exist only where the channel reports the rate.
                Offering "Opens" on SMS would filter every row to nothing. */}
            {showOpenFilter && (
              <ColFilter
                label={openFilterLabel}
                icon="eye"
                options={RATE_BUCKETS}
                selected={opensSel}
                onToggle={toggleSet(setOpensSel)}
                onClear={() => {
                  setOpensSel(new Set());
                  resetPage();
                }}
                open={openFilter === 'opens'}
                onOpenToggle={() => setOpenFilter((o) => (o === 'opens' ? null : 'opens'))}
              />
            )}
            {showClickFilter && (
              <ColFilter
                label="Clicks"
                icon="target"
                options={RATE_BUCKETS}
                selected={clicksSel}
                onToggle={toggleSet(setClicksSel)}
                onClear={() => {
                  setClicksSel(new Set());
                  resetPage();
                }}
                open={openFilter === 'clicks'}
                onOpenToggle={() => setOpenFilter((o) => (o === 'clicks' ? null : 'clicks'))}
              />
            )}
            <div className={styles.spacer} />
            <div className="aseg" role="group" aria-label="View mode">
              {(['cards', 'table'] as View[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`aseg__opt${view === v ? ' is-active' : ''}`}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v === 'cards' ? 'Cards' : 'Table'}
                </button>
              ))}
            </div>
          </div>
          <FilterChipsRow
            chips={[
              ...[...tagSel].map((t) => ({
                key: `tag:${t}`,
                label: `Tag: ${t}`,
                onRemove: () => toggleTag(t),
              })),
              ...(showOpenFilter
                ? [...opensSel].map((b) => ({
                    key: `opens:${b}`,
                    label: `${openFilterLabel}: ${b}`,
                    onRemove: () => toggleSet(setOpensSel)(b),
                  }))
                : []),
              ...(showClickFilter
                ? [...clicksSel].map((b) => ({
                    key: `clicks:${b}`,
                    label: `Clicks: ${b}`,
                    onRemove: () => toggleSet(setClicksSel)(b),
                  }))
                : []),
            ]}
            onClearAll={() => {
              setTagSel(new Set());
              setOpensSel(new Set());
              setClicksSel(new Set());
              resetPage();
            }}
          />
        </div>

        {/* TABLE VIEW */}
        {view === 'table' && (
          <>
            <div className={`athead ${styles.grid}`}>
              <div>
                <button
                  type="button"
                  className={sort.key === 'name' ? 'is-active' : undefined}
                  onClick={() => toggleSort('name')}
                >
                  List <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>Tags</div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'subscribers' ? 'is-active' : undefined}
                  onClick={() => toggleSort('subscribers')}
                >
                  Subscribers <span className="tnum">{sortArrow('subscribers')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'growthPct' ? 'is-active' : undefined}
                  onClick={() => toggleSort('growthPct')}
                >
                  {/* One flex item: the header button gaps its children, which
                      would space out the parenthesised unit. */}
                  <span>
                    Growth (<span className={styles.keepCase}>1w</span>)
                  </span>
                  <span className="tnum">{sortArrow('growthPct')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>Channels</div>
              <div className={styles.colCenter}>GDPR consent</div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'updatedAt' ? 'is-active' : undefined}
                  onClick={() => toggleSort('updatedAt')}
                >
                  Updated <span className="tnum">{sortArrow('updatedAt')}</span>
                </button>
              </div>
            </div>

            {pageRows.length === 0 ? (
              <div className="atable__empty">No lists match your search.</div>
            ) : (
              pageRows.map((l) => {
                const up = l.growthPct >= 0;
                return (
                  <div
                    key={l.id}
                    className={`atrow ${styles.grid}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenId(l.id);
                      }
                    }}
                  >
                    <div className={styles.namecell}>
                      <span className={styles.dot} style={{ background: l.color }} />
                      <span className={styles.name}>{l.name}</span>
                    </div>
                    <div className={styles.tagcell}>
                      {l.tags.length === 0 ? (
                        <span className={styles.dash}>—</span>
                      ) : (
                        l.tags.map((t) => (
                          <span key={t} className={styles.tag} style={tagStyle(t)}>
                            {t}
                          </span>
                        ))
                      )}
                    </div>
                    <div className={`tnum ${styles.numCell}`}>
                      {l.subscribers.toLocaleString('en-US')}
                    </div>
                    <div
                      className={`tnum ${styles.growth}`}
                      style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {fmtPct(l.growthPct)}
                    </div>
                    <div className={styles.chanCell}>
                      {(l.channels ?? ['email']).map((ch) => {
                        const m = CHANNEL[ch];
                        return (
                          <span
                            key={ch}
                            className={styles.chanTile}
                            style={{ background: m.tint, color: m.color }}
                            role="img"
                            aria-label={m.label}
                            title={m.label}
                          >
                            <Icon name={m.icon} size={11} />
                          </span>
                        );
                      })}
                    </div>
                    <div className={styles.gdprCell}>
                      {l.gdprConsent ? (
                        <span
                          className={styles.gdprCheck}
                          title="GDPR consent"
                          aria-label="GDPR consent"
                        >
                          <Icon name="check" size={15} stroke={3} />
                        </span>
                      ) : (
                        <span className={styles.dash}>—</span>
                      )}
                    </div>
                    <TimeAgo className={styles.dateCell} at={l.updatedAt} />
                  </div>
                );
              })
            )}
          </>
        )}

        {/* CARDS VIEW */}
        {view === 'cards' &&
          (pageRows.length === 0 ? (
            <div className="atable__empty">No lists match your search.</div>
          ) : (
            <div className={styles.cards}>
              {pageRows.map((l) => {
                const up = l.growthPct >= 0;
                // `more` is "+N" from members added in the last 7 days.
                const joined = Number.parseInt(l.more.replace(/^\+/, ''), 10) || 0;
                return (
                  <div
                    key={l.id}
                    className={`acrd acrd--hover ${styles.card}`}
                    style={{ '--list-color': l.color } as CSSProperties}
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(l.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setOpenId(l.id);
                      }
                    }}
                  >
                    <div className={styles.cardTop}>
                      <span
                        className={styles.cardDot}
                        style={{ background: l.color }}
                        aria-hidden="true"
                      />
                      <span className={styles.cardName} title={l.name}>
                        {l.name}
                      </span>
                      <span
                        className={`${styles.cardPct} tnum`}
                        style={{
                          color: up ? 'var(--success-text)' : 'var(--danger-text)',
                          background: up
                            ? 'color-mix(in srgb, var(--success) 12%, transparent)'
                            : 'color-mix(in srgb, var(--danger) 12%, transparent)',
                        }}
                      >
                        {fmtPct(l.growthPct)}
                      </span>
                    </div>

                    <div className={styles.cardStat}>
                      <span className={`${styles.cardNum} tnum`}>
                        {l.subscribers.toLocaleString('en-US')}
                      </span>
                      <span className={styles.cardStatLabel}>subscribers</span>
                      <span className={styles.cardChans}>
                        {(l.channels ?? ['email']).map((ch) => {
                          const m = CHANNEL[ch];
                          return (
                            <span
                              key={ch}
                              className={styles.chanTile}
                              style={{ background: m.tint, color: m.color }}
                              role="img"
                              aria-label={m.label}
                              title={m.label}
                            >
                              <Icon name={m.icon} size={11} />
                            </span>
                          );
                        })}
                      </span>
                    </div>

                    <div className={styles.cardFoot}>
                      <span className={styles.cardJoin}>
                        <span
                          className="tnum"
                          style={{
                            color: joined > 0 ? 'var(--success-text)' : 'var(--text4)',
                          }}
                        >
                          {joined > 0 ? '↑' : '↓'} {joined}
                        </span>{' '}
                        joined this week
                      </span>
                      <TimeAgo className={styles.cardUpdated} prefix="Updated " at={l.updatedAt} />
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={`${styles.card} ${styles.cardNew}`}
                onClick={() => setEditor({ mode: 'create' })}
              >
                <span className={styles.newplus}>
                  <Icon name="plus" size={18} stroke={2.2} />
                </span>
                Create new list
              </button>
            </div>
          ))}

        {/* footer / pagination */}
        <div className={`atable__foot ${styles.foot}`}>
          <span className={totalRows === 0 ? undefined : 'tnum'}>
            {totalRows === 0
              ? 'No lists match your search'
              : `${startIdx}–${endIdx} of ${totalRows.toLocaleString('en-US')} list${totalRows === 1 ? '' : 's'}${loadingPage ? ' · loading…' : ''}`}
          </span>
          {pageCount > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pg}
                disabled={safePage === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <Icon name="chevron-right" size={15} className={styles.pgflip} />
              </button>
              {pagerPages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.pgn} tnum${n === safePage ? ' is-on' : ''}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pg}
                disabled={safePage === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                aria-label="Next page"
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <ListDrawer
          key={open.id}
          list={open}
          closing={closing}
          onClose={closeDrawer}
          onToast={showToast}
          onPatch={patchList}
          onFilterTag={(t) => {
            if (!tagSel.has(t)) toggleTag(t);
            closeDrawer();
            showToast(`Filtered by “${t}”`);
          }}
          onDelete={() => setConfirmList({ id: open.id, name: open.name })}
        />
      )}

      {fieldsOpen && (
        <CustomFieldsModal live={live} onToast={showToast} onClose={() => setFieldsOpen(false)} />
      )}

      {editor && (
        <ListEditorModal mode="create" onClose={() => setEditor(null)} onSave={createList} />
      )}

      {confirmList && (
        <ConfirmDialog
          title={`Delete “${confirmList.name}”?`}
          message="The list is removed. Its subscribers stay in the workspace."
          confirmLabel="Delete list"
          onCancel={() => setConfirmList(null)}
          onConfirm={() => {
            const target = confirmList;
            setConfirmList(null);
            void deleteList(target.id, target.name);
          }}
        />
      )}

      <ToastHost toast={toast} />
    </div>
  );
}

function ListDrawer({
  list,
  closing,
  onClose,
  onToast,
  onPatch,
  onFilterTag,
  onDelete,
}: {
  list: ListRow;
  closing: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
  onPatch: (id: string, patch: { tags?: string[]; notes?: string; color?: string }) => void;
  onFilterTag: (tag: string) => void;
  onDelete: () => void;
}) {
  // Tags and color persist as you edit. Notes do not: a note is prose,
  // and a debounce either fires mid-sentence or silently drops the tail, so it
  // gets an explicit Save that appears only once the text differs.
  const initialColor = COLORS.includes(list.color) ? list.color : COLORS[0];
  const [note, setNote] = useState(list.notes);
  const [savedNote, setSavedNote] = useState(list.notes);
  const [color, setColor] = useState(initialColor);

  const [tags, setTags] = useState<string[]>(list.tags);
  const [tagInput, setTagInput] = useState('');
  const addTag = () => {
    const v = tagInput.trim();
    setTagInput('');
    if (!v || tags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    const next = [...tags, v];
    setTags(next);
    onPatch(list.id, { tags: next });
    onToast('Tags saved');
  };
  const removeTag = (t: string) => {
    const next = tags.filter((x) => x !== t);
    setTags(next);
    onPatch(list.id, { tags: next });
    onToast('Tags saved');
  };

  const pickColor = (c: string) => {
    if (c === color) return;
    setColor(c);
    onPatch(list.id, { color: c });
    onToast('Color saved');
  };

  const noteDirty = note !== savedNote;
  const saveNote = () => {
    if (!noteDirty) return;
    setSavedNote(note);
    onPatch(list.id, { notes: note });
    onToast('Note saved');
  };

  const up = list.growthPct >= 0;
  const gain = weeklyGain(list.trend);
  // Members the list holds but cannot mail — bounced, complained, invalid or
  // unsubscribed. `resolveAudience` drops them, so the headline count alone
  // overstates the reach of a send.
  const unmailable = Math.max(0, list.subscribers - list.mailable);
  const chart = trendPath(list.trend, 346, 88);

  return (
    <div className={`adrawer-overlay${closing ? ` ${styles.overlayOut}` : ''}`} onClick={onClose}>
      <div
        className={`adrawer lld${closing ? ` ${styles.drawerOut}` : ''}`}
        style={{ width: 410 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${list.name} details`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">List details</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body">
          {/* identity */}
          <div className={styles.dIdentity}>
            <div className={styles.dIdtext}>
              <div className={styles.dNameRow}>
                <h2 className={styles.dName} title={list.name}>
                  {list.name.trim() || 'Untitled list'}
                </h2>
                {list.gdprConsent ? (
                  <span className={styles.gdprBadge} title="GDPR consent">
                    <Icon name="shield" size={12} stroke={2.4} />
                    GDPR
                    <span className={styles.gdprBadgeCheck} aria-hidden="true">
                      <Icon name="check" size={8} stroke={3.5} />
                    </span>
                  </span>
                ) : null}
              </div>
              <TimeAgo className={styles.dUpdated} prefix="Updated " at={list.updatedAt} />
            </div>
          </div>

          {/* stat cards */}
          <div className={`adrawer__kpis ${styles.dStats}`}>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Subscribers</div>
              <div className="tnum adrawer__kpi-v">{list.subscribers.toLocaleString('en-US')}</div>
              {unmailable > 0 && (
                <div className={`tnum ${styles.dStatSub}`}>
                  {list.mailable.toLocaleString('en-US')} mailable
                </div>
              )}
            </div>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Signups vs last week</div>
              <div
                className="tnum adrawer__kpi-v"
                style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
              >
                {fmtPct(list.growthPct)}
              </div>
            </div>
            {/* No open/click tiles: both divide by deliveries on email and
                WhatsApp only, but a list is mailed on all four channels, so a
                single pair of rates spoke for sends they never measured. */}
          </div>

          {/* subscriber trend */}
          <div className={styles.dTrend}>
            <div className={styles.dTrendHead}>
              <span className="adrawer__eyebrow">Subscriber trend</span>
              <span
                className={`tnum ${styles.dTrendGain}`}
                style={{ color: gain > 0 ? 'var(--success)' : 'var(--muted)' }}
              >
                +{gain.toLocaleString('en-US')} joined this week
              </span>
            </div>
            <div className={styles.dChart}>
              <svg
                width="100%"
                height="88"
                viewBox="0 0 346 88"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="lldTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#4f46e5" stopOpacity="0.18" />
                    <stop offset="1" stopColor="#4f46e5" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <polyline points={chart.area} fill="url(#lldTrend)" stroke="none" />
                <polyline
                  points={chart.line}
                  fill="none"
                  stroke="#4f46e5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={chart.last[0]}
                  cy={chart.last[1]}
                  r="3.5"
                  fill="#4f46e5"
                  stroke="var(--surface)"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div className={styles.dAxis}>
              <span>6 weeks ago</span>
              <span>Now</span>
            </div>
          </div>

          <div className={styles.dChanSection}>
            <span className={`adrawer__eyebrow ${styles.dTagsEyebrow}`}>Channels</span>
            <div className={styles.dChans}>
              {(list.channels ?? ['email']).map((ch) => {
                const m = CHANNEL[ch];
                return (
                  <span key={ch} className="apill" style={{ background: m.tint, color: m.color }}>
                    <Icon name={m.icon} size={12} />
                    {m.label}
                  </span>
                );
              })}
            </div>
          </div>

          {/* color — saved on pick */}
          <div className={styles.dColorSection}>
            <span className={`adrawer__eyebrow ${styles.dColorEyebrow}`}>Color</span>
            <div className={styles.dSwatches} role="group" aria-label="List color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`${styles.dSwatch}${c === color ? ` ${styles.dSwatchOn}` : ''}`}
                  style={{ background: c, color: c }}
                  aria-label={`Color ${c}`}
                  aria-pressed={c === color}
                  onClick={() => pickColor(c)}
                />
              ))}
            </div>
          </div>

          {/* notes — explicit Save, sitting in the header so the actions are
              visible without scrolling past a long note */}
          <div className={styles.dNoteshead}>
            <span className="adrawer__eyebrow">Notes</span>
            {noteDirty && (
              <span className={styles.dNoteActions}>
                <button
                  type="button"
                  className={styles.dNoteBtn}
                  onClick={() => setNote(savedNote)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.dNoteBtn} ${styles.dNoteSave}`}
                  onClick={saveNote}
                >
                  Save
                </button>
              </span>
            )}
          </div>
          <textarea
            className={styles.dNotes}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this list…"
            aria-label="List notes"
          />

          {/* editable tags — saved as you add or remove them */}
          <div className={styles.dTagsSection}>
            <span className={`adrawer__eyebrow ${styles.dTagsEyebrow}`}>Tags</span>
            <div className={styles.dTags}>
              {tags.map((t) => (
                <span key={t} className={styles.dTag} style={tagStyle(t)}>
                  <button
                    type="button"
                    className={styles.dTaglbl}
                    title={`Filter by “${t}”`}
                    onClick={() => onFilterTag(t)}
                  >
                    {t}
                  </button>
                  <button
                    type="button"
                    className={styles.dTagx}
                    aria-label={`Remove ${t}`}
                    onClick={() => removeTag(t)}
                  >
                    <Icon name="x" size={14} stroke={3} />
                  </button>
                </span>
              ))}
              <input
                className={styles.dTagin}
                placeholder="Add tag…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                aria-label="Add tag"
              />
            </div>
          </div>
        </div>

        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none', color: 'var(--danger)' }}
            aria-label={`Delete ${list.name}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none' }}
            onClick={() => onToast(`Exporting ${list.name}`)}
          >
            <Icon name="download" size={15} />
            Export
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={() => {
              window.location.href = routes.app.list(list.id);
            }}
          >
            Open list
          </button>
        </div>
      </div>
    </div>
  );
}
