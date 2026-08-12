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
import { RATE_BUCKETS, rateBucket } from '@/lib/app/templates-data';
import type { ApiTemplate } from '@/lib/app/template-map';
import type { ChannelSenders } from '@/lib/app/channel-senders';
import type { AudienceChoice, CampaignDraft, TemplateChoice } from './CampaignWizard.types';
import type { Campaign, CampaignStatus, ChannelType } from '@/types/app';
import Icon from './Icon';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import ConfirmDialog from './shared/ConfirmDialog';
import CampaignWizard from './CampaignWizard';
import TemplatePreview, { MessagePreview } from './shared/TemplatePreview';
import { CHANNEL } from './shared/channels';
import { ChannelPill, ListPill } from './shared/CampaignPills';
import {
  buildEventRateSeries,
  historySparkPoints,
  pickSpark,
  sameChannelHistory,
  type RecipientEvent,
} from './shared/campaign-events';
import StatusBadge from './shared/StatusBadge';
import { ago } from './shared/time';
import { useToast } from './shared/useToast';
import {
  CHANNEL_TABS,
  PAGE_SIZE,
  STATUS_FILTERS,
  STATUS_LABEL,
  pct,
} from './CampaignsBoard.logic';
import type { SortKey } from './CampaignsBoard.types';
import { visiblePageNumbers } from './shared/pagination';
import Sparkline, { type SparkPoint } from './shared/Sparkline';
import { routes } from '@/config/routes';
import styles from './CampaignsBoard.module.css';

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
  audiences,
  templates,
  senders,
}: {
  initial?: Campaign[];
  audiences?: AudienceChoice[];
  templates?: TemplateChoice[];
  senders?: ChannelSenders;
} = {}) {
  // Live workspace campaigns from SSR when provided; else the fixture preview.
  const live = initial !== undefined;
  const [campaigns, setCampaigns] = useState<Campaign[]>(initial ?? mockCampaigns);
  const [tab, setTab] = useState<ChannelType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Set<CampaignStatus>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'status' | 'opens' | 'clicks' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [page, setPage] = useState(1);
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
  const [wizard, setWizard] = useState<
    | { mode: 'create' }
    | {
        mode: 'edit';
        id: string;
        channel: ChannelType;
        name: string;
        subject: string;
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
    setWizard({ mode: 'create' });
    url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: campaigns.length };
    for (const t of CHANNEL_TABS) {
      if (t !== 'all') c[t] = campaigns.filter((x) => x.channel === t).length;
    }
    return c;
  }, [campaigns]);

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

  const rows = useMemo(() => {
    let list = campaigns.filter((c) => {
      if (tab !== 'all' && c.channel !== tab) return false;
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
  }, [tab, query, statusFilter, opensSel, clicksSel, sort, campaigns]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const startIdx = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, rows.length);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Snap back to the first page whenever the filtered set changes underneath.
  useEffect(() => {
    setPage(1);
  }, [tab, query, statusFilter, opensSel, clicksSel, sort]);

  // While any campaign is sending, refresh list so the progress bar advances.
  const hasSending = campaigns.some((c) => c.status === 'sending');
  useEffect(() => {
    if (!live || !hasSending) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await api.get<{ data: ApiCampaign[] }>('campaigns');
        if (!cancelled) setCampaigns(toCampaigns(res.data ?? []));
      } catch {
        /* keep last snapshot */
      }
    };
    const id = window.setInterval(() => void tick(), 3000);
    void tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
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
      setWizard({
        mode: 'edit',
        id: c.id,
        channel: c.channel,
        name: c.name,
        subject: '',
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
        trackOpens?: unknown;
        trackClicks?: unknown;
      };
      setWizard({
        mode: 'edit',
        id: c.id,
        channel: (full.channel as ChannelType) ?? c.channel,
        name: full.name,
        subject: typeof content.subject === 'string' ? content.subject : '',
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

  useEffect(() => {
    if (editDeepLinkDone.current) return;
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    const c = campaigns.find((x) => x.id === editId);
    if (!c) return;
    editDeepLinkDone.current = true;
    void openForEdit(c);
    const url = new URL(window.location.href);
    url.searchParams.delete('edit');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [campaigns]);

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

  const open = openId ? (campaigns.find((c) => c.id === openId) ?? null) : null;
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
        <button type="button" className="pbtn" onClick={() => setWizard({ mode: 'create' })}>
          <Icon name="plus" size={15} stroke={2.2} />
          Create campaign
        </button>
      </div>

      <div className={`atable ${styles.card}`}>
        {/* channel tabs — status is the toolbar filter */}
        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Campaign channel">
          {CHANNEL_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`atab${tab === t ? ' is-active' : ''}`}
              onClick={() => {
                setTab(t);
                setSelected(new Set());
              }}
            >
              {t === 'all' ? 'All' : CHANNEL[t].label}
              <span className="atab__count tnum">{counts[t] ?? 0}</span>
            </button>
          ))}
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
                    {STATUS_FILTERS.map((st) => (
                      <label key={st} className={styles.filteropt}>
                        <input
                          type="checkbox"
                          checked={statusFilter.has(st)}
                          onChange={() => toggleStatus(st)}
                        />
                        <span className={`astatus astatus--${st}`}>{STATUS_LABEL[st]}</span>
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
            <ColFilter
              label="Opens"
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
          </div>
          <FilterChipsRow
            chips={[
              ...[...statusFilter].map((st) => ({
                key: `status:${st}`,
                label: `Status: ${STATUS_LABEL[st]}`,
                onRemove: () => toggleStatus(st),
              })),
              ...[...opensSel].map((b) => ({
                key: `opens:${b}`,
                label: `Opens: ${b}`,
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
        <div className={`athead ${styles.grid}`}>
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
              className={sort.key === 'openRate' ? 'is-active' : undefined}
              onClick={() => toggleSort('openRate')}
            >
              Open <span className="tnum">{sortArrow('openRate')}</span>
            </button>
          </div>
          <div className={styles.colCenter}>
            <button
              type="button"
              className={sort.key === 'clickRate' ? 'is-active' : undefined}
              onClick={() => toggleSort('clickRate')}
            >
              Click <span className="tnum">{sortArrow('clickRate')}</span>
            </button>
          </div>
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

        {rows.length === 0 ? (
          <div className="atable__empty">No campaigns match your filters.</div>
        ) : (
          pageRows.map((c) => (
            <div
              key={c.id}
              className={`atrow ${styles.grid}${selected.has(c.id) ? ' is-selected' : ''}`}
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
              <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                {channelReportConfig(c.channel).rateCards.some((r) => r === 'open' || r === 'seen')
                  ? c.openRate != null
                    ? `${Math.round(c.openRate * 100)}%`
                    : '—'
                  : '—'}
              </div>
              <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                {/* A channel that cannot report the metric shows a dash, not 0% —
                    zero would read as "nobody opened it" rather than "never measured". */}
                {channelReportConfig(c.channel).rateCards.includes('click')
                  ? c.clickRate != null
                    ? `${Math.round(c.clickRate * 100)}%`
                    : '—'
                  : '—'}
              </div>
              <div className={`${styles.muted} ${styles.colCenter}`}>{ago(c.updatedAt)}</div>
            </div>
          ))
        )}

        {/* footer / pagination */}
        <div className={`atable__foot ${styles.foot}`}>
          <span className={rows.length === 0 ? undefined : 'tnum'}>
            {rows.length === 0
              ? 'No campaigns match your filters'
              : `${startIdx}–${endIdx} of ${rows.length} campaign${rows.length === 1 ? '' : 's'}`}
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
          history={sameChannelHistory(campaigns, open)}
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
  history,
  listColor,
  live,
  onClose,
  onEdit,
  onDuplicate,
  onViewReport,
  onDelete,
}: {
  campaign: Campaign;
  history: Campaign[];
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

  const [events, setEvents] = useState<RecipientEvent[]>([]);
  useEffect(() => {
    if (!live || !showReport) return;
    let cancelled = false;
    api
      .get<{ data: RecipientEvent[] }>(`campaigns/${campaign.id}/messages`)
      .then((res) => {
        if (!cancelled) setEvents(res.data ?? []);
      })
      .catch(() => {
        /* keep empty sparks on failure */
      });
    return () => {
      cancelled = true;
    };
  }, [live, showReport, campaign.id]);

  const eventSeries = buildEventRateSeries(events, campaign.recipients, campaign.channel);
  const historySeries = {
    delivery: historySparkPoints(history, (c) =>
      c.recipients > 0 ? (c.delivered / c.recipients) * 100 : null,
    ),
    open: historySparkPoints(history, (c) => (c.openRate != null ? c.openRate * 100 : null)),
    click: historySparkPoints(history, (c) => (c.clickRate != null ? c.clickRate * 100 : null)),
    unsub: historySparkPoints(history, (c) =>
      c.recipients > 0 ? (c.unsubscribed / c.recipients) * 100 : null,
    ),
    recipients: historySparkPoints(history, (c) => c.recipients),
    failed: historySparkPoints(history, (c) => c.failed),
    unsubCount: historySparkPoints(history, (c) => c.unsubscribed),
    cto: historySparkPoints(history, (c) =>
      c.openRate && c.clickRate ? (c.clickRate / c.openRate) * 100 : null,
    ),
  };
  const openPct = campaign.openRate != null ? campaign.openRate * 100 : 0;
  const clickPct = campaign.clickRate != null ? campaign.clickRate * 100 : 0;

  const drawerKpi = (
    key: DrawerKpiKey,
  ): {
    label: string;
    value: string;
    color: string;
    series: SparkPoint[];
    format: 'number' | 'percent';
  } => {
    switch (key) {
      case 'recipients':
        return {
          label: 'Recipients',
          value: campaign.recipients.toLocaleString('en-US'),
          color: 'var(--text)',
          series: pickSpark([], historySeries.recipients, campaign.recipients, 'Now'),
          format: 'number',
        };
      case 'delivered':
        return {
          label: 'Delivered',
          value: `${deliveredPct.toFixed(1)}%`,
          color: 'var(--text)',
          series: pickSpark(eventSeries.delivery, historySeries.delivery, deliveredPct, 'Now'),
          format: 'percent',
        };
      case 'open':
        return {
          label: 'Open rate',
          value: pct(campaign.openRate),
          color: 'var(--success-strong)',
          series: pickSpark(eventSeries.open, historySeries.open, openPct, 'Now'),
          format: 'percent',
        };
      case 'seen':
        return {
          label: 'Seen rate',
          value: pct(campaign.openRate),
          color: 'var(--success-strong)',
          series: pickSpark(eventSeries.open, historySeries.open, openPct, 'Now'),
          format: 'percent',
        };
      case 'click':
        return {
          label: 'Click rate',
          value: pct(campaign.clickRate),
          color: 'var(--accent)',
          series: pickSpark(eventSeries.click, historySeries.click, clickPct, 'Now'),
          format: 'percent',
        };
      case 'cto':
        return {
          label: campaign.channel === 'whatsapp' ? 'Click-to-seen' : 'Click-to-open',
          value: cto == null ? '—' : `${cto.toFixed(1)}%`,
          color: 'var(--warning-strong)',
          series: pickSpark([], historySeries.cto, cto ?? 0, 'Now'),
          format: 'percent',
        };
      case 'unsubscribed':
        return {
          label: 'Unsubscribed',
          value: campaign.unsubscribed.toLocaleString('en-US'),
          color: 'var(--danger)',
          series: pickSpark([], historySeries.unsubCount, campaign.unsubscribed, 'Now'),
          format: 'number',
        };
      case 'failed':
        return {
          label: campaign.channel === 'email' ? 'Bounced' : 'Failed',
          value: campaign.failed.toLocaleString('en-US'),
          color: 'var(--danger)',
          series: pickSpark([], historySeries.failed, campaign.failed, 'Now'),
          format: 'number',
        };
    }
  };
  const kpis = reportCfg.drawerKpis.map(drawerKpi);

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
            <div className={`adrawer__kpis ${styles.drawerKpis}`}>
              {kpis.map((k) => (
                <div key={k.label} className="adrawer__kpi">
                  <div className="adrawer__kpi-k">{k.label}</div>
                  <div className="tnum adrawer__kpi-v" style={{ color: k.color }}>
                    {k.value}
                  </div>
                  <Sparkline series={k.series} color={k.color} format={k.format} height={28} />
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
              <span className="adetail__k">Scheduled</span>
              <span className="adetail__v">
                {campaign.scheduledAt
                  ? new Date(campaign.scheduledAt).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </span>
            </div>
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
