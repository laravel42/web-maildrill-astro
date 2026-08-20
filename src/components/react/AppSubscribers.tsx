import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import type { ChannelType, SubscriberStatus } from '@/types/app';
import {
  richSubscribers as mockSubscribers,
  CORE_SEG_FIELDS,
  STATUS_VALUES,
  isCoreSegField,
  opNeedsValue,
  opsForSegField,
  toApiRules,
  toSavedSegment,
  type ApiSegment,
  type RichSubscriber,
  type SavedSegment,
  type SegField,
  type SegOp,
  type SegRule,
} from '@/lib/app/subscribers-data';
import { api, ApiError } from '@/lib/app/api';
import { toRichSubscriber, toRichSubscribers, type ApiSubscriber } from '@/lib/app/subscriber-map';
import { matchesSearchQuery } from '@/lib/app/search-match';
import { parseRatePercent } from '@/lib/app/templates-data';
import {
  ENGAGEMENT_BUCKET_SLUGS,
  engagementBucketLabel,
  fixtureEngagementBucket,
} from '@/lib/app/engagement-buckets';
import SubscriberEditorModal from './SubscriberEditorModal';
import SubscriberImportModal from './shared/SubscriberImportModal';
import { applyListMembership } from '@/lib/app/subscriber-write';
import { buildCsv, downloadCsv, exportFilename, subscribersCsv } from '@/lib/app/subscriber-export';
import type { CustomField } from '@/lib/app/custom-fields';
import TagFilter from './shared/TagFilter';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { ChannelPill } from './shared/CampaignPills';
import { channelReportConfig } from '@/lib/app/campaign-report';
import { agoNow } from './shared/time';
import TimeAgo from './shared/TimeAgo';
import { useToast } from './shared/useToast';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  STATUS_CHIP_STYLE,
  STATUS_LABEL,
  channelStatuses,
  statusForChannel,
  PAGE_SIZE,
  visiblePageNumbers,
  tagStyle,
  reachOf,
  rosterFilterParams,
  initials,
} from './AppSubscribers.logic';
import type { SortKey, ViewMode } from './AppSubscribers.types';
import { routes } from '@/config/routes';
import styles from './AppSubscribers.module.css';

/**
 * CSV export window. `EXPORT_PAGE` is the cursor endpoint's own ceiling
 * (httpkit PAGE.max), so asking for more just gets clamped; `EXPORT_MAX` is a
 * product cap, not a cost one — every page after the first costs the same as
 * the first now that the export walks cursors instead of OFFSET.
 */
const EXPORT_PAGE = 100;
const EXPORT_MAX = 10_000;

