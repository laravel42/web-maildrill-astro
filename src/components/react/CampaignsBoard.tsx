import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { campaigns as mockCampaigns } from '@/lib/app/mock-data';
import { api, ApiError } from '@/lib/app/api';
import {
  toCampaign,
  toCampaigns,
  audienceIdsFromApiCampaign,
  campaignAudiencePayload,
  campaignSendPayload,
  campaignDeliveryToast,
  campaignSendProgress,
  waitForCampaignDelivery,
  type ApiCampaign,
  type CampaignSendResult,
} from '@/lib/app/campaign-map';
import { channelReportConfig, type DrawerKpiKey } from '@/lib/app/campaign-report';
import { trackingCapabilities } from './CampaignWizard.logic';
import { RATE_BUCKETS, rateBucket } from '@/lib/app/templates-data';
import type { ApiTemplate } from '@/lib/app/template-map';
import type { ChannelSenders } from '@/lib/app/channel-senders';
import type { AudienceChoice, CampaignDraft, TemplateChoice } from './CampaignWizard.types';
import type { ApiDomain } from './AppSettings.types';
import {
  readVerifiedDomainsCache,
  subscribeVerifiedDomainsCache,
  verifiedDomainNames,
  writeVerifiedDomainsCache,
} from '@/lib/app/verified-domains';
import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';
import Icon from './Icon';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import ConfirmDialog from './shared/ConfirmDialog';
import CampaignWizard from './CampaignWizard';
import TemplatePreview, { MessagePreview } from './shared/TemplatePreview';
import { CHANNEL } from './shared/channels';
import { ChannelPill, ListPill } from './shared/CampaignPills';
import StatusBadge from './shared/StatusBadge';
import TimeAgo from './shared/TimeAgo';
import { useToast } from './shared/useToast';
import ToastHost from './shared/ToastHost';
import {
  CHANNEL_TABS,
  PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABEL,
  pct,
} from './CampaignsBoard.logic';
import type { SortKey } from './CampaignsBoard.types';
import { visiblePageNumbers } from './shared/pagination';
import { routes } from '@/config/routes';
import styles from './CampaignsBoard.module.css';

/** Workspace-wide counts behind the channel tabs and the status menu. */
interface BoardCounts {
  byChannel: Record<string, number>;
  byStatus: Record<string, number>;
}

/**
 * The rate bands, as the API names them.
 *
 * The labels are display strings ("20 – 40%", with an en dash); the wire wants
 * stable slugs, and the server re-derives the band from the counters rather
 * than trusting a parsed percentage.
 */
const RATE_SLUG: Record<string, string> = {
  None: 'none',
  'Under 20%': 'low',
  '20 – 40%': 'mid',
  '40%+': 'high',
};

function DispatchProgress({ progress, status }: { progress: number; status: 'sending' | 'sent' }) {
  return (
    <div className={styles.sendProgress} title={`${progress}% dispatched`}>
      <StatusBadge status={status} />
      <div
        className={styles.sendProgressTrack}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label={`Dispatch progress ${progress} percent`}
      >
        <div
          className={styles.sendProgressFill}
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>
      <span className={`tnum ${styles.sendProgressPct}`}>{progress}%</span>
    </div>
  );
}

export default function CampaignsBoard({
  initial,
  initialTotal,
  initialCounts,
  audiences: initialAudiences,
  templates: initialTemplates,
  senders,
}: {
  initial?: Campaign[];
  /** Campaigns matching the first page's filters, for the pager. */
  initialTotal?: number;
  /** Workspace tab/status counts, so the tabs render before the first fetch. */
  initialCounts?: BoardCounts;
  audiences?: AudienceChoice[];
  templates?: TemplateChoice[];
  senders?: ChannelSenders;
} = {}) {
  // Live workspace campaigns from SSR when provided; else the fixture preview.
  const live = initial !== undefined;
  /*
   * In live mode this holds ONE page, not the workspace. Everything that used
   * to be derived by filtering it in the browser — the rows, the tab counts,
   * the status counts, the footer total — now comes from the server, because
   * ten rows cannot answer questions about a thousand campaigns.
   */
  const [campaigns, setCampaigns] = useState<Campaign[]>(initial ?? mockCampaigns);
  const [serverTotal, setServerTotal] = useState<number>(initialTotal ?? 0);
  const [serverCounts, setServerCounts] = useState<BoardCounts | null>(initialCounts ?? null);
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
  /* Bumped after any mutation, to re-read the page and the counts together —
     a create or a delete changes the total and the tab counts, not just a row. */
  const [refreshTick, setRefreshTick] = useState(0);
  const refresh = () => setRefreshTick((n) => n + 1);
  const [tab, setTab] = useState<ChannelType>('email');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<CampaignStatus>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'status' | 'opens' | 'clicks' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [pageState, setPageState] = useState<{ key: string; page: number }>({ key: '', page: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids waiting on the delete confirm dialog (bulk toolbar or drawer).
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep link: ?open=<id> opens the drawer (dashboard, etc.).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenId(id);
  }, []);

  const editDeepLinkDone = useRef(false);
  const { toast, show } = useToast(2600);
  /**
   * Audience and template choices are lazy: they belong to the wizard, not the
   * board, and fetching them cost ~876ms of blocking SSR (/v1/lists/audience
   * 601ms, /v1/templates 275ms / 1.1MB) on every board view — for a dialog most
   * visits never open. Fetched on first open and kept for the session.
   *
   * Verified sending domains are prefetched on mount instead: the From select
   * is on step 1, and listing domains hits Infobip — waiting until the modal
   * opens made the first paint feel stuck on “Loading sending domains…”.
   */
  const [audiences, setAudiences] = useState(initialAudiences);
  const [templates, setTemplates] = useState(initialTemplates);
  const [verifiedDomains, setVerifiedDomains] = useState<string[] | undefined>(() =>
    readVerifiedDomainsCache(),
  );
  const domainsFetchStarted = useRef(false);
  const [choicesFetched, setChoicesFetched] = useState(
    initialAudiences !== undefined && initialTemplates !== undefined,
  );

  const loadVerifiedDomains = () => {
    if (!live || domainsFetchStarted.current) return;
    domainsFetchStarted.current = true;
    void api
      .get<{ data: ApiDomain[] }>('workspace/domains')
      .then((res) => {
        const names = verifiedDomainNames(res.data);
        writeVerifiedDomainsCache(names);
        setVerifiedDomains(names);
      })
      .catch(() => {
        domainsFetchStarted.current = false;
        setVerifiedDomains([]);
      });
  };

  useEffect(() => {
    loadVerifiedDomains();
    // Prefetch once per live board mount — intentionally omits loadVerifiedDomains
    // from deps (stable via domainsFetchStarted ref).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/live only
  }, [live]);

  /* Settings (and other tabs) publish when a domain is verified/removed. */
  useEffect(() => subscribeVerifiedDomainsCache(setVerifiedDomains), []);

  const loadWizardChoices = () => {
    loadVerifiedDomains();
    if (choicesFetched || !live) return;
    setChoicesFetched(true);
    void fetch('/api/wizard-choices')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { audiences?: AudienceChoice[]; templates?: TemplateChoice[] } | null) => {
        if (!d) return;
        setAudiences(d.audiences ?? []);
        setTemplates(d.templates ?? []);
      })
      // Let a reopen retry rather than leaving the wizard permanently empty.
      .catch(() => setChoicesFetched(false));
  };

  const [wizard, setWizard] = useState<
    | { mode: 'create' }
    | {
        mode: 'edit';
        id: string;
        channel: ChannelType;
        name: string;
        subject: string;
        from: string;
        trackOpens: boolean;
        trackClicks: boolean;
        audienceIds: string[];
        templateId: string | null;
        message: string;
        schedule: 'now' | 'later';
        scheduledAt: string | null;
      }
    | null
  >(null);

  // Quick action: /dashboard/campaigns?new opens a blank wizard.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('new') == null) return;
    loadWizardChoices();
    setWizard({ mode: 'create' });
    url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  /* What the selected channel can report — drives which filters exist, the
     same source the table columns and drawer KPIs read. */
  const tabCfg = channelReportConfig(tab);
  /* Rate columns exist only where the channel reports them; otherwise the
     table carried an Open and a Click column of dashes on every row. */
  const showOpenCol = tabCfg.rateCards.some((r) => r === 'open' || r === 'seen');
  const showClickCol = tabCfg.rateCards.includes('click');
  const tabTracking = trackingCapabilities(tab);
  const openTrackingToggle = tabCfg.rateCards.includes('open') && tabTracking.opens.enabled;
  const clickTrackingToggle = showClickCol && tabTracking.clicks.enabled;
  /* Every channel reports a failure outcome — a bounce on email, a failed send
     everywhere else — so the column is always present, only relabelled.

     Either label names the same server figure, `campaign.failed`, and that
     figure is now exactly `FAILED_DELIVERY_STATES`: a message the provider
     tried and never delivered (`failed`), or one it accepted and then abandoned
     at TTL (`expired`). Both descriptions fit the words in this header.

     `cancelled` used to be in that count and is not any more. A cancelled
     message never reached the provider — the send was withdrawn, or the
     in-flight breaker stopped the queue draining into a bad list — so putting
     it under "Bounced" reported the sender's own decision as the recipient's
     address failing. It now has its own tab on the campaign report and is in
     neither the delivered nor the failed count here. */
  const failLabel = tabCfg.kpis.includes('bounced') ? 'Bounced' : 'Failed';
  const gridClass = `${styles.grid}${showOpenCol || showClickCol ? '' : ` ${styles.gridPlain}`}`;

  /* A rate filter that disappears must stop filtering with it: leaving an
     Opens selection active while switching to SMS would silently empty the
     table with no visible control to undo it. */
  useEffect(() => {
    if (!tabCfg.rateCards.some((r) => r === 'open' || r === 'seen')) setOpensSel(new Set());
    if (!tabCfg.rateCards.includes('click')) setClicksSel(new Set());
    setOpenFilter(null);
  }, [tab, tabCfg]);

  /* Only statuses that exist in this channel, with counts. Offering "Paused"
     on a channel with no paused campaign gives a control whose every use
     empties the table. */
  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    // Live: from the server's single grouped read of `campaigns`. Counting the
    // fetched rows would report at most a page — "10 sent" on a workspace of
    // nine hundred.
    const inChannel = live
      ? null
      : campaigns.filter((x) => x.channel === tab);
    for (const st of STATUS_FILTERS) {
      const n = inChannel ? inChannel.filter((x) => x.status === st).length : (serverCounts?.byStatus[st] ?? 0);
      if (n > 0) c[st] = n;
    }
    return c;
  }, [live, campaigns, tab, serverCounts]);