export default function AppSubscribers({
  initial,
  initialTotal = 0,
  initialCounts = null,
  initialSegments,
  allLists: initialLists = [],
  allTagRows = [],
}: {
  initial?: RichSubscriber[];
  /** How many subscribers match with no filters — the server's count, not this page's. */
  initialTotal?: number;
  /**
   * The unfiltered roster, per channel, from the SSR scan.
   *
   * Two jobs: it is the first paint's tab counts and Status menu, and it stays
   * the "All subscribers" chip's number for the whole session — that chip means
   * "the roster, no segment", so it must not follow the filtered counts the way
   * the tabs do.
   */
  initialCounts?: {
    email?: number;
    sms?: number;
    whatsapp?: number;
    voice?: number;
    byStatus?: Record<string, number>;
  } | null;
  /** Saved segments from the service — the workspace's, not this browser's. */
  initialSegments?: SavedSegment[];
  /** Real lists, used for segment rules and list membership; color tints chips. */
  allLists?: {
    id: string;
    name: string;
    color?: string | null;
    /** Channels the list is set up for; empty or missing reads as email-only. */
    channels?: string[] | null;
  }[];
  /** Real workspace tags (id + name), for segment rules and tagging. */
  allTagRows?: { id: string; name: string }[];
} = {}) {
  const allTags = allTagRows.map((t) => t.name);
  // Live data from the SSR page when provided (even if empty); otherwise fixtures.
  // `live` gates persistence: connected workspaces write through the BFF proxy;
  // the fixture demo stays local-only so the marketing preview still works.
  const live = initial !== undefined;
  const [richSubscribers, setRichSubscribers] = useState<RichSubscriber[]>(
    initial !== undefined ? initial : mockSubscribers,
  );
  /**
   * Server-side paging. A workspace can hold millions of subscribers, so the
   * browser never receives more than one page: the table asks the API for a
   * window and trusts its `total` for the pager and the footer.
   */
  const [serverTotal, setServerTotal] = useState(initialTotal);
  /**
   * Keyset paging state. A cursor names the row a page resumes from, so pages
   * can only be walked, not jumped to: `cursorStack` holds the cursor used for
   * each page already visited, which is what makes Previous work without OFFSET.
   * Empty stack = first page.
   */
  const [hasMore, setHasMore] = useState(false);
  /**
   * Cursor that opens each page we have seen the doorway to (page 1 needs none).
   * Next/Previous walk these — O(1) regardless of depth. Jumping to a page we
   * have never reached has no cursor to resume from, so it falls back to the
   * server's `page` param for that one request and returns to cursors after.
   */
  const [cursorFor, setCursorFor] = useState<Record<number, string>>({});
  const [loadingPage, setLoadingPage] = useState(false);
  const [view, setView] = useState<ViewMode>('table');
  // Tabs cut the table by channel, as on the campaigns board. Email leads: it
  // is the only channel every subscriber can be addressed on.
  const [tab, setTab] = useState<ChannelType>('email');
  const [statusFilter, setStatusFilter] = useState<Set<SubscriberStatus>>(new Set());
  const [statusOpen, setStatusOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [listFilter, setListFilter] = useState<Set<string>>(new Set());
  const [listOpen, setListOpen] = useState(false);
  /**
   * Lists are lazy. /v1/lists computes member counts, growth and trends over
   * every membership row — 3.4s and 710KB on a million-subscriber workspace —
   * and this screen only needs id/name/color for the filter menu and the
   * segment builder. Blocking the page render on it made the first page slow
   * for a control most visits never open.
   */
  const [allLists, setAllLists] = useState(initialLists);
  const [listSearch, setListSearch] = useState('');
  /**
   * Whether a fetch has come back. The button must not be disabled on an empty
   * list before we have asked — lists load on open, so disabling first would
   * make it permanently unclickable.
   */
  const [listsFetched, setListsFetched] = useState(initialLists.length > 0);
  /** A workspace can hold thousands of lists; the menu shows a slice and searches for the rest. */
  const LIST_OPTIONS_LIMIT = 10;
  const fetchLists = (q: string) => {
    if (!live) return;
    const qs = new URLSearchParams({ options: '1', limit: String(LIST_OPTIONS_LIMIT) });
    if (q.trim()) qs.set('q', q.trim());
    api
      .get<{
        data: { id: string; name: string; color?: string | null; channels?: string[] | null }[];
      }>(`lists?${qs}`)
      .then((res) => {
        setAllLists(res.data ?? []);
        setListsFetched(true);
      })
      // Leave the menu as-is rather than blanking it; reopening retries.
      .catch(() => undefined);
  };
  const loadLists = () => {
    if (!live || allLists.length > 0) return;
    fetchLists('');
  };

  /**
   * Open the subscriber editor, making sure the list options exist first.
   *
   * `allLists` is lazy — it used to be fetched on mount and now loads when the
   * Lists FILTER is opened. The editor reads the same state for its "Add to
   * lists" picker but nothing made it load, so opening Add/Edit subscriber
   * without having touched that filter showed "No lists yet — create one
   * first" in a workspace with eight lists, and there was no way to change a
   * subscriber's membership.
   *
   * Not awaited: the modal renders immediately and the chips appear when the
   * request lands, which is the same behaviour the filter menu has.
   */
  const openSubEditor = (next: { mode: 'create' } | { mode: 'edit'; sub: RichSubscriber }) => {
    loadLists();
    setSubEditor(next);
  };
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [rateFilterOpen, setRateFilterOpen] = useState<'opens' | 'clicks' | null>(null);
  const tabCfg = channelReportConfig(tab);
  const showOpenFilter = tabCfg.rateCards.some((r) => r === 'open' || r === 'seen');
  const showClickFilter = tabCfg.rateCards.includes('click');
  const openFilterLabel = tabCfg.openLabel === 'Seen' ? 'Seen' : 'Opens';

  useEffect(() => {
    if (!showOpenFilter) setOpensSel(new Set());
    if (!showClickFilter) setClicksSel(new Set());
    setRateFilterOpen(null);
    // Drop a sort key the new channel doesn't surface, so the arrow doesn't
    // point at a column that isn't there.
    setSort((s) => {
      if (s.key === 'opens' && !showOpenFilter) return { key: 'name', dir: 1 };
      if (s.key === 'clicks' && !showClickFilter) return { key: 'name', dir: 1 };
      return s;
    });
  }, [tab, showOpenFilter, showClickFilter]);

  // Table columns track the same channel report surface as the rate filters:
  // SMS and voice have no open/click stage, so those two fr tracks drop out.
  const tableGridCols = [
    '36px',
    '2fr',
    ...(showOpenFilter ? ['0.7fr'] : []),
    ...(showClickFilter ? ['0.7fr'] : []),
    '1.2fr',
    '0.85fr',
    '0.85fr',
    '0.85fr',
  ].join(' ');
  const [segSel, setSegSel] = useState<Set<string>>(new Set());
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  /**
   * The direction to ask the API for.
   *
   * `created_at` is the only key `subscribers_tenant_created_id_idx` can order
   * a million rows by, and the API rejects the rest with a 400 — but it serves
   * BOTH directions of that one key, cursor comparison included (`keysetPlan`,
   * workers subscribers.ts). So "Subscribed" is wired through to the server and
   * is a true whole-roster ordering in either direction.
   */
  const serverDir: 'asc' | 'desc' = sort.key === 'subscribed' && sort.dir === 1 ? 'asc' : 'desc';

  /**
   * True when the arrow the reader just clicked reorders only the rows in hand.
   *
   * Live, the server hands back one keyset page ordered by `created_at` and
   * `pageRows = filtered` IS that page, so every column except "Subscribed" is
   * re-sorted in the browser over ten rows out of 1,000,229. Descending on
   * "Last activity" that put "9w ago" at the top of a roster whose most recent
   * activity is 1d ago (perf100219@p20.perf-maildrill.test, 2026-08-16 05:47).
   *
   * The scope is stated rather than removed, and the query was NOT changed to
   * match: ordering the roster by `max(coalesce(read_at, delivered_at, sent_at,
   * submitted_at, created_at))` needs that aggregate materialised on
   * `subscribers` plus an index to keyset on, and maintained on every status
   * transition — a schema change, a million-row backfill and a new write-path
   * invariant, to reorder a list. Sorting it live is worse: a full sort of the
   * filtered million per keystroke, which is the exact cost keyset paging
   * exists to avoid. Fixtures hold the whole set in memory, so there the sort
   * really is complete and no note is shown.
   */
  const sortIsPageScoped = live && sort.key !== 'subscribed';

  /** What a page-scoped sort actually did, for the header tooltip and the footer note. */
  const PAGE_SORT_NOTE =
    `Reorders the ${PAGE_SIZE} rows on this page only. The roster itself is ordered by sign-up date — ` +
    `"Subscribed" is the one column that sorts all of it.`;

  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids waiting on the delete confirm dialog (bulk toolbar or drawer).
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [confirmSegment, setConfirmSegment] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, show: showToast } = useToast();
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});

  const [segments, setSegments] = useState<SavedSegment[]>(initialSegments ?? []);
  const [tagIndex, setTagIndex] = useState<{ id: string; name: string }[]>(allTagRows);
  const [segCounts, setSegCounts] = useState<Record<string, number>>({});
  const [segModal, setSegModal] = useState<{ open: boolean; edit: SavedSegment | null }>({
    open: false,
    edit: null,
  });
  const [subEditor, setSubEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; sub: RichSubscriber } | null
  >(null);
  const [exporting, setExporting] = useState(false);

  /* Full CSV export. The table only holds the first page, so live workspaces
     re-fetch the filtered set a page at a time; demo mode exports what's on
     screen. Columns mirror the import mapper for clean round-trips. */
  const exportSubscribers = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (!live) {
        const csv = buildCsv(
          ['email', 'name', 'phone', 'status', 'tags', 'lists'],
          richSubscribers.map((s) => [
            s.email,
            s.name,
            s.phone,
            s.status,
            s.tags.join('; '),
            s.lists.join('; '),
          ]),
        );
        downloadCsv(exportFilename('subscribers'), csv);
        showToast(`Exported ${richSubscribers.length} subscribers`);
        return;
      }
      // Same filters as the table, and keyset rather than OFFSET: the export
      // used to ask for `subscribers?limit=200&offset=…` with no filters at
      // all, so pressing Export under a segment chip reading 333,533 wrote out
      // the first 10,000 rows of the unfiltered roster and said "Exported
      // 10,000 subscribers". Cursors also mean the last page of the export
      // costs what the first one did instead of walking 10,000 rows to reach it.
      const all: ApiSubscriber[] = [];
      let cursor: string | null = null;
      for (let fetched = 0; fetched < EXPORT_MAX; fetched += EXPORT_PAGE) {
        const qs = new URLSearchParams(filterQs);
        qs.set('limit', String(EXPORT_PAGE));
        qs.set('sort', 'created');
        qs.set('dir', 'desc');
        if (cursor) qs.set('cursor', cursor);
        const res: { items?: ApiSubscriber[]; next_cursor: string | null } = await api.get(
          `subscribers?${qs}`,
        );
        all.push(...(res.items ?? []));
        cursor = res.next_cursor;
        if (!cursor) break;
      }
      const fields = await api
        .get<{ data: CustomField[] }>('custom-fields')
        .then((r) => r.data)
        .catch(() => [] as CustomField[]);
      downloadCsv(exportFilename('subscribers'), subscribersCsv(all, fields));
      showToast(`Exported ${all.length.toLocaleString('en-US')} subscribers`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not export subscribers');
    } finally {
      setExporting(false);
    }
  };

  // Quick action: /dashboard/subscribers?new opens a blank editor.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') == null) return;
    openSubEditor({ mode: 'create' });
    url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  // Legacy pin / bookmark: /dashboard/subscribers?open=<id> used to sit on
  // this table. Pins now go to the subscriber profile.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) window.location.replace(routes.app.subscriber(id));
  }, []);

  // Custom fields feed the import wizard and segment rule builder.
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const customFieldKeys = useMemo(() => customFields.map((f) => f.key), [customFields]);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    void api
      .get<{ data: CustomField[] }>('custom-fields')
      .then((res) => {
        if (alive) setCustomFields(res.data);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [live]);

  const effTags = (s: RichSubscriber): string[] => tagStore[s.id] ?? s.tags;

  /**
   * The tags the filter offers.
   *
   * Live, that is the workspace's tag list (`/v1/tags`) with no counts — the
   * browser holds ten rows, so counting them would describe the page, and
   * offering only the tags those ten carry would hide every other tag in the
   * workspace behind a control that looks complete. Fixtures hold everything,
   * so they still get real counts.
   */
  const tagUniverse = useMemo(() => {
    if (live) {
      return [...tagIndex]
        .map((t) => ({ name: t.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
    const freq = new Map<string, number>();
    for (const s of richSubscribers) {
      for (const t of effTags(s)) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [live, tagIndex, richSubscribers, tagStore]);

  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  // Segments are bound to channels; only show ones declared for the active tab.
  const channelSegments = useMemo(
    () =>
      segments.filter((s) => {
        const chans = s.channels?.length ? s.channels : (['email'] as ChannelType[]);
        return chans.includes(tab);
      }),
    [segments, tab],
  );

  // Drop selections that belong to another channel when the tab changes.
  useEffect(() => {
    const visible = new Set(channelSegments.map((s) => s.id));
    setSegSel((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [channelSegments]);

  // Lists are set up per channel too, so the Lists filter offers the ones this
  // tab can actually send to. Membership editors keep the full set.
  const channelLists = useMemo(
    () =>
      allLists.filter((l) => {
        const chans = l.channels?.length
          ? (l.channels as ChannelType[])
          : (['email'] as ChannelType[]);
        return chans.includes(tab);
      }),
    [allLists, tab],
  );

  useEffect(() => {
    const visible = new Set(channelLists.map((l) => l.id));
    setListFilter((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [channelLists]);

  /* Segment sizes come from the service, which evaluates against every
     subscriber. Counting in the browser would only ever see the loaded page. */
  const refreshCounts = async (segs: SavedSegment[]) => {
    if (!live || segs.length === 0) return;
    const results = await Promise.allSettled(
      segs.map((seg) =>
        api
          .post<{ count: number }>('segments/preview', {
            matchType: seg.matchType,
            rules: toApiRules(seg.rows, customFields),
            limit: 1,
          })
          .then((r) => [seg.id, r.count] as const),
      ),
    );
    setSegCounts((prev) => {
      const next = { ...prev };
      for (const r of results) if (r.status === 'fulfilled') next[r.value[0]] = r.value[1];
      return next;
    });
  };

  useEffect(() => {
    void refreshCounts(segments);
  }, [segments, live, customFields]);

  const segCount = (seg: SavedSegment): number => segCounts[seg.id] ?? 0;

  /* Segment membership is a SQL filter now (?segmentId=), so the rows in hand
     are already the segmented set — and so are `serverTotal` and the tab
     counts. It used to be a client pass over the ~1000 ids /segments/:id/
     subscribers happened to return, which intersected with a 10-row page to
     near nothing: the workspace's "Has phone" segment matches 333,533 people
     and left one row on screen.

     Unlike status/tag/list there is no `!live` counterpart to keep: saved
     segments only exist on a connected workspace (both the segment editor and
     the delete path refuse when `!live`), so fixture mode can never hold a
     selection to filter by. A local pass here would be unreachable code
     pretending to be a filter. */

  /**
   * Tab counts describe the workspace, not the page in hand. Counting the
   * fetched rows was right when the browser held every subscriber; with
   * server-side paging it would report 10. Fetched once per filter set — never
   * per page — because it scans.
   */
  const [serverTabCounts, setServerTabCounts] = useState<Record<string, number> | null>(
    initialCounts as Record<string, number> | null,
  );
  /** Per-status totals for the Status menu, from the same scan as the tabs. */
  const [serverStatusCounts, setServerStatusCounts] = useState<Record<string, number> | null>(
    initialCounts?.byStatus ?? null,
  );
  /**
   * The roster with NO filters, per channel — what the segment row's counts
   * mean, and only that row.
   *
   * Held apart from `serverTabCounts` because the two answer different
   * questions and must be free to differ: the tabs count the current result
   * set, this counts the population. It used to be `initialCounts` read
   * directly at the render site, which froze it at the SSR snapshot for the
   * whole session — import 50,000 people and the tabs moved while the chip did
   * not. Refreshed below without paying a second scan in the common case.
   */
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>(
    (initialCounts as Record<string, number> | null) ?? {},
  );
  /** Bumped by every roster mutation, so the unfiltered counts above refetch. */
  const [rosterVersion, setRosterVersion] = useState(0);
  /* The unfiltered roster, refetched only when it can have changed: an import,
     a delete or a create. Not on every filter change — that is a full scan of
     a million rows to redraw a number that by definition did not move. The
     `rosterVersion === 0` guard skips the first pass entirely, because SSR
     already handed us that exact scan's result. */
  useEffect(() => {
    if (!live || rosterVersion === 0) return;
    let cancelled = false;
    api
      .get<Record<string, number>>('subscribers/counts')
      .then((c) => {
        if (!cancelled) setRosterCounts(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [live, rosterVersion]);
  const fixtureTabCounts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const ch of CHANNEL_ORDER) c[ch] = richSubscribers.filter((s) => reachOf(s)[ch]).length;
    return c;
  }, [richSubscribers]);
  const tabCounts = live ? (serverTabCounts ?? {}) : fixtureTabCounts;

  /**
   * Statuses present on the selected channel, for the Status menu.
   *
   * Counted on the channel reading of each status, so the number beside an
   * option matches the rows the table will show for it.
   */
  const statusCounts = useMemo(() => {
    const c = new Map<SubscriberStatus, number>();
    // Live: counts describe the workspace under the current filters, from the
    // server's single scan. Counting the fetched page would report at most a
    // page's worth — "10 active" on a million-subscriber workspace.
    if (live) {
      // Summed, not assigned. On SMS/WhatsApp/voice `statusForChannel` folds
      // bounced and complained into active, so three server keys land on one
      // menu row; `set` made the last one win and the SMS tab read
      // "Active 10,002" — verbatim the complained count — under a footer of
      // 333,533. The fixture branch below already summed.
      for (const [st, n] of Object.entries(serverStatusCounts ?? {})) {
        const count = Number(n);
        if (count <= 0) continue;
        const shown = statusForChannel(st as SubscriberStatus, tab);
        c.set(shown, (c.get(shown) ?? 0) + count);
      }
      return c;
    }
    for (const s of richSubscribers) {
      if (!reachOf(s)[tab]) continue;
      const st = statusForChannel(s.status, tab);
      c.set(st, (c.get(st) ?? 0) + 1);
    }
    return c;
  }, [live, serverStatusCounts, richSubscribers, tab]);

  /**
   * Menu options: statuses the channel reports, minus the ones nobody here
   * holds. An option that can only ever return nothing is not a filter.
   */
  const statusOptions = useMemo(
    () => channelStatuses(tab).filter((st) => (statusCounts.get(st) ?? 0) > 0),
    [tab, statusCounts],
  );

  // Drop a selected status the new channel doesn't report, so switching tabs
  // can't leave a chip filtering on something invisible in the menu.
  useEffect(() => {
    setStatusFilter((prev) => {
      if (prev.size === 0) return prev;
      const allowed = new Set(channelStatuses(tab));
      const next = new Set([...prev].filter((st) => allowed.has(st)));
      return next.size === prev.size ? prev : next;
    });
  }, [tab]);

  /**
   * Every filter the roster has selected, as query parameters.
   *
   * One object, three consumers — the page query, the counts query and the CSV
   * export — so none of them can be updated without the others. A string, not
   * the params object, because it is also the effect's dependency: a new
   * URLSearchParams every render would refire the fetch on every render.
   */
  const filterQs = useMemo(
    () =>
      rosterFilterParams({
        channel: tab,
        query,
        statuses: statusFilter,
        listIds: listFilter,
        tags: tagSel,
        segmentIds: segSel,
        opens: showOpenFilter ? opensSel : [],
        clicks: showClickFilter ? clicksSel : [],
      }).toString(),
    [
      tab,
      query,
      statusFilter,
      listFilter,
      tagSel,
      segSel,
      opensSel,
      clicksSel,
      showOpenFilter,
      showClickFilter,
    ],
  );

  /**
   * True when `filterQs` narrows nothing — only the channel tab is set. Drives
   * the free refresh of the unfiltered roster count above.
   */
  const isUnfiltered = useMemo(() => {
    for (const key of new URLSearchParams(filterQs).keys()) if (key !== 'channel') return false;
    return true;
  }, [filterQs]);

  /**
   * The server owns every filter the roster offers — channel, status, search,
   * tag, list, segment, open/click rate — plus the sort and the page window.
   * Nothing here narrows a live page any more, which is what lets the footer
   * count and the rows on screen describe the same set.
   */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const cursor = cursorFor[page];
    // Every filter, plus the window. Saved segments and rate buckets are in
    // here like everything else: the API unions the segments and reads the
    // buckets off the `subscriber_engagement` rollup in the same WHERE as the
    // rest, so the rows, the footer count and the tab counts describe one set.
    // Both used to be applied in the browser over the ten rows in hand while
    // the footer went on reporting the unfiltered total — "1–10 of 920,211"
    // above three rows.
    const qs = new URLSearchParams(filterQs);
    qs.set('limit', String(PAGE_SIZE));
    // `created` is the only index-backed key and the API rejects the rest with
    // a 400 — but it serves both DIRECTIONS of it, so the "Subscribed" column
    // is a real whole-roster sort and `serverDir` carries the arrow through.
    // Every other column reorders the page in hand rather than the workspace
    // (sorting a million rows per keystroke is the thing keyset paging exists
    // to avoid), and `sortIsPageScoped` puts that on screen instead of leaving
    // the arrow to imply otherwise.
    qs.set('sort', 'created');
    qs.set('dir', serverDir);
    if (cursor) qs.set('cursor', cursor);
    else if (page > 1) qs.set('page', String(page));
    // No ?withTotal=1. `countSubscribers` is a second independent full scan of
    // the same filtered set, and now that the channel counts honour every
    // filter (status included) `counts[tab]` IS that number — byte-identical in
    // every case measured. Asking for both doubled the cost of a filter change
    // (235ms vs 128ms for opens=high) to compute the same integer twice.
    if (page === 1) {
      api
        .get<Record<string, number> & { byStatus?: Record<string, number> }>(
          `subscribers/counts?${filterQs}`,
        )
        .then((c) => {
          if (cancelled) return;
          setServerTabCounts(c);
          if (c.byStatus) setServerStatusCounts(c.byStatus);
          // With nothing narrowing the set, this scan IS the unfiltered
          // roster, so the segment row's population count refreshes for free.
          // `channel` is not a narrowing filter — it names the tab, and
          // `/subscribers/counts` returns all four channel totals regardless
          // of it (it scopes only `byStatus`). Every other key
          // `rosterFilterParams` can set is.
          if (isUnfiltered) setRosterCounts(c);
          // The active tab's count is the footer's total: same filters, same
          // scan, one request instead of two.
          const n = Number(c[tab] ?? 0);
          if (Number.isFinite(n)) setServerTotal(n);
        })
        .catch(() => undefined);
    }
    setLoadingPage(true);
    api
      .get<{
        items: ApiSubscriber[];
        next_cursor: string | null;
        has_more: boolean;
      }>(`subscribers?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setRichSubscribers(toRichSubscribers(res.items ?? []));
        setHasMore(Boolean(res.has_more));
        // Remember the doorway to the following page so Next stays keyset.
        if (res.next_cursor) setCursorFor((m) => ({ ...m, [page + 1]: res.next_cursor! }));
      })
      .catch(() => {
        /* keep the current page rather than blanking the table */
      })
      .finally(() => {
        if (!cancelled) setLoadingPage(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, page, tab, filterQs, isUnfiltered, serverDir]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = richSubscribers.filter((s) => {
      // Fixtures only, like every other pass below. `reachOf` requires a
      // non-empty email while the server's email predicate is `email <> ''` —
      // the same rule, but re-deciding it here means any future divergence
      // silently deletes rows the footer has already counted.
      if (!live && !reachOf(s)[tab]) return false;
      if (!live && statusFilter.size > 0 && !statusFilter.has(statusForChannel(s.status, tab)))
        return false;
      // Search is a SQL predicate on a live workspace, and NOT the same one:
      // the server matches `lower(email) like %q%` or the same on name, while
      // `matchesSearchQuery` is word/prefix-only on the name. Any mid-word name
      // hit survived the server and died here — q="ubscriber" against "Perf
      // Subscriber 786940" returned 10 rows and a total of 1,000,000, and the
      // screen said "No subscribers match your filters" over a 100,000-page
      // pager. It also matches tags, which the server does not, so it was not a
      // superset in either direction.
      if (!live && q) {
        const hit =
          matchesSearchQuery(s.name, q) ||
          s.email.toLowerCase().includes(q) ||
          effTags(s).some((t) => matchesSearchQuery(t, q));
        if (!hit) return false;
      }
      if (!live && listFilter.size > 0 && !s.listIds.some((id) => listFilter.has(id))) return false;
      if (!live && tagSel.size > 0 && !effTags(s).some((t) => tagSel.has(t))) return false;
      // Fixtures only, like the status/list/tag passes above it. Live, the rate
      // bucket is a WHERE clause on the rollup, so re-deciding it here from the
      // rendered percentage would at best agree and at worst hide rows the
      // footer has already counted.
      if (
        !live &&
        showOpenFilter &&
        opensSel.size &&
        !opensSel.has(fixtureEngagementBucket(s.opens))
      )
        return false;
      if (
        !live &&
        showClickFilter &&
        clicksSel.size &&
        !clicksSel.has(fixtureEngagementBucket(s.clicks))
      )
        return false;
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let av: number | string;
      let bv: number | string;
      if (key === 'name') {
        av = a.name.toLowerCase();
        bv = b.name.toLowerCase();
      } else if (key === 'opens') {
        av = parseRatePercent(a.opens);
        bv = parseRatePercent(b.opens);
      } else if (key === 'clicks') {
        av = parseRatePercent(a.clicks);
        bv = parseRatePercent(b.clicks);
      } else if (key === 'tags') {
        av = effTags(a).length;
        bv = effTags(b).length;
      } else if (key === 'status') {
        av = statusForChannel(a.status, tab);
        bv = statusForChannel(b.status, tab);
      } else if (key === 'subscribed') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        /* key === 'last'. The column below renders `lastActiveAt`, so the sort
           reads it too — sorting on `updatedAt` under a "Last activity" arrow
           would reorder the page by a number the page does not show. Never
           messaged sorts as the far past rather than as "now": a subscriber
           with no messages is the least recently active, not the most.

           SCOPE, not just value: live, `list` is the ten rows the server
           returned in `created_at` order, so this comparator reorders those and
           no others. That is stated on screen by `sortIsPageScoped` — fixing
           the value without saying so is what turned a visibly inert sort
           (every row's `updated_at` was the same day) into a plausible-looking
           wrong one. */
        av = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : -Infinity;
        bv = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : -Infinity;
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [
    live,
    richSubscribers,
    tab,
    query,
    statusFilter,
    listFilter,
    tagSel,
    opensSel,
    clicksSel,
    sort,
    tagStore,
    showOpenFilter,
    showClickFilter,
  ]);

  // Live: the API already returned exactly this page, and `serverTotal` counts
  // every match. Fixtures keep the old in-memory slice.
  const totalRows = live ? serverTotal : filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = live
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagerPages = visiblePageNumbers(safePage, pageCount);

  const resetPageAndSel = () => {
    setPage(1);
    setCursorFor({});
    setSelected(new Set());
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
    // Clears `cursorFor` as well as the page, which is what lets `serverDir`
    // below flip safely: a cursor minted walking one direction is not a resume
    // point for the other.
    resetPageAndSel();
  };
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');


  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pageAllChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAllPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllChecked) pageRows.forEach((r) => next.delete(r.id));
      else pageRows.forEach((r) => next.add(r.id));
      return next;
    });

  const toggleListFilter = (id: string) => {
    setListFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    resetPageAndSel();
  };

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>) => (v: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    resetPageAndSel();
  };

  const toggleRateBucket = (kind: 'opens' | 'clicks', bucket: string) => {
    const setter = kind === 'opens' ? setOpensSel : setClicksSel;
    setter((prev) => {
      const next = new Set(prev);
      next.delete(bucket);
      return next;
    });
    resetPageAndSel();
  };

  const toggleTag = (t: string) => {
    setTagSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    resetPageAndSel();
  };

  const toggleSeg = (id: string) => {
    setSegSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    resetPageAndSel();
  };

  const bulk = (verb: string) => {
    const n = selected.size;
    showToast(`${verb} ${n} subscriber${n === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  /* Delete by id list — persists to the service in live mode, else local-only. */
  const removeSubscribers = async (ids: string[]) => {
    if (ids.length === 0) return;
    const doomed = new Set(ids);
    if (!live) {
      setRichSubscribers((prev) => prev.filter((s) => !doomed.has(s.id)));
      showToast(`Removed ${ids.length} subscriber${ids.length === 1 ? '' : 's'}`);
      setSelected((prev) => new Set([...prev].filter((id) => !doomed.has(id))));
      if (openId && doomed.has(openId)) setOpenId(null);
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`subscribers/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setRichSubscribers((prev) => prev.filter((s) => !okIds.has(s.id)));
    // The roster shrank: the segment row's population count has to follow.
    if (okIds.size > 0) setRosterVersion((v) => v + 1);
    setSelected((prev) => new Set([...prev].filter((id) => !okIds.has(id))));
    if (openId && okIds.has(openId)) setOpenId(null);
    const failed = ids.length - okIds.size;
    showToast(
      failed
        ? `Removed ${okIds.size}, ${failed} failed`
        : `Removed ${okIds.size} subscriber${okIds.size === 1 ? '' : 's'}`,
    );
  };

  const filterByTag = (tag: string) => {
    if (!tagSel.has(tag)) toggleTag(tag);
    setOpenId(null);
    showToast(`Filtered by “${tag}”`);
  };

  const clearAll = () => {
    setSegSel(new Set());
    setStatusFilter(new Set());
    setTagSel(new Set());
    setListFilter(new Set());
    setOpensSel(new Set());
    setClicksSel(new Set());
    setQuery('');
    resetPageAndSel();
  };

  /* Esc closes drawer/modal. */
  useEscapeClose(() => {
    if (segModal.open) setSegModal({ open: false, edit: null });
    else if (openId) setOpenId(null);
  });

  /* Tags go through the real tag relation, not the attributes blob. Segment
     rules match on that relation, so a tag written anywhere else would be
     invisible to the very segments built from it. Unknown names are created as
     workspace tags first. */
  const saveTags = async (id: string, tags: string[]) => {
    if (!live) {
      setTagStore((prev) => ({ ...prev, [id]: tags }));
      showToast('Tags saved');
      return;
    }
    const sub = richSubscribers.find((s) => s.id === id);
    const before = sub?.tags ?? [];
    const added = tags.filter((t) => !before.includes(t));
    const removed = before.filter((t) => !tags.includes(t));
    try {
      const known = new Map(tagIndex.map((t) => [t.name.toLowerCase(), t.id]));
      for (const name of added) {
        let tagId = known.get(name.toLowerCase());
        if (!tagId) {
          const created = await api.post<{ id: string; name: string }>('tags', { name });
          tagId = created.id;
          known.set(name.toLowerCase(), tagId);
          setTagIndex((prev) => [...prev, created]);
        }
        await api.post(`subscribers/${id}/tags/${tagId}`, {});
      }
      for (const name of removed) {
        const tagId = known.get(name.toLowerCase());
        if (tagId) await api.del(`subscribers/${id}/tags/${tagId}`);
      }
      setRichSubscribers((prev) => prev.map((s) => (s.id === id ? { ...s, tags } : s)));
      showToast('Tags saved');
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save tags');
    }
  };

  /* Segments are workspace resources: they persist to the service so teammates
     see them, rather than living in this browser's localStorage. */
  const saveSegment = async (seg: SavedSegment) => {
    const body = {
      name: seg.name,
      matchType: seg.matchType,
      rules: toApiRules(seg.rows, customFields),
      channels: seg.channels,
    };
    if (!live) {
      showToast('Not connected to workers');
      return;
    }
    try {
      const editing = segments.some((s) => s.id === seg.id);
      const saved = editing
        ? await api.patch<ApiSegment>(`segments/${seg.id}`, body)
        : await api.post<ApiSegment>('segments', body);
      const mapped = toSavedSegment(saved);
      setSegments((prev) =>
        editing ? prev.map((s) => (s.id === mapped.id ? mapped : s)) : [...prev, mapped],
      );
      // A fresh Set even when the id was already selected: the page effect keys
      // off `segSel`, and edited rules mean a different set of rows.
      setSegSel((prev) => new Set(prev).add(mapped.id));
      setSegModal({ open: false, edit: null });
      resetPageAndSel();
      showToast(`Segment “${mapped.name}” ${editing ? 'updated' : 'created'}`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save segment');
    }
  };

  const deleteSegment = async (id: string) => {
    const name = segById.get(id)?.name ?? 'Segment';
    if (!live) {
      showToast('Not connected to workers');
      return;
    }
    try {
      await api.del(`segments/${id}`);
      setSegments((prev) => prev.filter((s) => s.id !== id));
      setSegSel((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
      setSegModal({ open: false, edit: null });
      showToast(`Segment “${name}” deleted`);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not delete segment');
    }
  };

  const openSub = openId ? (richSubscribers.find((s) => s.id === openId) ?? null) : null;

  const startIdx = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, totalRows);

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Subscribers</h1>
          <p className="screen__sub">Everyone across your lists and segments.</p>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="sbtn"
            disabled={exporting}
            onClick={() => void exportSubscribers()}
          >
            <Icon name="download" size={15} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button type="button" className="pbtn" onClick={() => openSubEditor({ mode: 'create' })}>
            <Icon name="plus" size={15} stroke={2.2} />
            Add subscriber
          </button>
        </div>
      </div>

      {/* Saved segments — scoped to the active channel tab below.
          Every number in this row is a POPULATION: the size of the set each
          chip selects, on this channel, ignoring the search and filters in the
          toolbar underneath. That is what makes "All subscribers 1,000,229"
          legitimately sit above a tab reading "Email 111" under an active
          search — but only if the row says so, which the caption does. Segment
          sizes come from /segments/preview, which ignores the other filters
          too, so the row is one consistent reading. */}
      <p className={styles.segcaption} id="segrow-basis">
        Segment sizes — the whole {CHANNEL[tab].label.toLowerCase()} roster, before the filters
        below.
      </p>
      <div
        className={styles.segrow}
        role="group"
        aria-describedby="segrow-basis"
        aria-label="Saved segments"
      >
        <button
          type="button"
          className={`${styles.seg}${segSel.size === 0 ? ' is-on' : ''}`}
          onClick={() => {
            setSegSel(new Set());
            resetPageAndSel();
          }}
          aria-pressed={segSel.size === 0}
        >
          All subscribers
          {/* `rosterCounts`, not `tabCounts`: following the tabs would make this
              chip report the SELECTED segment's size under a label that says the
              opposite. Not `initialCounts` either — that is the SSR scan, frozen
              for the session, so an import moved the tabs and left this behind.
              (Before that it read `richSubscribers.filter(...).length`, the ten
              rows in hand: 10, beside a segment chip reading 333,533.) */}
          <span className={`${styles.segn} tnum`}>
            {(live ? (rosterCounts[tab] ?? 0) : (fixtureTabCounts[tab] ?? 0)).toLocaleString(
              'en-US',
            )}
          </span>
        </button>
        {channelSegments.map((seg) => {
          const on = segSel.has(seg.id);
          return (
            <span key={seg.id} className={`${styles.segwrap}${on ? ' is-on' : ''}`}>
              <button
                type="button"
                className={`${styles.seg}${on ? ' is-on' : ''}`}
                onClick={() => toggleSeg(seg.id)}
                aria-pressed={on}
              >
                {seg.name}
                <span className={`${styles.segn} tnum`}>
                  {segCount(seg).toLocaleString('en-US')}
                </span>
              </button>
              {seg.custom && (
                <button
                  type="button"
                  className={styles.segedit}
                  title={`Edit ${seg.name}`}
                  aria-label={`Edit ${seg.name}`}
                  onClick={() => setSegModal({ open: true, edit: seg })}
                >
                  <Icon name="edit" size={12} />
                </button>
              )}
            </span>
          );
        })}
        <button
          type="button"
          className={styles.segnew}
          onClick={() => setSegModal({ open: true, edit: null })}
        >
          <Icon name="plus" size={13} stroke={2.2} />
          New segment
        </button>
      </div>

      <div className={`atable ${styles.card}`}>
        {/* channel tabs — who can actually be reached on each channel */}
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
                  resetPageAndSel();
                }}
              >
                <Icon name={m.icon} size={13} />
                {m.label}
                {/* Grouped like every other figure on the screen. This one
                    rendered raw — "Email 1000229" directly under a chip
                    reading "1,000,229", the same number twice in two
                    notations. */}
                <span className="atab__count tnum">
                  {(tabCounts[ch] ?? 0).toLocaleString('en-US')}
                </span>
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
                placeholder="Search by name, email or tag…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPageAndSel();
                }}
                aria-label="Search subscribers"
              />
            </label>

            <div className={styles.filterwrap}>
              <button
                type="button"
                className={`${styles.filter}${statusFilter.size ? ' is-on' : ''}`}
                aria-expanded={statusOpen}
                aria-haspopup="true"
                onClick={() => setStatusOpen((v) => !v)}
              >
                <Icon name="filter" size={14} />
                Status
                {statusFilter.size > 0 && (
                  <span className={`${styles.filtercount} tnum`}>{statusFilter.size}</span>
                )}
                <Icon name="chevron-down" size={12} className={styles.filtercaret} />
              </button>
              {statusOpen && (
                <>
                  <button
                    type="button"
                    className={styles.scrim}
                    aria-label="Close"
                    onClick={() => setStatusOpen(false)}
                  />
                  <div className={styles.pop} style={{ animation: 'pop .14s ease' }} role="menu">
                    <div className={styles.poptitle}>Status</div>
                    {statusOptions.map((st) => {
                      const on = statusFilter.has(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          className={styles.popopt}
                          onClick={() => {
                            setStatusFilter((prev) => {
                              const next = new Set(prev);
                              if (next.has(st)) next.delete(st);
                              else next.add(st);
                              return next;
                            });
                            resetPageAndSel();
                          }}
                        >
                          <span className={`${styles.box}${on ? ' is-on' : ''}`}>
                            {on && <Icon name="check" size={15} stroke={3.5} />}
                          </span>
                          <StatusChip status={st} />
                          <span className={`${styles.popcount} tnum`}>{statusCounts.get(st)}</span>
                        </button>
                      );
                    })}
                    {statusFilter.size > 0 && (
                      <button
                        type="button"
                        className={styles.popclear}
                        onClick={() => {
                          setStatusFilter(new Set());
                          resetPageAndSel();
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className={styles.filterwrap}>
              <button
                type="button"
                className={`${styles.filter}${listFilter.size ? ' is-on' : ''}`}
                aria-expanded={listOpen}
                aria-haspopup="true"
                disabled={listsFetched && channelLists.length === 0}
                onClick={() => {
                  loadLists();
                  setListOpen((v) => !v);
                }}
              >
                <Icon name="lists" size={14} />
                Lists
                {listFilter.size > 0 && (
                  <span className={`${styles.filtercount} tnum`}>{listFilter.size}</span>
                )}
                <Icon name="chevron-down" size={12} className={styles.filtercaret} />
              </button>
              {listOpen && (
                <>
                  <button
                    type="button"
                    className={styles.scrim}
                    aria-label="Close"
                    onClick={() => setListOpen(false)}
                  />
                  <div className={styles.pop} style={{ animation: 'pop .14s ease' }} role="menu">
                    <div className={styles.poptitle}>On list</div>
                    {/* The menu holds a bounded slice, so finding a list beyond
                        it is a server search rather than a longer list. */}
                    <input
                      className={styles.popsearch}
                      value={listSearch}
                      placeholder="Search lists…"
                      aria-label="Search lists"
                      autoFocus
                      onChange={(e) => {
                        setListSearch(e.target.value);
                        fetchLists(e.target.value);
                      }}
                    />
                    {channelLists.length === 0 && (
                      <div className={styles.popempty}>No lists match.</div>
                    )}
                    {channelLists.map((l) => {
                      const on = listFilter.has(l.id);
                      const color = l.color || tagStyle(l.name).color;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          className={styles.popopt}
                          onClick={() => toggleListFilter(l.id)}
                        >
                          <span className={`${styles.box}${on ? ' is-on' : ''}`}>
                            {on && <Icon name="check" size={15} stroke={3.5} />}
                          </span>
                          <span className={styles.listfdot} style={{ background: color }} />
                          <span className={styles.popname} title={l.name}>
                            {l.name}
                          </span>
                        </button>
                      );
                    })}
                    {listFilter.size > 0 && (
                      <button
                        type="button"
                        className={styles.popclear}
                        onClick={() => {
                          setListFilter(new Set());
                          resetPageAndSel();
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <TagFilter
              tags={tagUniverse}
              selected={tagSel}
              onToggle={toggleTag}
              onClear={() => {
                setTagSel(new Set());
                resetPageAndSel();
              }}
            />

            {showOpenFilter && (
              <ColFilter
                label={openFilterLabel}
                icon="eye"
                options={ENGAGEMENT_BUCKET_SLUGS}
                optionLabel={engagementBucketLabel}
                selected={opensSel}
                onToggle={toggleSet(setOpensSel)}
                onClear={() => {
                  setOpensSel(new Set());
                  resetPageAndSel();
                }}
                open={rateFilterOpen === 'opens'}
                onOpenToggle={() => setRateFilterOpen((o) => (o === 'opens' ? null : 'opens'))}
              />
            )}
            {showClickFilter && (
              <ColFilter
                label="Clicks"
                icon="target"
                options={ENGAGEMENT_BUCKET_SLUGS}
                optionLabel={engagementBucketLabel}
                selected={clicksSel}
                onToggle={toggleSet(setClicksSel)}
                onClear={() => {
                  setClicksSel(new Set());
                  resetPageAndSel();
                }}
                open={rateFilterOpen === 'clicks'}
                onOpenToggle={() => setRateFilterOpen((o) => (o === 'clicks' ? null : 'clicks'))}
              />
            )}

            <div className={styles.spacer} />

            <div className="aseg sb__viewseg" role="group" aria-label="View mode">
              {(['table', 'compact'] as ViewMode[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  className={`aseg__opt${view === v ? ' is-active' : ''}`}
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                >
                  {v[0].toUpperCase() + v.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <FilterChipsRow
            chips={[
              ...[...segSel].flatMap((id) => {
                const seg = segById.get(id);
                if (!seg) return [];
                return [
                  {
                    key: `seg:${id}`,
                    label: `Segment: ${seg.name}`,
                    onRemove: () => toggleSeg(id),
                  },
                ];
              }),
              ...[...statusFilter].map((st) => {
                return {
                  key: `status:${st}`,
                  label: STATUS_LABEL[st],
                  style: STATUS_CHIP_STYLE[st],
                  onRemove: () => {
                    setStatusFilter((prev) => {
                      const next = new Set(prev);
                      next.delete(st);
                      return next;
                    });
                    resetPageAndSel();
                  },
                };
              }),
              ...[...listFilter].map((id) => {
                const l = allLists.find((x) => x.id === id);
                const name = l?.name ?? id;
                const color = l?.color || tagStyle(name).color;
                return {
                  key: `list:${id}`,
                  label: `List: ${name}`,
                  onRemove: () => toggleListFilter(id),
                  style: {
                    background: `color-mix(in srgb, ${color} 14%, transparent)`,
                    color,
                  },
                };
              }),
              ...[...tagSel].map((t) => ({
                key: `tag:${t}`,
                label: `Tag: ${t}`,
                onRemove: () => toggleTag(t),
                style: tagStyle(t),
              })),
              ...(showOpenFilter
                ? [...opensSel].map((b) => ({
                    key: `opens:${b}`,
                    label: `${openFilterLabel}: ${engagementBucketLabel(b)}`,
                    onRemove: () => toggleRateBucket('opens', b),
                  }))
                : []),
              ...(showClickFilter
                ? [...clicksSel].map((b) => ({
                    key: `clicks:${b}`,
                    label: `Clicks: ${engagementBucketLabel(b)}`,
                    onRemove: () => toggleRateBucket('clicks', b),
                  }))
                : []),
            ]}
            onClearAll={clearAll}
          />
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={`${styles.bulkcount} tnum`}>{selected.size} selected</span>
            <span className={styles.bulkdiv} />
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Tagged')}>
              <Icon name="star" size={13} />
              Tag
            </button>
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Added')}>
              <Icon name="filter" size={13} />
              Add to segment
            </button>
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Exporting')}>
              <Icon name="download" size={13} />
              Export
            </button>
            <button
              type="button"
              className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
              onClick={() => setConfirmDelete([...selected])}
            >
              <Icon name="trash" size={13} />
              Remove
            </button>
            <button
              type="button"
              className={styles.bulkclear}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        {/* TABLE VIEW */}
        {view === 'table' && (
          <>
            <div className={`athead ${styles.grid}`} style={{ gridTemplateColumns: tableGridCols }}>
              <div className={styles.check}>
                <button
                  type="button"
                  className={`${styles.box}${pageAllChecked ? ' is-on' : ''}`}
                  onClick={toggleAllPage}
                  aria-label="Select all on page"
                  aria-pressed={pageAllChecked}
                >
                  {pageAllChecked && <Icon name="check" size={15} stroke={3.5} />}
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'name' ? 'is-active' : undefined}
                  onClick={() => toggleSort('name')}
                  title={live ? PAGE_SORT_NOTE : undefined}
                >
                  Subscriber <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              {showOpenFilter && (
                <div className={styles.colCenter}>
                  <button
                    type="button"
                    className={sort.key === 'opens' ? 'is-active' : undefined}
                    onClick={() => toggleSort('opens')}
                    title={live ? PAGE_SORT_NOTE : undefined}
                  >
                    Avg. {tabCfg.openLabel === 'Seen' ? 'seen' : 'open'}{' '}
                    <span className="tnum">{sortArrow('opens')}</span>
                  </button>
                </div>
              )}
              {showClickFilter && (
                <div className={styles.colCenter}>
                  <button
                    type="button"
                    className={sort.key === 'clicks' ? 'is-active' : undefined}
                    onClick={() => toggleSort('clicks')}
                    title={live ? PAGE_SORT_NOTE : undefined}
                  >
                    Avg. click <span className="tnum">{sortArrow('clicks')}</span>
                  </button>
                </div>
              )}
              <div>
                <button
                  type="button"
                  className={sort.key === 'tags' ? 'is-active' : undefined}
                  onClick={() => toggleSort('tags')}
                  title={live ? PAGE_SORT_NOTE : undefined}
                >
                  Tags <span className="tnum">{sortArrow('tags')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'status' ? 'is-active' : undefined}
                  onClick={() => toggleSort('status')}
                  title={live ? PAGE_SORT_NOTE : undefined}
                >
                  Status <span className="tnum">{sortArrow('status')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'subscribed' ? 'is-active' : undefined}
                  onClick={() => toggleSort('subscribed')}
                  title={
                    live
                      ? 'Sorts the whole roster — this is the key the server pages on.'
                      : undefined
                  }
                >
                  Subscribed <span className="tnum">{sortArrow('subscribed')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'last' ? 'is-active' : undefined}
                  onClick={() => toggleSort('last')}
                  title={live ? PAGE_SORT_NOTE : undefined}
                >
                  {/* `lastActiveAt` — `max(coalesce(read_at, delivered_at,
                      sent_at, submitted_at, created_at))` over this person's
                      messages, joined per page in `withRelations`. It used to
                      render `subscribers.updated_at`, which is when the ROW was
                      last written: perf767230@p31.perf-maildrill.test showed
                      2026-08-16 against a last message of 2025-11-05, so a tag
                      edit read as activity. Same expression the drawer's "Last
                      active" reduces, so the two agree by construction. */}
                  Last activity <span className="tnum">{sortArrow('last')}</span>
                </button>
              </div>
            </div>

            {pageRows.length === 0 ? (
              <div className="atable__empty">No subscribers match your filters.</div>
            ) : (
              pageRows.map((s) => (
                <div
                  key={s.id}
                  className={`atrow ${styles.grid}${selected.has(s.id) ? ' is-selected' : ''}`}
                  style={{ gridTemplateColumns: tableGridCols }}
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(s.id);
                    }
                  }}
                >
                  <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`${styles.box}${selected.has(s.id) ? ' is-on' : ''}`}
                      onClick={() => toggleSelect(s.id)}
                      aria-label={`Select ${s.name}`}
                      aria-pressed={selected.has(s.id)}
                    >
                      {selected.has(s.id) && <Icon name="check" size={15} stroke={3.5} />}
                    </button>
                  </div>
                  <div className={styles.idcell}>
                    <Avatar sub={s} size={32} />
                    <div className={styles.idtext}>
                      <div className={styles.name}>{s.name}</div>
                      <div className={styles.email}>{s.email}</div>
                    </div>
                  </div>
                  {showOpenFilter && <div className={`tnum ${styles.rate}`}>{s.opens}</div>}
                  {showClickFilter && <div className={`tnum ${styles.rate}`}>{s.clicks}</div>}
                  <div className={styles.tagcell}>
                    {effTags(s).length === 0 ? (
                      <span className={styles.dash}>—</span>
                    ) : (
                      effTags(s).map((t) => (
                        <span key={t} className={styles.tag} style={tagStyle(t)}>
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                  <div className={styles.colCenter}>
                    <StatusChip status={statusForChannel(s.status, tab)} />
                  </div>
                  <TimeAgo className={styles.last} at={s.createdAt} />
                  {s.lastActiveAt ? (
                    <TimeAgo className={styles.last} at={s.lastActiveAt} />
                  ) : (
                    <div
                      className={styles.last}
                      title="No message has ever been sent to this subscriber"
                    >
                      Never
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* COMPACT VIEW */}
        {view === 'compact' &&
          (pageRows.length === 0 ? (
            <div className="atable__empty">No subscribers match your filters.</div>
          ) : (
            pageRows.map((s) => (
              <div
                key={s.id}
                className={`${styles.compact}${selected.has(s.id) ? ' is-selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setOpenId(s.id);
                  }
                }}
              >
                <Avatar sub={s} size={26} />
                <span className={styles.cname}>{s.name}</span>
                <span className={styles.cemail}>{s.email}</span>
                <StatusChip status={statusForChannel(s.status, tab)} />
                {s.lastActiveAt ? (
                  <TimeAgo className={`${styles.last} ${styles.clast}`} at={s.lastActiveAt} />
                ) : (
                  <span
                    className={`${styles.last} ${styles.clast}`}
                    title="No message has ever been sent to this subscriber"
                  >
                    Never
                  </span>
                )}
              </div>
            ))
          ))}

        {/* footer / pagination */}
        <div className={`atable__foot ${styles.foot}`}>
          <span className={filtered.length === 0 ? undefined : 'tnum'}>
            {filtered.length === 0
              ? 'No subscribers match your filters'
              : `${startIdx}–${endIdx} of ${totalRows.toLocaleString('en-US')} subscribers${loadingPage ? ' · loading…' : ''}`}
          </span>
          {/* The arrow in the header says "sorted"; this says by how much of the
              set. `pageRows = filtered` is one keyset page in live mode, so every
              column but "Subscribed" reorders those rows and nothing else —
              which read as a working sort the moment "Last activity" started
              showing real, varying timestamps. See `sortIsPageScoped`. */}
          {sortIsPageScoped && filtered.length > 0 && (
            <span className={styles.sortScope} title={PAGE_SORT_NOTE}>
              Sorted within this page
            </span>
          )}
          {pageCount > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pg}
                disabled={safePage === 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setSelected(new Set());
                }}
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
                  onClick={() => {
                    setPage(n);
                    setSelected(new Set());
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pg}
                disabled={live ? !hasMore : safePage === pageCount}
                onClick={() => {
                  setPage((p) => Math.min(pageCount, p + 1));
                  setSelected(new Set());
                }}
                aria-label="Next page"
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {openSub && (
        <SubscriberDrawer
          sub={openSub}
          tags={effTags(openSub)}
          reach={reachOf(openSub)}
          live={live}
          onClose={() => setOpenId(null)}
          onSaveTags={saveTags}
          onFilterTag={filterByTag}
          onEdit={() => {
            const sub = openSub;
            setOpenId(null);
            openSubEditor({ mode: 'edit', sub });
          }}
          onDelete={() => setConfirmDelete([openSub.id])}
        />
      )}

      {subEditor?.mode === 'create' && (
        <SubscriberImportModal
          lists={allLists}
          customFieldKeys={customFieldKeys}
          live={live}
          onClose={() => setSubEditor(null)}
          onError={showToast}
          onImported={async (outcome, newFields) => {
            if (newFields.length) {
              if (live) {
                const res = await api
                  .get<{ data: CustomField[] }>('custom-fields')
                  .catch(() => null);
                if (res) setCustomFields(res.data);
              } else {
                setCustomFields((prev) => [
                  ...prev,
                  ...newFields
                    .filter((k) => !prev.some((f) => f.key === k))
                    .map((key) => ({
                      id: key,
                      key,
                      label: key,
                      type: 'text' as const,
                      createdAt: new Date().toISOString(),
                    })),
                ]);
              }
            }
            if (!live) {
              showToast(`${outcome.created.toLocaleString('en-US')} subscribers imported`);
              return;
            }
            const fresh = await api.get<{ items: ApiSubscriber[] }>('subscribers?limit=100');
            setRichSubscribers((fresh.items ?? []).map(toRichSubscriber));
            setRosterVersion((v) => v + 1);
          }}
          onCreated={async (created, values) => {
            if (created) {
              setRichSubscribers((prev) => [toRichSubscriber(created), ...prev]);
              setRosterVersion((v) => v + 1);
            }
            showToast(`${values.email} added`);
          }}
        />
      )}

      {subEditor?.mode === 'edit' && (
        <SubscriberEditorModal
          mode="edit"
          initialEmail={subEditor.sub.email}
          initialPhone={subEditor.sub.phone}
          initialName={subEditor.sub.name}
          initialStatus={subEditor.sub.status}
          initialListIds={subEditor.sub.listIds}
          initialTags={effTags(subEditor.sub)}
          lists={allLists}
          customFieldKeys={customFieldKeys}
          onClose={() => setSubEditor(null)}
          onSave={async (values) => {
            if (!live) {
              saveTags(subEditor.sub.id, values.tags);
              setSubEditor(null);
              showToast(`${values.name || values.email} updated`);
              return;
            }
            try {
              await api.patch<ApiSubscriber>(`subscribers/${subEditor.sub.id}`, {
                name: values.name || null,
                phone: values.phone || null,
                status: values.status,
                attributes: {
                  tags: values.tags,
                  ...(subEditor.sub.location !== '—' ? { location: subEditor.sub.location } : {}),
                },
              });
              await applyListMembership(subEditor.sub.id, subEditor.sub.listIds, values.listIds);
              const fresh = await api.get<ApiSubscriber>(`subscribers/${subEditor.sub.id}`);
              setRichSubscribers((prev) =>
                prev.map((s) => (s.id === subEditor.sub.id ? toRichSubscriber(fresh) : s)),
              );
              setSubEditor(null);
              showToast(`${values.name || values.email} updated`);
            } catch (e) {
              showToast(e instanceof ApiError ? e.message : 'Could not save subscriber');
            }
          }}
        />
      )}

      {segModal.open && (
        <SegmentModal
          key={segModal.edit?.id ?? `new-${tab}`}
          edit={segModal.edit}
          defaultChannel={tab}
          onClose={() => setSegModal({ open: false, edit: null })}
          onSave={saveSegment}
          onDelete={(id) => setConfirmSegment({ id, name: segById.get(id)?.name ?? 'Segment' })}
          lists={allLists}
          tags={allTags}
          customFields={customFields}
          live={live}
        />
      )}

      {confirmSegment && (
        <ConfirmDialog
          title={`Delete “${confirmSegment.name}”?`}
          message="The segment is removed. Subscribers that matched it are not affected."
          confirmLabel="Delete segment"
          onCancel={() => setConfirmSegment(null)}
          onConfirm={() => {
            const target = confirmSegment;
            setConfirmSegment(null);
            void deleteSegment(target.id);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.length} subscriber${confirmDelete.length === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const ids = confirmDelete;
            setConfirmDelete(null);
            void removeSubscribers(ids);
          }}
        />
      )}

      {toast && (
        <div
          className={styles.toast}
          style={{ animation: 'toastin .22s cubic-bezier(.2,.8,.2,1)' }}
          role="status"
        >
          <span className={styles.toastic}>
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}

function StatusChip({ status }: { status: SubscriberStatus }) {
  return <span className={`astatus astatus--${status}`}>{STATUS_LABEL[status]}</span>;
}

function Avatar({ sub, size }: { sub: RichSubscriber; size: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        flex: 'none',
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size < 30 ? 10 : size < 44 ? 12 : 20,
        fontWeight: 600,
        background: `linear-gradient(135deg, ${sub.av[0]}, ${sub.av[1]})`,
      }}
    >
      {initials(sub.name)}
    </span>
  );
}

/* ----------------------------- Details drawer ----------------------------- */
type ApiSubscriberActivity = {
  lastActiveAt: string | null;
  channels: {
    channel: ChannelType;
    sent: number;
    delivered: number;
    read: number;
    clicked?: number;
    failed?: number;
  }[];
};

function SubscriberDrawer({
  sub,
  tags,
  reach,
  live,
  onClose,
  onSaveTags,
  onFilterTag,
  onEdit,
  onDelete,
}: {
  sub: RichSubscriber;
  tags: string[];
  reach: Record<ChannelType, boolean>;
  live: boolean;
  onClose: () => void;
  onSaveTags: (id: string, tags: string[]) => void;
  onFilterTag: (tag: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState('');

  // Real engagement + activity from the service (live workspaces only). The
  // drawer remounts per subscriber (keyed by id), so a plain mount fetch is fine.
  const [act, setAct] = useState<ApiSubscriberActivity | null>(null);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    void api
      .get<ApiSubscriberActivity>(`subscribers/${sub.id}/activity`)
      .then((a) => {
        if (alive) setAct(a);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [live, sub.id]);

  // Tags persist as you edit: adding (Enter) or removing a tag saves the whole
  // set immediately. onSaveTags diffs it against the server, so passing the
  // full next array applies just the delta.
  const addTag = () => {
    const v = input.trim();
    setInput('');
    if (!v || draft.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    const next = [...draft, v];
    setDraft(next);
    onSaveTags(sub.id, next);
  };
  const removeTag = (t: string) => {
    const next = draft.filter((x) => x !== t);
    setDraft(next);
    onSaveTags(sub.id, next);
  };

  const statusLabel = STATUS_LABEL[sub.status];

  type ChanMetric = { label: string; value: string; alert?: boolean };
  type ChanRow = {
    ch: ChannelType;
    on: boolean;
    meta: string;
    /** Hover expansion of `meta` — what the profile's "Including failures" says. */
    metaTitle?: string;
    metrics: ChanMetric[];
  };

  /* "Last active" is the most recent real message timestamp, from
     /subscribers/:id/activity. Until that lands it is "—" rather than a
     stand-in: the roster row's own `lastActiveAt` is the same fact from the
     same expression, but the drawer opens before the fetch resolves and a
     value that changes meaning mid-render is worse than a dash. It used to
     fall back to `ago(sub.updatedAt)` — the row-write clock, measured against a
     frozen fixture instant. */
  const lastActive = act ? (act.lastActiveAt ? agoNow(act.lastActiveAt) : 'Never') : '—';

  let channelRows: ChanRow[];

  if (act) {
    const byChannel = new Map(act.channels.map((c) => [c.channel, c]));
    channelRows = CHANNEL_ORDER.map((ch) => {
      const s = byChannel.get(ch);
      const sent = s?.sent ?? 0;
      const delivered = s?.delivered ?? 0;
      const read = s?.read ?? 0;
      const clicked = s?.clicked ?? 0;
      const failed = s?.failed ?? 0;
      // `sent` excludes failures; attempted restores them so delivery % matches
      // the detail page (delivered / attempted), not "of successful sends".
      //
      // It is also the number this row PRINTS as "sent". The API's `sent` is
      // `status in ('submitted','sent','delivered','read')`, i.e. dispatched
      // and not yet known to have failed — so under the bare word "sent" it
      // read 7 for 92b4c42d… (4 delivered + 3 read) while the profile one
      // click away rendered its "Sent" tile as `attempted` = 9 with the sub
      // "Including failures" (channel-kpis.ts:79-82, from the same
      // /activity `channels` payload). One word, one subscriber, two numbers.
      // Printing `attempted` here makes the drawer and the profile the same
      // fact; `title` carries what the profile's sub-label says out loud.
      const attempted = sent + failed;
      // Each channel reports only what it can measure, read from the same
      // config the campaign and template views use. Email and WhatsApp track
      // engagement; SMS and voice know delivery and nothing else, so showing
      // them an open rate only ever produced a meaningless dash.
      const cfg = channelReportConfig(ch);
      const hasOpen = cfg.rateCards.some((r) => r === 'open' || r === 'seen');
      const hasClick = cfg.rateCards.includes('click');
      const pctOf = (v: number, denom: number) =>
        denom > 0 ? `${Math.round((v / denom) * 100)}%` : '—';
      const metrics: ChanMetric[] = [];
      if (hasOpen) {
        metrics.push({
          label: cfg.openLabel === 'Seen' ? 'seen' : 'open',
          value: pctOf(read, delivered),
        });
      }
      if (hasClick) metrics.push({ label: 'click', value: pctOf(clicked, delivered) });
      if (!hasOpen && !hasClick) {
        metrics.push({ label: 'delivered', value: pctOf(delivered, attempted) });
      }
      // Failures are the one number that tells you to act on this subscriber,
      // so every channel carries it.
      metrics.push({
        label: 'failed',
        value: attempted > 0 ? failed.toLocaleString('en-US') : '—',
        alert: failed > 0,
      });
      return {
        ch,
        // `attempted`, not `sent`: a subscriber whose only message failed has
        // been mailed, and this row used to call that "No messages yet".
        on: attempted > 0,
        meta: attempted > 0 ? `${attempted.toLocaleString('en-US')} sent` : 'No messages yet',
        metaTitle:
          attempted > 0
            ? `${attempted.toLocaleString('en-US')} dispatched, including ${failed.toLocaleString('en-US')} failed`
            : undefined,
        metrics,
      };
    });
  } else if (live) {
    // Live but still loading — show empty channels rather than fake numbers.
    channelRows = CHANNEL_ORDER.map((ch) => ({
      ch,
      on: false,
      meta: 'No messages yet',
      metrics: [
        {
          label: channelReportConfig(ch).rateCards.some((r) => r === 'open' || r === 'seen')
            ? channelReportConfig(ch).openLabel === 'Seen'
              ? 'seen'
              : 'open'
            : 'delivered',
          value: '—',
        },
        { label: 'failed', value: '—' },
      ],
    }));
  } else {
    // Fixture/marketing preview keeps its illustrative values.
    channelRows = [
      {
        ch: 'email',
        on: reach.email,
        meta: '24 sent',
        metrics: [
          { label: 'open', value: sub.opens },
          { label: 'click', value: sub.clicks },
          { label: 'failed', value: '1', alert: true },
        ],
      },
      {
        ch: 'sms',
        on: reach.sms,
        meta: reach.sms ? '6 sent' : 'Not opted in',
        metrics: [
          { label: 'delivered', value: reach.sms ? '83%' : '—' },
          { label: 'failed', value: reach.sms ? '1' : '—', alert: reach.sms },
        ],
      },
      {
        ch: 'whatsapp',
        on: reach.whatsapp,
        meta: reach.whatsapp ? '3 sent' : 'Not opted in',
        metrics: [
          { label: 'seen', value: reach.whatsapp ? '92%' : '—' },
          { label: 'click', value: reach.whatsapp ? '34%' : '—' },
          { label: 'failed', value: reach.whatsapp ? '0' : '—' },
        ],
      },
      {
        ch: 'voice',
        on: reach.voice,
        meta: reach.voice ? '2 calls' : 'Not opted in',
        metrics: [
          { label: 'delivered', value: reach.voice ? '75%' : '—' },
          { label: 'failed', value: reach.voice ? '0' : '—' },
        ],
      },
    ];
  }

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        className="adrawer sbd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${sub.name} profile`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Subscriber profile</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body">
          {/* identity */}
          <div className={styles.sbdId}>
            <Avatar sub={sub} size={56} />
            <div className={styles.sbdIdtext}>
              <div className={styles.sbdName}>{sub.name}</div>
              <div className={styles.sbdEmail}>{sub.email}</div>
              <div className={styles.sbdBadges}>
                <span className={`astatus astatus--${sub.status} ${styles.sbdIdstatus}`}>
                  <span
                    className={styles.sbdStatusDot}
                    style={{
                      background: sub.status === 'active' ? '#16a34a' : 'currentColor',
                    }}
                  />
                  {statusLabel}
                </span>
                {sub.status === 'active' && (
                  <span className={styles.sbdGdpr} title="GDPR consent">
                    <Icon name="shield" size={12} stroke={2.4} />
                    GDPR
                    <span className={styles.sbdGdprCheck} aria-hidden="true">
                      <Icon name="check" size={8} stroke={3.5} />
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* No headline stat cards: opens and clicks exist only on email (and
              partly WhatsApp), but a subscriber spans all four channels, so a
              single pair of rates misreported them as the whole picture. The
              per-channel breakdown below carries the real numbers. */}

          {/* details */}
          <div className={styles.sbdSection}>
            <span className={`adrawer__eyebrow ${styles.sbdEyebrow}`}>Details</span>
            <div className="adetail">
              <span className="adetail__k">Subscribed</span>
              <span className="adetail__v">{sub.joined}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Last active</span>
              <span className="adetail__v">{lastActive}</span>
            </div>
          </div>

          {/* channel engagement */}
          <div className={styles.sbdSection}>
            <span className={`adrawer__eyebrow ${styles.sbdEyebrow}`}>Channel engagement</span>
            <div className={styles.sbdChans}>
              {channelRows.map(({ ch, on, meta, metaTitle, metrics }) => {
                const m = CHANNEL[ch];
                return (
                  <div key={ch} className={styles.sbdChan}>
                    <span
                      className={styles.sbdChanIc}
                      style={{
                        background: on ? m.tint : 'var(--surface2)',
                        color: on ? m.color : 'var(--muted)',
                      }}
                    >
                      <Icon name={m.icon} size={14} />
                    </span>
                    <div className={styles.sbdChanMain}>
                      <div className={styles.sbdChanTop}>
                        <span className={styles.sbdChanName}>{m.label}</span>
                        <span className={`${styles.sbdChanPill}${on ? '' : ` ${styles.isOff}`}`}>
                          {on ? 'Active' : 'Off'}
                        </span>
                      </div>
                      <div className={styles.sbdChanMeta} title={metaTitle}>
                        {meta}
                      </div>
                    </div>
                    <div className={styles.sbdChanMetrics}>
                      {metrics.map((mt) => (
                        <div key={mt.label}>
                          <span
                            className={`tnum ${styles.sbdChanNum}`}
                            style={mt.alert ? { color: 'var(--danger)' } : undefined}
                          >
                            {mt.value}
                          </span>
                          <span className={styles.sbdChanSub}>{mt.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* editable tags — saved as you add or remove them */}
          <div className={styles.sbdSection}>
            <span className={`adrawer__eyebrow ${styles.sbdEyebrow}`}>Tags</span>
            <div className={styles.sbdTags}>
              {draft.map((t) => (
                <span key={t} className={styles.sbdTag} style={tagStyle(t)}>
                  <button
                    type="button"
                    className={styles.sbdTaglbl}
                    title={`Filter by “${t}”`}
                    onClick={() => onFilterTag(t)}
                  >
                    {t}
                  </button>
                  <button
                    type="button"
                    className={styles.sbdTagx}
                    aria-label={`Remove ${t}`}
                    onClick={() => removeTag(t)}
                  >
                    <Icon name="x" size={14} stroke={3} />
                  </button>
                </span>
              ))}
              <input
                className={styles.sbdTagin}
                placeholder="Add tag…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
            aria-label={`Delete ${sub.name}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="sbtn" style={{ flex: 1 }} onClick={onEdit}>
            <Icon name="edit" size={15} />
            Edit
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={() => {
              window.location.href = routes.app.subscriber(sub.id);
            }}
          >
            View profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- Segment modal ------------------------------ */
function SegmentModal({
  edit,
  defaultChannel,
  onClose,
  onSave,
  onDelete,
  lists,
  tags,
  customFields,
  live,
}: {
  edit: SavedSegment | null;
  /** Seed channel when creating — the active subscribers tab. */
  defaultChannel: ChannelType;
  onClose: () => void;
  onSave: (seg: SavedSegment) => void;
  onDelete: (id: string) => void;
  lists: { id: string; name: string }[];
  tags: string[];
  customFields: CustomField[];
  live: boolean;
}) {
  const [name, setName] = useState(edit?.name ?? '');
  const [matchType, setMatchType] = useState<'all' | 'any'>(edit?.matchType ?? 'all');
  // A segment belongs to exactly one channel: its rules describe reachability
  // on that channel, and the subscribers tab shows one channel at a time. The
  // badge is read-only — switch tabs to create a segment for another channel.
  const channel: ChannelType = edit?.channels?.[0] ?? defaultChannel;
  const [rows, setRows] = useState<SegRule[]>(
    edit?.rows ?? [{ field: 'Status', op: 'eq', val: 'active' }],
  );
  const [count, setCount] = useState<number | null>(null);

  const fieldLabel = (field: SegField): string => {
    if (isCoreSegField(field)) return field;
    return customFields.find((f) => f.key === field)?.label ?? field;
  };

  const customType = (field: SegField) =>
    isCoreSegField(field) ? null : (customFields.find((f) => f.key === field)?.type ?? 'text');

  /** Values offered for a field — real lists, tags, or boolean custom fields. */
  const valuesFor = (field: SegField): { value: string; label: string }[] => {
    if (field === 'Status') return STATUS_VALUES.map((v) => ({ value: v, label: v }));
    if (field === 'List') return lists.map((l) => ({ value: l.id, label: l.name }));
    if (field === 'Tag') return tags.map((t) => ({ value: t, label: t }));
    if (customType(field) === 'boolean') {
      return [
        { value: 'true', label: 'True' },
        { value: 'false', label: 'False' },
      ];
    }
    return [];
  };

  const setField = (i: number, field: SegField) => {
    const ops = opsForSegField(field, customFields);
    const op = ops[0]!.op;
    const vals = valuesFor(field);
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { field, op, val: vals[0]?.value ?? '' } : row)),
    );
  };
  const setOp = (i: number, op: SegOp) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, op } : row)));
  const setVal = (i: number, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, val } : row)));
  const addRow = () =>
    setRows((r) => [...r, { field: 'Tag', op: 'eq', val: tags[0] ?? '' } as SegRule]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  /* The match count is evaluated by the service against every subscriber.
     Debounced so typing a value doesn't fire a request per keystroke. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      api
        .post<{ count: number }>('segments/preview', {
          matchType,
          rules: toApiRules(rows, customFields),
          limit: 1,
        })
        .then((r) => {
          if (!cancelled) setCount(r.count);
        })
        .catch(() => {
          if (!cancelled) setCount(null);
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [rows, matchType, live, customFields]);

  const submit = () => {
    onSave({
      // The service mints ids; this placeholder is only used to decide
      // create-vs-update and is replaced by the saved row.
      id: edit?.id ?? 'new',
      name: name.trim() || 'Untitled segment',
      matchType,
      rows,
      channels: [channel],
      custom: true,
    });
  };

  return (
    <div className={styles.segmOverlay} style={{ animation: 'ovfade .2s ease' }} onClick={onClose}>
      <div
        className={styles.segm}
        style={{ animation: 'pop .18s ease' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={edit ? 'Edit segment' : 'Create segment'}
      >
        <div className={styles.segmHead}>
          <div>
            <div className={styles.segmTitle}>{edit ? 'Edit segment' : 'Create segment'}</div>
            <div className={styles.segmSub}>
              Filter subscribers by rules that update automatically.
            </div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className={styles.segmBody}>
          <span className={styles.segmChan}>
            <ChannelPill channel={channel} />
          </span>
          <label className={styles.segmLabel} htmlFor="segname">
            Segment name
          </label>
          <input
            id="segname"
            className={styles.segmInput}
            placeholder="e.g. Engaged VIPs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className={styles.segmMatchline}>
            Match
            <span className={`aseg ${styles.segmMatchseg}`}>
              {(['all', 'any'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`aseg__opt${matchType === m ? ' is-active' : ''}`}
                  onClick={() => setMatchType(m)}
                  aria-pressed={matchType === m}
                >
                  {m}
                </button>
              ))}
            </span>
            of the following conditions:
          </div>

          <div className={styles.segmRows}>
            {rows.map((row, i) => {
              const opts = valuesFor(row.field);
              const type = customType(row.field);
              const freeText =
                row.field === 'Email' ||
                row.field === 'Name' ||
                type === 'text' ||
                type === 'number' ||
                type === 'date';
              const ops = opsForSegField(row.field, customFields);
              return (
                <div key={i} className={styles.segmRow}>
                  <select
                    className={styles.segmSel}
                    value={row.field}
                    onChange={(e) => setField(i, e.target.value as SegField)}
                    aria-label="Field"
                  >
                    <optgroup label="Subscriber">
                      {CORE_SEG_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </optgroup>
                    {customFields.length > 0 && (
                      <optgroup label="Custom fields">
                        {customFields.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <select
                    className={styles.segmSel}
                    value={row.op}
                    onChange={(e) => setOp(i, e.target.value as SegOp)}
                    aria-label="Operator"
                  >
                    {ops.map((o) => (
                      <option key={o.op} value={o.op}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {/* exists / not_exists take no value, so no control is shown. */}
                  {!opNeedsValue(row.op) ? (
                    <span className={styles.segmSel} style={{ opacity: 0.55 }}>
                      —
                    </span>
                  ) : freeText ? (
                    <input
                      className={styles.segmSel}
                      value={row.val}
                      onChange={(e) => setVal(i, e.target.value)}
                      placeholder={
                        row.field === 'Email'
                          ? 'example.com'
                          : row.field === 'Name'
                            ? 'Ada'
                            : type === 'number'
                              ? '0'
                              : type === 'date'
                                ? '2026-01-01'
                                : fieldLabel(row.field)
                      }
                      type={type === 'number' ? 'number' : type === 'date' ? 'date' : 'text'}
                      aria-label="Value"
                    />
                  ) : (
                    <select
                      className={styles.segmSel}
                      value={row.val}
                      onChange={(e) => setVal(i, e.target.value)}
                      aria-label="Value"
                    >
                      {opts.length === 0 && <option value="">(none yet)</option>}
                      {opts.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    className={styles.segmRm}
                    disabled={rows.length <= 1}
                    aria-label="Remove condition"
                    onClick={() => removeRow(i)}
                  >
                    <Icon name="x" size={15} />
                  </button>
                </div>
              );
            })}
          </div>

          <button type="button" className={styles.segmAdd} onClick={addRow}>
            <Icon name="plus" size={14} stroke={2.2} />
            Add condition
          </button>

          <div className={styles.segmSummary}>
            <Icon name="filter" size={15} />
            <span className="tnum">
              {count == null
                ? 'Counting…'
                : `${count.toLocaleString('en-US')} subscriber${count === 1 ? '' : 's'} match`}
            </span>
          </div>
        </div>

        <div className={styles.segmFoot}>
          {edit && (
            <button type="button" className={styles.segmDel} onClick={() => onDelete(edit.id)}>
              Delete
            </button>
          )}
          <button type="button" className={`sbtn ${styles.segmCancel}`} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pbtn" onClick={submit}>
            {edit ? 'Save changes' : 'Save segment'}
          </button>
        </div>
      </div>
    </div>
  );
}