useEffect(() => {
    setStatusFilter((prev) => {
      const next = new Set([...prev].filter((st) => st in statusCounts));
      return next.size === prev.size ? prev : next;
    });
  }, [statusCounts]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of CHANNEL_TABS) {
      c[t] = live ? (serverCounts?.byChannel[t] ?? 0) : campaigns.filter((x) => x.channel === t).length;
    }
    return c;
  }, [live, campaigns, serverCounts]);

  /*
   * One string naming the filter set and ordering that a page number and a
   * cursor belong to.
   *
   * Derived during render rather than reset from an effect, and that is the
   * point: an effect that calls setPage(1) has not run by the time the fetch
   * effect fires in the same commit, so switching channel used to issue one
   * request carrying the previous channel's cursor. The server refused it
   * (cursor_shape_mismatch — the guard working as intended) and the right
   * request followed, but it was a wasted round trip and a console error on
   * every filter change. Keying the state makes the reset simultaneous.
   */
  const queryKey = useMemo(
    () =>
      JSON.stringify([
        tab,
        query.trim(),
        [...statusFilter].sort(),
        [...opensSel].sort(),
        [...clicksSel].sort(),
        sort.key,
        sort.dir,
      ]),
    [tab, query, statusFilter, opensSel, clicksSel, sort],
  );
  const page = pageState.key === queryKey ? pageState.page : 1;
  const setPage = (next: number | ((p: number) => number)) =>
    setPageState({ key: queryKey, page: typeof next === 'function' ? next(page) : next });
  const cursorFor = cursors.key === queryKey ? cursors.byPage : {};

  const resetPage = () => setPage(1);

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>) => (v: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    resetPage();
  };

  /*
   * The fixture pipeline: filter and sort the whole set in the browser.
   *
   * Unreachable in live mode — there the server applies every one of these
   * filters and the sort in SQL and hands back exactly one page, so the rows
   * in hand are already the answer. Filtering them again here is what made the
   * old board need all 1,029 campaigns (and their message rollups) before it
   * could draw ten.
   */
  const fixtureRows = useMemo(() => {
    if (live) return [];
    let list = campaigns.filter((c) => {
      if (c.channel !== tab) return false;
      if (statusFilter.size > 0 && !statusFilter.has(c.status)) return false;
      if (opensSel.size && !opensSel.has(rateBucket((c.openRate ?? 0) * 100))) return false;
      if (clicksSel.size && !clicksSel.has(rateBucket((c.clickRate ?? 0) * 100))) return false;
      if (query) {
        const q = query.toLowerCase();
        return c.name.toLowerCase().includes(q) || c.audience.toLowerCase().includes(q);
      }
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let av: number | string = a[key] ?? '';
      let bv: number | string = b[key] ?? '';
      if (key === 'updatedAt') {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [live, tab, query, statusFilter, opensSel, clicksSel, sort, campaigns]);

  // Live: `campaigns` is the page the server returned, and `serverTotal` counts
  // the whole filtered set — so the rows on screen and the footer count always
  // describe the same set.
  const totalRows = live ? serverTotal : fixtureRows.length;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const startIdx = totalRows === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, totalRows);
  const pageRows = live
    ? campaigns
    : fixtureRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  /*
   * The server owns every filter the board offers — channel, status, search,
   * open/click band — plus the sort and the page window. Nothing below narrows
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
    // the other columns page by number over the small `campaigns` table.
    const cursor = sort.key === 'updatedAt' ? cursorFor[page] : undefined;
    if (cursor) qs.set('cursor', cursor);
    else if (page > 1) qs.set('page', String(page));
    if (query.trim()) qs.set('q', query.trim());
    for (const st of statusFilter) qs.append('status', st);
    // Bands are only sent on channels that report them — the same rule that
    // decides whether the column exists at all.
    if (showOpenCol) for (const b of opensSel) qs.append('opens', RATE_SLUG[b]);
    if (showClickCol) for (const b of clicksSel) qs.append('clicks', RATE_SLUG[b]);
    // Count once per filter set: the pager needs a page count, but counting on
    // every Next would be a scan per click.
    if (page === 1) qs.set('withTotal', '1');

    setLoadingPage(true);
    api
      .get<{
        items: ApiCampaign[];
        next_cursor: string | null;
        total?: number;
      }>(`campaigns?${qs}`)
      .then((res) => {
        if (cancelled) return;
        setCampaigns(toCampaigns(res.items ?? []));
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
    // it, so listing it would re-run the fetch on its own result. `queryKey`
    // is a function of the filters already listed.
  }, [live, queryKey, tab, sort, page, refreshTick, showOpenCol, showClickCol]);

  /* Tab and status counts describe the workspace, so they are fetched once per
     channel — never per page. One grouped read of `campaigns`, no message data.

     KNOWN DEFECT (audit #33): "the workspace" is the wrong scope once a search
     or a rate band is active, because only `channel` is passed — `q`, `opens`
     and `clicks` are not. The status menu then offers counts for a set the
     table is not showing: with `?q=Back-in-stock&status=draft` the table reads
     "1–1 of 1" while the menu beside it offers "Draft 50 / Sent 213", and every
     option a reader picks empties the table. The counts are right about the
     channel and wrong about the query. */
  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    api
      .get<BoardCounts>(`campaigns/counts?channel=${tab}`)
      .then((c) => {
        if (!cancelled) setServerCounts(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [live, tab, refreshTick]);

  // While a campaign on this channel is sending, re-read so the progress bar
  // advances. This used to refetch every campaign in the workspace — and with
  // it a full rollup of every message — every three seconds, per open tab.
  const hasSending = live
    ? (serverCounts?.byStatus.sending ?? 0) > 0
    : campaigns.some((c) => c.status === 'sending');
  useEffect(() => {
    if (!live || !hasSending) return;
    const id = window.setInterval(refresh, 3000);
    return () => window.clearInterval(id);
  }, [live, hasSending]);

  // Keep the dispatch bar at 100% for 1s after status flips to `sent`, then drop it.
  const [progressHoldIds, setProgressHoldIds] = useState<Set<string>>(() => new Set());
  const prevStatusById = useRef<Map<string, CampaignStatus>>(new Map());
  const progressHoldTimers = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const prev = prevStatusById.current;
    const next = new Map(prev);
    for (const c of campaigns) {
      if (prev.get(c.id) === 'sending' && c.status === 'sent') {
        const id = c.id;
        setProgressHoldIds((hold) => new Set(hold).add(id));
        const existing = progressHoldTimers.current.get(id);
        if (existing != null) window.clearTimeout(existing);
        const timer = window.setTimeout(() => {
          progressHoldTimers.current.delete(id);
          setProgressHoldIds((hold) => {
            const h = new Set(hold);
            h.delete(id);
            return h;
          });
        }, 1000);
        progressHoldTimers.current.set(id, timer);
      }
      next.set(c.id, c.status);
    }
    prevStatusById.current = next;
  }, [campaigns]);
  useEffect(
    () => () => {
      for (const t of progressHoldTimers.current.values()) window.clearTimeout(t);
      progressHoldTimers.current.clear();
    },
    [],
  );

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(pageRows.map((r) => r.id)));

  const bulk = (verb: string) => {
    show(`${verb} ${selected.size} campaign${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  const reportSendOutcome = async (id: string, name: string) => {
    show(`“${name}” is sending…`);
    const outcome = await waitForCampaignDelivery(id);
    setCampaigns((prev) => prev.map((c) => (c.id === id ? toCampaign(outcome) : c)));
    refresh();
    show(campaignDeliveryToast(name, outcome));
  };

  /* "Send now" uses POST /campaigns/send in one shot so a campaign never sits
     in draft limbo when the follow-up dispatch step fails. Scheduled campaigns
     are saved as drafts first. */
  const createFromWizard = async (draft: CampaignDraft) => {
    const name = draft.name.trim() || 'Untitled campaign';
    if (!live) {
      show(`“${name}” created`);
      return;
    }

    if (draft.schedule === 'now') {
      try {
        const res = await api.post<CampaignSendResult>(
          'campaigns/send',
          campaignSendPayload(draft, name),
        );
        window.posthog?.capture('campaign_sent', {
          channel: draft.channel,
          mode: 'create',
          schedule: 'now',
          audience_count: res.audience,
          queued: res.queued,
        });
        const created = await api.get<ApiCampaign>(`campaigns/${res.campaignId}`);
        setCampaigns((prev) => [toCampaign(created), ...prev]);
        refresh();
        void reportSendOutcome(res.campaignId, name);
      } catch (e) {
        show(e instanceof ApiError ? e.message : `Could not send “${name}”`);
      }
      return;
    }

    try {
      const audience = campaignAudiencePayload(draft);
      const created = await api.post<ApiCampaign>('campaigns', {
        name,
        channel: draft.channel,
        status: 'scheduled',
        listId: audience.listId,
        segmentId: audience.segmentId,
        templateId: draft.templateId ?? null,
        content: audience.content,
        scheduledAt: draft.scheduledAt ?? null,
      });
      setCampaigns((prev) => [toCampaign(created), ...prev]);
      refresh();
      show(`“${created.name}” scheduled`);
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not create campaign');
    }
  };

  /* Open the wizard on an existing campaign. The board row carries only display
     fields, so the saved audience/template/body are fetched — without them the
     wizard would open blank and "save" would wipe the campaign's targeting. */
  const openForEdit = async (c: Campaign) => {
    if (!live) {
      loadWizardChoices();
      setWizard({
        mode: 'edit',
        id: c.id,
        channel: c.channel,
        name: c.name,
        subject: '',
        from: '',
        trackOpens: false,
        trackClicks: false,
        audienceIds: [],
        templateId: null,
        message: '',
        schedule: c.scheduledAt ? 'later' : 'now',
        scheduledAt: c.scheduledAt,
      });
      return;
    }
    try {
      const full = await api.get<ApiCampaign>(`campaigns/${c.id}`);
      const content = (full.content ?? {}) as {
        text?: string;
        subject?: string;
        from?: string;
        trackOpens?: unknown;
        trackClicks?: unknown;
      };
      loadWizardChoices();
      setWizard({
        mode: 'edit',
        id: c.id,
        channel: (full.channel as ChannelType) ?? c.channel,
        name: full.name,
        subject: typeof content.subject === 'string' ? content.subject : '',
        from: typeof content.from === 'string' ? content.from : '',
        // Absent on pre-flag campaigns → treated as on, matching the provider.
        trackOpens: content.trackOpens !== false,
        trackClicks: content.trackClicks !== false,
        audienceIds: audienceIdsFromApiCampaign(full),
        templateId: full.templateId ?? null,
        message: typeof content.text === 'string' ? content.text : '',
        schedule: full.scheduledAt ? 'later' : 'now',
        scheduledAt: full.scheduledAt ?? null,
      });
    } catch (e) {
      show(e instanceof ApiError ? e.message : `Could not open “${c.name}”`);
    }
  };

  // Legacy links: ?report=<id> forwards to the campaign's report page
  // (old pins/bookmarks — new ones link there directly). ?edit=<id> still
  // opens the wizard.
  useEffect(() => {
    const reportDeepLinkId = new URLSearchParams(window.location.search).get('report');
    if (reportDeepLinkId) window.location.replace(routes.app.campaignReport(reportDeepLinkId));
  }, []);

  /* A deep link names a campaign that need not be on the page in hand — the
     dashboard links straight to one that may sit anywhere in the workspace —
     so fall back to fetching it by id rather than silently doing nothing. */
  const findCampaign = async (id: string): Promise<Campaign | null> => {
    const local = campaigns.find((x) => x.id === id);
    if (local || !live) return local ?? null;
    try {
      return toCampaign(await api.get<ApiCampaign>(`campaigns/${id}`));
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (editDeepLinkDone.current) return;
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    editDeepLinkDone.current = true;
    void findCampaign(editId).then((c) => {
      if (!c) return;
      void openForEdit(c);
      const url = new URL(window.location.href);
      url.searchParams.delete('edit');
      window.history.replaceState(null, '', `${url.pathname}${url.search}`);
    });
    // Runs once, on the id in the URL; `campaigns` is read through
    // findCampaign, which falls back to the API when the row is off-page.
  }, [live]);

  /* Persist edits to an existing campaign; dispatch when the user chose send now. */
  const saveEdit = async (id: string, draft: CampaignDraft) => {
    if (!live) {
      show(`“${draft.name}” updated`);
      return;
    }
    const prior = campaigns.find((c) => c.id === id);
    const sendable =
      prior != null &&
      (prior.status === 'draft' || prior.status === 'scheduled' || prior.status === 'paused');

    try {
      const audience = campaignAudiencePayload(draft);
      const updated = await api.patch<ApiCampaign>(`campaigns/${id}`, {
        name: draft.name.trim() || 'Untitled campaign',
        channel: draft.channel,
        listId: audience.listId,
        segmentId: audience.segmentId,
        templateId: draft.templateId ?? null,
        content: audience.content,
        scheduledAt: draft.scheduledAt ?? null,
        status: draft.schedule === 'later' ? 'scheduled' : undefined,
      });
      setCampaigns((prev) => prev.map((c) => (c.id === id ? toCampaign(updated) : c)));
      refresh();

      if (draft.schedule === 'now' && sendable) {
        await sendCampaign(id, updated.name);
        return;
      }
      show(`“${updated.name}” updated`);
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not save changes');
    }
  };

  /* Copy a campaign into a fresh draft. The copy deliberately resets status and
     schedule: duplicating a sent campaign must not produce something that looks
     already-sent, or that a scheduler could pick up. */
  const duplicateCampaigns = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!live) {
      show(`Duplicated ${ids.length} campaign${ids.length === 1 ? '' : 's'}`);
      return;
    }
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const full = await api.get<ApiCampaign>(`campaigns/${id}`);
        return api.post<ApiCampaign>('campaigns', {
          name: `${full.name} (copy)`,
          channel: full.channel ?? 'email',
          status: 'draft',
          listId: full.listId ?? null,
          segmentId: full.segmentId ?? null,
          templateId: full.templateId ?? null,
          content: full.content ?? {},
        });
      }),
    );
    const made = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    setCampaigns((prev) => [...made.map(toCampaign), ...prev]);
    refresh();
    const failed = ids.length - made.length;
    show(
      failed
        ? `Duplicated ${made.length}, ${failed} failed`
        : `Duplicated ${made.length} campaign${made.length === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
  };

  /* Dispatch a saved campaign. The service resolves the audience, so the queued
     count it returns — not the wizard's estimate — is what gets reported. */
  const sendCampaign = async (id: string, name: string) => {
    try {
      await api.post<CampaignSendResult>(`campaigns/${id}/send`, { sendNow: true });
      void reportSendOutcome(id, name);
    } catch (e) {
      show(e instanceof ApiError ? e.message : `Could not send “${name}”`);
    }
  };

  /* Delete by id list — persists in live mode, else local-only. */
  const removeCampaigns = async (ids: string[]) => {
    if (ids.length === 0) return;
    const doomed = new Set(ids);
    if (!live) {
      setCampaigns((prev) => prev.filter((c) => !doomed.has(c.id)));
      show(`Deleted ${ids.length} campaign${ids.length === 1 ? '' : 's'}`);
      setSelected((prev) => new Set([...prev].filter((id) => !doomed.has(id))));
      if (openId && doomed.has(openId)) setOpenId(null);
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`campaigns/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setCampaigns((prev) => prev.filter((c) => !okIds.has(c.id)));
    refresh();
    setSelected((prev) => new Set([...prev].filter((id) => !okIds.has(id))));
    if (openId && okIds.has(openId)) setOpenId(null);
    const failed = ids.length - okIds.size;
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} campaign${okIds.size === 1 ? '' : 's'}`,
    );
  };

  const toggleStatus = (st: CampaignStatus) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(st)) next.delete(st);
      else next.add(st);
      return next;
    });
    setSelected(new Set()); // changing filters clears selection (spec §12)
  };

  /* The drawer's row, which ?open=<id> can name from off-page. */
  const [openFallback, setOpenFallback] = useState<Campaign | null>(null);
  useEffect(() => {
    if (!openId || campaigns.some((c) => c.id === openId)) {
      setOpenFallback(null);
      return;
    }
    let cancelled = false;
    void findCampaign(openId).then((c) => {
      if (!cancelled) setOpenFallback(c);
    });
    return () => {
      cancelled = true;
    };
  }, [openId, campaigns]);
  const open = openId
    ? (campaigns.find((c) => c.id === openId) ?? (openFallback?.id === openId ? openFallback : null))
    : null;
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  // Resolve a campaign's target-list colour from the audience picker data so the
  // detail views can tint the list badge; undefined when it targets a segment or
  // the list isn't in the loaded set (fixtures, or a since-deleted list).
  const listColorFor = (c: Campaign): string | undefined =>
    c.listId
      ? (audiences?.find((a) => a.kind === 'list' && a.id === c.listId)?.color ?? undefined)
      : undefined;

  return (
    <div className="screen cb">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Campaigns</h1>
          <p className="screen__sub">Create, schedule, and measure every send in one place.</p>
        </div>
        <button
          type="button"
          className="pbtn"
          onClick={() => {
            loadWizardChoices();
            setWizard({ mode: 'create' });
          }}
        >
          <Icon name="plus" size={15} stroke={2.2} />
          Create campaign
        </button>
      </div>

      <div className={`atable ${styles.card}`}>
        {/* channel tabs — status is the toolbar filter */}
        <div className={styles.tabs} role="tablist" aria-label="Campaign channel">
          {CHANNEL_TABS.map((t) => {
            const active = tab === t;
            const m = CHANNEL[t];
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.tab}${active ? ' is-active' : ''}`}
                style={{
                  color: active ? 'var(--text)' : 'var(--muted)',
                  borderBottomColor: active ? m.color : 'transparent',
                }}
                onClick={() => {
                  setTab(t);
                  setSelected(new Set());
                }}
              >
                <Icon name={m.icon} size={12} />
                {m.label}
                <span
                  className={`${styles.tabcount} tnum`}
                  style={{
                    background: active ? m.tint : 'var(--surface2)',
                    color: active ? m.color : 'var(--muted)',
                  }}
                >
                  {counts[t] ?? 0}
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
                placeholder="Search campaigns…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelected(new Set());
                }}
                aria-label="Search campaigns"
              />
            </label>
            <div className={styles.filterwrap}>
              <button
                type="button"
                className={`${styles.filter}${statusFilter.size ? ' is-on' : ''}`}
                aria-expanded={openFilter === 'status'}
                onClick={() => setOpenFilter((o) => (o === 'status' ? null : 'status'))}
              >
                <Icon name="filter" size={14} />
                Status
                {statusFilter.size > 0 && (
                  <span className={styles.filtercount}>{statusFilter.size}</span>
                )}
                <Icon name="chevron-down" size={12} className={styles.filtercaret} />
              </button>
              {openFilter === 'status' && (
                <>
                  <button
                    type="button"
                    className={styles.filterscrim}
                    aria-label="Close"
                    onClick={() => setOpenFilter(null)}
                  />
                  <div className={styles.filterpop} style={{ animation: 'pop .14s ease' }}>
                    {STATUS_FILTERS.filter((st) => st in statusCounts).map((st) => (
                      <label key={st} className={styles.filteropt}>
                        <input
                          type="checkbox"
                          checked={statusFilter.has(st)}
                          onChange={() => toggleStatus(st)}
                        />
                        <span className={`cstat cstat--${st}`}>{STATUS_LABEL[st]}</span>
                        <span className={`${styles.filtercount} tnum`}>{statusCounts[st]}</span>
                      </label>
                    ))}
                    {statusFilter.size > 0 && (
                      <button
                        type="button"
                        className={styles.filterclear}
                        onClick={() => {
                          setStatusFilter(new Set());
                          setSelected(new Set());
                        }}
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            {/* Rate filters exist only where the channel reports the rate.
                Offering "Opens" on SMS would filter every row to nothing. */}
            {tabCfg.rateCards.some((r) => r === 'open' || r === 'seen') && (
              <ColFilter
                label={tabCfg.openLabel === 'Seen' ? 'Seen' : 'Opens'}
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
            {tabCfg.rateCards.includes('click') && (
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
          </div>
          <FilterChipsRow
            chips={[
              ...[...statusFilter].map((st) => ({
                key: `status:${st}`,
                label: STATUS_LABEL[st],
                onRemove: () => toggleStatus(st),
                // Same fill as the menu badge that selected it.
                className: `cstat cstat--${st}`,
              })),
              ...[...opensSel].map((b) => ({
                key: `opens:${b}`,
                label: `${tabCfg.openLabel === 'Seen' ? 'Seen' : 'Opens'}: ${b}`,
                onRemove: () => toggleSet(setOpensSel)(b),
              })),
              ...[...clicksSel].map((b) => ({
                key: `clicks:${b}`,
                label: `Clicks: ${b}`,
                onRemove: () => toggleSet(setClicksSel)(b),
              })),
            ]}
            onClearAll={() => {
              setStatusFilter(new Set());
              setOpensSel(new Set());
              setClicksSel(new Set());
              setSelected(new Set());
              resetPage();
            }}
          />
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={styles.bulkcount}>{selected.size} selected</span>
            <span className={styles.bulkdiv} />
            <button
              type="button"
              className={styles.bulkbtn}
              onClick={() => void duplicateCampaigns([...selected])}
            >
              Duplicate
            </button>
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Archived')}>
              Archive
            </button>
            <button
              type="button"
              className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
              onClick={() => setConfirmDelete([...selected])}
            >
              Delete
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

        {/* table head */}
        <div className={`athead ${gridClass}`}>
          <div className={styles.check}>
            <button
              type="button"
              className={`${styles.box}${allChecked ? ' is-on' : ''}`}
              onClick={toggleAll}
              aria-label="Select all"
              aria-pressed={allChecked}
            >
              {allChecked && <Icon name="check" size={15} stroke={3.5} />}
            </button>
          </div>
          <div>
            <button
              type="button"
              className={sort.key === 'name' ? 'is-active' : undefined}
              onClick={() => toggleSort('name')}
            >
              Campaign <span className="tnum">{sortArrow('name')}</span>
            </button>
          </div>
          <div>Status</div>
          <div>Channel</div>
          <div className={styles.colCenter}>
            <button
              type="button"
              className={sort.key === 'recipients' ? 'is-active' : undefined}
              onClick={() => toggleSort('recipients')}
            >
              Recipients <span className="tnum">{sortArrow('recipients')}</span>
            </button>
          </div>
          <div className={styles.colCenter}>
            <button
              type="button"
              className={sort.key === 'failed' ? 'is-active' : undefined}
              onClick={() => toggleSort('failed')}
            >
              {failLabel} <span className="tnum">{sortArrow('failed')}</span>
            </button>
          </div>
          {showOpenCol && (
            <div className={styles.colCenter}>
              <button
                type="button"
                className={sort.key === 'openRate' ? 'is-active' : undefined}
                onClick={() => toggleSort('openRate')}
              >
                {tabCfg.openLabel === 'Seen' ? 'Seen' : 'Open'}{' '}
                <span className="tnum">{sortArrow('openRate')}</span>
              </button>
            </div>
          )}
          {showClickCol && (
            <div className={styles.colCenter}>
              <button
                type="button"
                className={sort.key === 'clickRate' ? 'is-active' : undefined}
                onClick={() => toggleSort('clickRate')}
              >
                Click <span className="tnum">{sortArrow('clickRate')}</span>
              </button>
            </div>
          )}
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
          <div className="atable__empty">No campaigns match your filters.</div>
        ) : (
          pageRows.map((c) => (
            <div
              key={c.id}
              className={`atrow ${gridClass}${selected.has(c.id) ? ' is-selected' : ''}`}
              onClick={() => setOpenId(c.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                // Ignore key events bubbling up from the nested checkbox/kebab buttons.
                if (e.target !== e.currentTarget) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setOpenId(c.id);
                }
              }}
            >
              <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={`${styles.box}${selected.has(c.id) ? ' is-on' : ''}`}
                  onClick={() => toggleSelect(c.id)}
                  aria-label={`Select ${c.name}`}
                  aria-pressed={selected.has(c.id)}
                >
                  {selected.has(c.id) && <Icon name="check" size={15} stroke={3.5} />}
                </button>
              </div>
              <div className={styles.name}>{c.name}</div>
              <div>
                {c.status === 'sending' ? (
                  <DispatchProgress progress={campaignSendProgress(c)} status="sending" />
                ) : progressHoldIds.has(c.id) ? (
                  <DispatchProgress progress={100} status="sent" />
                ) : (
                  <StatusBadge status={c.status} />
                )}
              </div>
              <div>
                <ChannelPill channel={c.channel} />
              </div>
              <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                {c.recipients.toLocaleString('en-US')}
              </div>
              <div
                className={`tnum ${styles.colCenter} ${c.failed > 0 ? styles.fail : styles.muted3}`}
              >
                {c.failed.toLocaleString('en-US')}
              </div>
              {/* Every row in the table is the selected channel, so the column
                  itself is present or absent — no per-row dashes needed. */}
              {showOpenCol && (
                <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                  {openTrackingToggle && !c.trackOpens
                    ? 'Off'
                    : c.openRate != null
                      ? `${Math.round(c.openRate * 100)}%`
                      : '—'}
                </div>
              )}
              {showClickCol && (
                <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                  {clickTrackingToggle && !c.trackClicks
                    ? 'Off'
                    : c.clickRate != null
                      ? `${Math.round(c.clickRate * 100)}%`
                      : '—'}
                </div>
              )}
              <TimeAgo className={`${styles.muted} ${styles.colCenter}`} at={c.updatedAt} />
            </div>
          ))
        )}

        {/* footer / pagination */}
        <div className={`atable__foot ${styles.foot}`}>
          <span className={totalRows === 0 ? undefined : 'tnum'}>
            {totalRows === 0
              ? 'No campaigns match your filters'
              : `${startIdx}–${endIdx} of ${totalRows.toLocaleString('en-US')} campaign${totalRows === 1 ? '' : 's'}${loadingPage ? ' · loading…' : ''}`}
          </span>
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
                disabled={safePage === pageCount}
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

      {/* detail drawer */}
      {open && (
        <CampaignDrawer
          campaign={open}
          listColor={listColorFor(open)}
          live={live}
          onClose={() => setOpenId(null)}
          onEdit={() => {
            const c = open;
            setOpenId(null);
            void openForEdit(c);
          }}
          onDuplicate={() => {
            const c = open;
            setOpenId(null);
            void duplicateCampaigns([c.id]);
          }}
          onViewReport={() => {
            // The report lives on its own page — all report logic is there.
            window.location.assign(routes.app.campaignReport(open.id));
          }}
          onDelete={() => setConfirmDelete([open.id])}
        />
      )}

      {wizard && (
        <CampaignWizard
          mode={wizard.mode}
          initialChannel={wizard.mode === 'edit' ? wizard.channel : 'email'}
          initialName={wizard.mode === 'edit' ? wizard.name : ''}
          initialSubject={wizard.mode === 'edit' ? wizard.subject : ''}
          initialFrom={wizard.mode === 'edit' ? wizard.from : ''}
          initialTrackOpens={wizard.mode === 'edit' ? wizard.trackOpens : undefined}
          initialTrackClicks={wizard.mode === 'edit' ? wizard.trackClicks : undefined}
          initialAudienceIds={wizard.mode === 'edit' ? wizard.audienceIds : []}
          initialTemplateId={wizard.mode === 'edit' ? wizard.templateId : null}
          initialMessage={wizard.mode === 'edit' ? wizard.message : ''}
          initialSchedule={wizard.mode === 'edit' ? wizard.schedule : 'now'}
          initialScheduledAt={wizard.mode === 'edit' ? wizard.scheduledAt : null}
          audiences={audiences}
          templates={templates}
          senders={senders}
          verifiedDomains={verifiedDomains}
          onClose={() => setWizard(null)}
          onDone={(_msg, draft) => {
            const w = wizard;
            setWizard(null);
            if (w.mode === 'create') void createFromWizard(draft);
            else void saveEdit(w.id, draft);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.length} campaign${confirmDelete.length === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const ids = confirmDelete;
            setConfirmDelete(null);
            void removeCampaigns(ids);
          }}
        />
      )}

      <ToastHost toast={toast} />
    </div>
  );
}

/**
 * Preview of a campaign's actual body. The content (html/text) is saved on the
 * campaign itself, so we read it from `campaigns/:id` and render it directly.
 * Template-based campaigns keep their body on the template, so an empty content
 * with a templateId falls back to the template preview.
 */
function CampaignPreview({ campaign, live }: { campaign: Campaign; live: boolean }) {
  const [body, setBody] = useState<{ html: string; text: string } | null>(null);
  const [components, setComponents] = useState<Record<string, unknown> | null>(null);
  const [state, setState] = useState<'loading' | 'body' | 'template' | 'empty' | 'error'>(
    live ? 'loading' : 'empty',
  );

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void (async () => {
      try {
        const full = await api.get<ApiCampaign>(`campaigns/${campaign.id}`);
        if (!alive) return;
        const content = (full.content ?? {}) as { html?: unknown; text?: unknown };
        const html = typeof content.html === 'string' ? content.html : '';
        const text = typeof content.text === 'string' ? content.text : '';
        if (html.trim() || text.trim()) {
          // WhatsApp campaigns save only the body text; header/footer/buttons
          // live on the template, so fetch its structure for the full bubble.
          if (campaign.channel === 'whatsapp' && full.templateId) {
            try {
              const tpl = await api.get<ApiTemplate>(`templates/${full.templateId}`);
              if (!alive) return;
              setComponents(tpl.components ?? null);
            } catch {
              // Body-only bubble is still a valid preview.
            }
          }
          if (!alive) return;
          setBody({ html, text });
          setState('body');
        } else if (full.templateId) {
          setState('template');
        } else {
          setState('empty');
        }
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [campaign.id, campaign.channel, live]);

  if (!live) return <div className="aempty">No preview in local mode</div>;
  if (state === 'loading') return <div className="aempty">Loading preview…</div>;
  if (state === 'error') return <div className="aempty">Couldn’t load the preview.</div>;
  if (state === 'empty') return <div className="aempty">This campaign has no content yet.</div>;
  if (state === 'template' && campaign.templateId) {
    return <TemplatePreview id={campaign.templateId} channel={campaign.channel} live={live} />;
  }
  return (
    <MessagePreview
      html={body?.html}
      text={body?.text}
      channel={campaign.channel}
      components={components}
    />
  );
}

function CampaignDrawer({
  campaign,
  listColor,
  live,
  onClose,
  onEdit,
  onDuplicate,
  onViewReport,
  onDelete,
}: {
  campaign: Campaign;
  listColor?: string;
  live: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onViewReport: () => void;
  onDelete: () => void;
}) {
  // Sent and in-flight sends expose a report (partial while sending); drafts etc. stay editable.
  const showReport = campaign.status === 'sent' || campaign.status === 'sending';
  const reportCfg = channelReportConfig(campaign.channel);
  const deliveredPct = campaign.recipients ? (campaign.delivered / campaign.recipients) * 100 : 0;
  const cto =
    campaign.openRate && campaign.clickRate ? (campaign.clickRate / campaign.openRate) * 100 : null;
  const trackingCaps = trackingCapabilities(campaign.channel);
  const TRACKING_OFF = 'Tracking Off';

  const drawerKpi = (key: DrawerKpiKey): { label: string; value: string; color: string } => {
    const openOff = trackingCaps.opens.enabled && !campaign.trackOpens;
    const clickOff = trackingCaps.clicks.enabled && !campaign.trackClicks;
    switch (key) {
      case 'recipients':
        return {
          label: 'Recipients',
          value: campaign.recipients.toLocaleString('en-US'),
          color: 'var(--text)',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          value: `${deliveredPct.toFixed(1)}%`,
          color: 'var(--text)',
        };
      case 'open':
        return {
          label: 'Open rate',
          value: openOff ? TRACKING_OFF : pct(campaign.openRate),
          color: openOff ? 'var(--muted)' : 'var(--success-strong)',
        };
      case 'seen':
        // WhatsApp read receipts are channel-native — not a campaign toggle.
        return {
          label: 'Seen rate',
          value: pct(campaign.openRate),
          color: 'var(--success-strong)',
        };
      case 'click':
        return {
          label: 'Click rate',
          value: clickOff ? TRACKING_OFF : pct(campaign.clickRate),
          color: clickOff ? 'var(--muted)' : 'var(--accent-text)',
        };
      case 'cto': {
        const ctoOff = openOff || clickOff;
        return {
          label: campaign.channel === 'whatsapp' ? 'Click-to-seen' : 'Click-to-open',
          value: ctoOff ? TRACKING_OFF : cto == null ? '—' : `${cto.toFixed(1)}%`,
          color: ctoOff ? 'var(--muted)' : 'var(--warning-strong)',
        };
      }
      case 'unsubscribed':
        return {
          label: 'Unsubscribed',
          value: campaign.unsubscribed.toLocaleString('en-US'),
          color: 'var(--danger)',
        };
      case 'failed':
        return {
          label: campaign.channel === 'email' ? 'Bounced' : 'Failed',
          value: campaign.failed.toLocaleString('en-US'),
          color: 'var(--danger)',
        };
    }
  };
  const kpis = reportCfg.drawerKpis.map(drawerKpi);
  // Six KPIs read best as two rows of three. SMS has four delivery-only
  // tiles — a 2×2 grid keeps them readable; a single row of four squeezes
  // the labels. Voice's three stay on one row.
  const kpiCols =
    campaign.channel === 'sms' ? 2 : kpis.length % 3 === 0 ? 3 : Math.min(kpis.length, 4);

  // Focus management: focus into the panel on open, trap Tab, Esc closes, restore focus.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const list = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    list()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const els = list();
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        ref={panelRef}
        className="adrawer cbd"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${campaign.name} details`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Campaign details</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="adrawer__body">
          {/* framed preview on top, then title/status/audience — matches the
              template drawer's UX */}
          <div className={styles.drawerPreview}>
            <CampaignPreview campaign={campaign} live={live} />
          </div>

          <div className={styles.drawerTitleRow}>
            <h3 className={styles.drawerName}>{campaign.name}</h3>
            <StatusBadge status={campaign.status} />
          </div>

          {showReport ? (
            <div
              className={`adrawer__kpis ${styles.drawerKpis}`}
              style={{ gridTemplateColumns: `repeat(${kpiCols}, minmax(0, 1fr))` }}
            >
              {kpis.map((k) => (
                <div key={k.label} className="adrawer__kpi">
                  <div className="adrawer__kpi-k">{k.label}</div>
                  <div
                    className={`tnum adrawer__kpi-v${k.value === TRACKING_OFF ? ' adrawer__kpi-v--sm' : ''}`}
                    style={{ color: k.color }}
                  >
                    {k.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="aempty" style={{ marginTop: 18 }}>
              Performance metrics appear here once this campaign has been sent.
            </div>
          )}

          <p className={`adrawer__eyebrow ${styles.drawerEyebrow}`}>Details</p>
          <div className={styles.drawerDetails}>
            <div className="adetail">
              <span className="adetail__k">Channel</span>
              <span className="adetail__v">
                <ChannelPill channel={campaign.channel} />
              </span>
            </div>
            {campaign.listId ? (
              <div className="adetail">
                <span className="adetail__k">List</span>
                <span className="adetail__v">
                  <ListPill name={campaign.audience} color={listColor} />
                </span>
              </div>
            ) : campaign.segmentId ? (
              <div className="adetail">
                <span className="adetail__k">Segment</span>
                <span className="adetail__v">{campaign.audience}</span>
              </div>
            ) : (
              <div className="adetail">
                <span className="adetail__k">Audience</span>
                <span className="adetail__v">{campaign.audience}</span>
              </div>
            )}
            <div className="adetail">
              <span className="adetail__k">Recipients</span>
              <span className="adetail__v tnum">{campaign.recipients.toLocaleString('en-US')}</span>
            </div>
          </div>
        </div>
        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none', color: 'var(--danger)' }}
            aria-label={`Delete ${campaign.name}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="sbtn" style={{ flex: 1 }} onClick={onDuplicate}>
            Duplicate
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={() => (showReport ? onViewReport() : onEdit())}
          >
            {showReport ? 'View report' : 'Edit'}
          </button>
        </div>
      </div>
    </div>
  );
}
