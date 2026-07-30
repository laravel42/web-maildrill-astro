import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
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
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import StatusBadge from './shared/StatusBadge';
import { ago } from './shared/time';
import { useToast } from './shared/useToast';
import { STATUS_LABEL, TABS, PAGE_SIZE, pct } from './CampaignsBoard.logic';
import type { SortKey } from './CampaignsBoard.types';
import { visiblePageNumbers } from './shared/pagination';
import styles from './CampaignsBoard.module.css';

function ChannelPill({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className="apill" style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={12} />
      {m.label}
    </span>
  );
}

function DispatchProgress({
  progress,
  status,
}: {
  progress: number;
  status: 'sending' | 'sent';
}) {
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

const DEFAULT_LIST_COLOR = '#4f46e5';

/** A list identifier badge tinted with the list's own colour. */
function ListPill({ name, color }: { name: string; color?: string | null }) {
  const c = color || DEFAULT_LIST_COLOR;
  return (
    <span
      className="apill"
      style={{ background: `color-mix(in srgb, ${c} 14%, transparent)`, color: c }}
    >
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: c, flex: 'none' }} />
      {name}
    </span>
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
  const [tab, setTab] = useState<CampaignStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<Set<ChannelType>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'channel' | 'opens' | 'clicks' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Set while a destructive action waits on confirmation.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const { toast, show } = useToast(2600);
  const [wizard, setWizard] = useState<
    | { mode: 'create' }
    | {
        mode: 'edit';
        id: string;
        channel: ChannelType;
        name: string;
        subject: string;
        audienceIds: string[];
        templateId: string | null;
        message: string;
        schedule: 'now' | 'later';
        scheduledAt: string | null;
      }
    | null
  >(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: campaigns.length };
    for (const t of TABS) if (t !== 'all') c[t] = campaigns.filter((x) => x.status === t).length;
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
      if (tab !== 'all' && c.status !== tab) return false;
      if (channelFilter.size > 0 && !channelFilter.has(c.channel)) return false;
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
  }, [tab, query, channelFilter, opensSel, clicksSel, sort, campaigns]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const startIdx = rows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, rows.length);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Snap back to the first page whenever the filtered set changes underneath.
  useEffect(() => {
    setPage(1);
  }, [tab, query, channelFilter, opensSel, clicksSel, sort]);

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
      const content = (full.content ?? {}) as { text?: string; subject?: string };
      setWizard({
        mode: 'edit',
        id: c.id,
        channel: (full.channel as ChannelType) ?? c.channel,
        name: full.name,
        subject: typeof content.subject === 'string' ? content.subject : '',
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

  /* Delete selected — persists in live mode, else local-only. */
  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!live) {
      setCampaigns((prev) => prev.filter((c) => !selected.has(c.id)));
      show(`Deleted ${ids.length} campaign${ids.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`campaigns/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setCampaigns((prev) => prev.filter((c) => !okIds.has(c.id)));
    const failed = ids.length - okIds.size;
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} campaign${okIds.size === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
  };

  const toggleChannel = (ch: ChannelType) => {
    setChannelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
    setSelected(new Set()); // changing filters clears selection (spec §12)
  };

  const open = openId ? (campaigns.find((c) => c.id === openId) ?? null) : null;
  const report = reportId ? (campaigns.find((c) => c.id === reportId) ?? null) : null;
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  // Resolve a campaign's target-list colour from the audience picker data so the
  // detail views can tint the list badge; undefined when it targets a segment or
  // the list isn't in the loaded set (fixtures, or a since-deleted list).
  const listColorFor = (c: Campaign): string | undefined =>
    c.listId
      ? (audiences?.find((a) => a.kind === 'list' && a.id === c.listId)?.color ?? undefined)
      : undefined;

  // The report replaces the board (a screen, matching the design), not an overlay.
  if (report) {
    const reportTime = new Date(report.updatedAt).getTime();
    const history = campaigns
      .filter(
        (c) =>
          c.channel === report.channel &&
          (c.status === 'sent' || c.id === report.id) &&
          new Date(c.updatedAt).getTime() <= reportTime,
      )
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
    return (
      <CampaignReport
        campaign={report}
        history={history}
        listColor={listColorFor(report)}
        live={live}
        onBack={() => setReportId(null)}
        onDuplicate={() => {
          const c = report;
          setReportId(null);
          void duplicateCampaigns([c.id]);
        }}
      />
    );
  }

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
        {/* status tabs */}
        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Campaign status">
          {TABS.map((t) => (
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
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
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
                className={`${styles.filter}${channelFilter.size ? ' is-on' : ''}`}
                aria-expanded={openFilter === 'channel'}
                onClick={() => setOpenFilter((o) => (o === 'channel' ? null : 'channel'))}
              >
                <Icon name="filter" size={14} />
                Channel
                {channelFilter.size > 0 && (
                  <span className={styles.filtercount}>{channelFilter.size}</span>
                )}
                <Icon name="chevron-down" size={12} className={styles.filtercaret} />
              </button>
              {openFilter === 'channel' && (
                <>
                  <button
                    type="button"
                    className={styles.filterscrim}
                    aria-label="Close"
                    onClick={() => setOpenFilter(null)}
                  />
                  <div className={styles.filterpop} style={{ animation: 'pop .14s ease' }}>
                    {CHANNEL_ORDER.map((ch) => (
                      <label key={ch} className={styles.filteropt}>
                        <input
                          type="checkbox"
                          checked={channelFilter.has(ch)}
                          onChange={() => toggleChannel(ch)}
                        />
                        <ChannelPill channel={ch} />
                      </label>
                    ))}
                    {channelFilter.size > 0 && (
                      <button
                        type="button"
                        className={styles.filterclear}
                        onClick={() => {
                          setChannelFilter(new Set());
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
              ...[...channelFilter].map((ch) => {
                const m = CHANNEL[ch];
                return {
                  key: `ch:${ch}`,
                  label: m.label,
                  onRemove: () => toggleChannel(ch),
                  style: { background: m.tint, color: m.color },
                };
              }),
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
              setChannelFilter(new Set());
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
              onClick={() => setConfirmDelete(true)}
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
            <button type="button" onClick={() => toggleSort('name')}>
              Campaign <span className="tnum">{sortArrow('name')}</span>
            </button>
          </div>
          <div>Status</div>
          <div>Channel</div>
          <div className={styles.colCenter}>
            <button type="button" onClick={() => toggleSort('recipients')}>
              Recipients <span className="tnum">{sortArrow('recipients')}</span>
            </button>
          </div>
          <div className={styles.colCenter}>
            <button type="button" onClick={() => toggleSort('openRate')}>
              Open <span className="tnum">{sortArrow('openRate')}</span>
            </button>
          </div>
          <div className={styles.colCenter}>
            <button type="button" onClick={() => toggleSort('clickRate')}>
              Click <span className="tnum">{sortArrow('clickRate')}</span>
            </button>
          </div>
          <div className={styles.colCenter}>
            <button type="button" onClick={() => toggleSort('updatedAt')}>
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
                {c.openRate != null ? `${Math.round(c.openRate * 100)}%` : '—'}
              </div>
              <div className={`tnum ${styles.muted3} ${styles.colCenter}`}>
                {c.clickRate != null ? `${Math.round(c.clickRate * 100)}%` : '—'}
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
            const c = open;
            setOpenId(null);
            setReportId(c.id);
          }}
        />
      )}

      {wizard && (
        <CampaignWizard
          mode={wizard.mode}
          initialChannel={wizard.mode === 'edit' ? wizard.channel : 'email'}
          initialName={wizard.mode === 'edit' ? wizard.name : ''}
          initialSubject={wizard.mode === 'edit' ? wizard.subject : ''}
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
          title={`Delete ${selected.size} campaign${selected.size === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void removeSelected();
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
  listColor,
  live,
  onClose,
  onEdit,
  onDuplicate,
  onViewReport,
}: {
  campaign: Campaign;
  listColor?: string;
  live: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onViewReport: () => void;
}) {
  // Sent and in-flight sends expose a report (partial while sending); drafts etc. stay editable.
  const showReport = campaign.status === 'sent' || campaign.status === 'sending';
  const deliveredPct = campaign.recipients ? (campaign.delivered / campaign.recipients) * 100 : 0;
  const cto =
    campaign.openRate && campaign.clickRate ? (campaign.clickRate / campaign.openRate) * 100 : null;

  const kpis = [
    {
      label: 'Recipients',
      value: campaign.recipients.toLocaleString('en-US'),
      color: 'var(--text)',
    },
    { label: 'Delivered', value: `${deliveredPct.toFixed(1)}%`, color: 'var(--text)' },
    { label: 'Open rate', value: pct(campaign.openRate), color: 'var(--success-strong)' },
    { label: 'Click rate', value: pct(campaign.clickRate), color: 'var(--accent)' },
    {
      label: 'Click-to-open',
      value: cto == null ? '—' : `${cto.toFixed(1)}%`,
      color: 'var(--warning-strong)',
    },
    {
      label: 'Unsubscribed',
      value: campaign.unsubscribed.toLocaleString('en-US'),
      color: 'var(--danger)',
    },
  ];

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
            <div className={styles.drawerKpis}>
              {kpis.map((k) => (
                <div key={k.label} className={styles.drawerKpi}>
                  <div className={styles.drawerKpiLbl}>{k.label}</div>
                  <div className={`tnum ${styles.drawerKpiVal}`} style={{ color: k.color }}>
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

/* ------------------------- recipient events ------------------------------ */
/** One row from GET /v1/campaigns/:id/messages — a recipient's message outcome. */
type RecipientEvent = {
  id: string;
  recipientId: string | null;
  name: string | null;
  address: string;
  channel: ChannelType;
  status: string;
  clicked?: boolean;
  unsubscribed?: boolean;
  at: string | null;
};

const EVENT_TABS = [
  'all',
  'delivered',
  'opened',
  'clicked',
  'unsubscribed',
  'sent',
  'bounced',
  'queued',
] as const;
type EventKind = Exclude<(typeof EVENT_TABS)[number], 'all'>;

/** Collapse message status + engagement events into glanceable report events.
    The furthest stage wins: unsubscribed > clicked > opened > delivered. */
const eventKind = (e: Pick<RecipientEvent, 'status' | 'clicked' | 'unsubscribed'>): EventKind =>
  e.unsubscribed
    ? 'unsubscribed'
    : e.clicked
      ? 'clicked'
      : e.status === 'read'
        ? 'opened'
        : e.status === 'delivered'
          ? 'delivered'
          : e.status === 'failed' || e.status === 'expired'
            ? 'bounced'
            : e.status === 'sent' || e.status === 'submitted'
              ? 'sent'
              : 'queued';

const EVENT_META: Record<EventKind, { label: string; cls: string }> = {
  delivered: { label: 'Delivered', cls: 'astatus--sent' },
  opened: { label: 'Opened', cls: 'astatus--active' },
  clicked: { label: 'Clicked', cls: 'astatus--scheduled' },
  unsubscribed: { label: 'Unsubscribed', cls: 'astatus--unsubscribed' },
  sent: { label: 'Sent', cls: 'astatus--scheduled' },
  bounced: { label: 'Bounced', cls: 'astatus--bounced' },
  queued: { label: 'Queued', cls: 'astatus--draft' },
};

const EVENT_TAB_LABEL: Record<(typeof EVENT_TABS)[number], string> = {
  all: 'All',
  delivered: 'Delivered',
  opened: 'Opened',
  clicked: 'Clicked',
  unsubscribed: 'Unsubscribed',
  sent: 'Sent',
  bounced: 'Bounced',
  queued: 'Queued',
};

const EVENT_PAGE_SIZE = 15;

/**
 * Campaign report — the "View report" destination, rendered as a full screen
 * (see App.dc.html § campaignDetail): breadcrumb, header with actions, KPI
 * cards, an engagement-funnel card beside a campaign-details card, then the
 * per-recipient event table fed by real message outcomes. Open/click stages
 * the backend doesn't track yet read "Not tracked yet" rather than faking
 * numbers, and untracked engagement events are absent by design.
 */
function CampaignReport({
  campaign,
  history,
  listColor,
  live,
  onBack,
  onDuplicate,
}: {
  campaign: Campaign;
  /** Same-channel sent campaigns, chronological, ending with this one. */
  history: Campaign[];
  listColor?: string;
  live: boolean;
  onBack: () => void;
  onDuplicate: () => void;
}) {
  const base = campaign.recipients || 1;
  const deliveredPct = (campaign.delivered / base) * 100;
  const cto =
    campaign.openRate && campaign.clickRate ? (campaign.clickRate / campaign.openRate) * 100 : null;
  // openRate/clickRate are fractions (0–1) — pct() multiplies by 100.
  const opened =
    campaign.openRate != null ? Math.round(campaign.openRate * campaign.delivered) : null;
  const clicked =
    campaign.clickRate != null ? Math.round(campaign.clickRate * campaign.delivered) : null;
  const sentAt = campaign.scheduledAt ?? campaign.updatedAt;
  const sentLabel = sentAt
    ? new Date(sentAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : '—';

  /* The six mockup counters. Delivered/bounced/unsubscribed are real message
     state; opened/clicked/complaints stay "—" until engagement tracking lands
     rather than inventing numbers. */
  const kpis: { label: string; value: string; cls?: string; hint?: string }[] = [
    { label: 'Delivered', value: campaign.delivered.toLocaleString('en-US') },
    {
      label: 'Opened',
      value: opened != null ? opened.toLocaleString('en-US') : '—',
      cls: styles.kOpened,
      hint: opened == null ? 'No deliveries yet' : undefined,
    },
    {
      label: 'Clicked',
      value: clicked != null ? clicked.toLocaleString('en-US') : '—',
      cls: styles.kClicked,
      hint: clicked == null ? 'No deliveries yet' : undefined,
    },
    { label: 'Bounced', value: campaign.failed.toLocaleString('en-US'), cls: styles.kBounced },
    {
      label: 'Unsubscribed',
      value: campaign.unsubscribed.toLocaleString('en-US'),
      cls: styles.kDanger,
    },
    { label: 'Complaints', value: '—', cls: styles.kDanger, hint: 'Needs complaint webhooks' },
  ];

  const funnel: {
    label: string;
    count: number | null;
    barPct: number | null;
    color: string;
    empty: string;
  }[] = [
    {
      label: 'Recipients',
      count: campaign.recipients,
      barPct: 100,
      color: 'var(--text3)',
      empty: '—',
    },
    {
      label: 'Delivered',
      count: campaign.delivered,
      barPct: deliveredPct,
      color: 'var(--accent)',
      empty: '—',
    },
    {
      label: 'Opened',
      count: opened,
      barPct: opened != null ? (opened / base) * 100 : null,
      color: 'var(--success-strong)',
      empty: '—',
    },
    {
      label: 'Clicked',
      count: clicked,
      barPct: clicked != null ? (clicked / base) * 100 : null,
      color: 'var(--warning-strong)',
      empty: '—',
    },
  ];

  const audienceDetail: [string, ReactNode] = campaign.listId
    ? ['List', <ListPill name={campaign.audience} color={listColor} />]
    : campaign.segmentId
      ? ['Segment', campaign.audience]
      : ['Audience', campaign.audience];
  const details: [string, ReactNode][] = [
    ['Channel', <ChannelPill channel={campaign.channel} />],
    audienceDetail,
    ['Recipients', campaign.recipients.toLocaleString('en-US')],
    ['Unsubscribed', campaign.unsubscribed.toLocaleString('en-US')],
    ['Click-to-open', cto == null ? '—' : `${cto.toFixed(1)}%`],
    ['Sent', sentLabel],
  ];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onBack();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onBack]);

  // Per-recipient outcomes, loaded once per campaign when the service is wired.
  const [events, setEvents] = useState<RecipientEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventTab, setEventTab] = useState<(typeof EVENT_TABS)[number]>('all');
  const [eventPage, setEventPage] = useState(1);

  useEffect(() => {
    if (!live) return;
    let cancelled = false;
    setEventsLoading(true);
    api
      .get<{ data: RecipientEvent[] }>(`campaigns/${campaign.id}/messages`)
      .then((res) => {
        if (!cancelled) setEvents(res.data ?? []);
      })
      .catch(() => {
        /* keep the empty state on failure */
      })
      .finally(() => {
        if (!cancelled) setEventsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [live, campaign.id]);

  /* Rate cards: delivery/unsub are real; the delivery spark is the cumulative
     delivered share across the real event timeline (oldest → newest). */
  const unsubPct =
    campaign.recipients > 0 ? (campaign.unsubscribed / campaign.recipients) * 100 : 0;
  const deliverySeries = (() => {
    const timeline = [...events]
      .filter((e) => e.at != null)
      .sort((a, b) => new Date(a.at!).getTime() - new Date(b.at!).getTime());
    let delivered = 0;
    return timeline.map((e, i) => {
      const k = eventKind(e);
      if (k === 'delivered' || k === 'opened' || k === 'clicked') delivered += 1;
      return (delivered / (i + 1)) * 100;
    });
  })();
  const sparkPath = (series: number[], w = 120, h = 30): string => {
    if (series.length < 2) return '';
    const min = Math.min(...series);
    const max = Math.max(...series);
    const span = max - min || 1;
    return series
      .map((v, i) => {
        const x = (i / (series.length - 1)) * w;
        const y = h - 4 - ((v - min) / span) * (h - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };
  /* Period-over-period: same-channel campaign history drives the sparklines
     and the delta vs the previous campaign. */
  const deliveryHistory = history
    .map((c) => (c.recipients > 0 ? (c.delivered / c.recipients) * 100 : null))
    .filter((v): v is number => v != null);
  const openHistory = history
    .map((c) => (c.openRate != null ? c.openRate * 100 : null))
    .filter((v): v is number => v != null);
  const clickHistory = history
    .map((c) => (c.clickRate != null ? c.clickRate * 100 : null))
    .filter((v): v is number => v != null);
  const unsubHistory = history
    .map((c) => (c.recipients > 0 ? (c.unsubscribed / c.recipients) * 100 : null))
    .filter((v): v is number => v != null);
  const deltaOf = (series: number[]): number | null =>
    series.length >= 2 ? series[series.length - 1]! - series[series.length - 2]! : null;
  const asDelta = (
    d: number | null,
    goodWhenUp = true,
  ): { text: string; good: boolean } | undefined =>
    d == null || Math.abs(d) < 0.05
      ? undefined
      : {
          text: `${d > 0 ? '↑' : '↓'} ${Math.abs(d).toFixed(1)}%`,
          good: goodWhenUp ? d > 0 : d < 0,
        };

  const rateCards: {
    label: string;
    value: string;
    color: string;
    series: number[];
    delta?: { text: string; good: boolean };
    hint?: string;
  }[] = [
    {
      label: 'Delivery rate',
      value: `${deliveredPct.toFixed(1)}%`,
      color: 'var(--success-strong)',
      series: deliveryHistory.length >= 2 ? deliveryHistory : deliverySeries,
      delta: asDelta(deltaOf(deliveryHistory)),
    },
    {
      label: 'Open rate',
      value: pct(campaign.openRate),
      color: 'var(--accent)',
      series: openHistory.length >= 2 ? openHistory : [],
      delta: asDelta(deltaOf(openHistory)),
      hint: campaign.openRate == null ? 'No deliveries yet' : undefined,
    },
    {
      label: 'Click rate',
      value: pct(campaign.clickRate),
      color: '#8b5cf6',
      series: clickHistory.length >= 2 ? clickHistory : [],
      delta: asDelta(deltaOf(clickHistory)),
      hint: campaign.clickRate == null ? 'No deliveries yet' : undefined,
    },
    {
      label: 'Unsub rate',
      value: `${unsubPct.toFixed(1)}%`,
      color: 'var(--ch-voice)',
      series: unsubHistory.length >= 2 ? unsubHistory : [],
      delta: asDelta(deltaOf(unsubHistory), false),
    },
  ];

  const eventCounts: Record<string, number> = { all: events.length };
  for (const e of events) {
    const k = eventKind(e);
    eventCounts[k] = (eventCounts[k] ?? 0) + 1;
  }
  const filteredEvents =
    eventTab === 'all' ? events : events.filter((e) => eventKind(e) === eventTab);
  const eventPages = Math.max(1, Math.ceil(filteredEvents.length / EVENT_PAGE_SIZE));
  const safeEventPage = Math.min(eventPage, eventPages);
  const eventPagerPages = visiblePageNumbers(safeEventPage, eventPages);
  const pageEvents = filteredEvents.slice(
    (safeEventPage - 1) * EVENT_PAGE_SIZE,
    safeEventPage * EVENT_PAGE_SIZE,
  );
  const eventStart = filteredEvents.length === 0 ? 0 : (safeEventPage - 1) * EVENT_PAGE_SIZE + 1;
  const eventEnd = Math.min(safeEventPage * EVENT_PAGE_SIZE, filteredEvents.length);

  const exportEvents = () => {
    const head = 'recipient,address,channel,event,at';
    const lines = filteredEvents.map((e) =>
      [e.name ?? '', e.address, e.channel, EVENT_META[eventKind(e)].label, e.at ?? '']
        .map((v) => `"${String(v).replaceAll('"', '""')}"`)
        .join(','),
    );
    const blob = new Blob([[head, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `maildrill-${campaign.name.replaceAll(/\s+/g, '-').toLowerCase()}-events.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <button type="button" className={styles.reportBack} onClick={onBack}>
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
        Campaigns
      </button>

      <div className={styles.reportHead}>
        <div className={styles.reportHeadMain}>
          <div className={styles.reportTitleRow}>
            <h1 className={styles.reportName}>{campaign.name}</h1>
            <StatusBadge status={campaign.status} />
          </div>
          <p className={styles.reportSub}>
            To {campaign.audience}
            {sentAt ? ` · Sent ${sentLabel}` : ''}
          </p>
        </div>
        <div className={styles.reportHeadActions}>
          <button type="button" className="sbtn" onClick={onDuplicate}>
            <Icon name="copy" size={14} /> Duplicate
          </button>
        </div>
      </div>

      <div className={styles.rateRow}>
        {rateCards.map((r) => (
          <div key={r.label} className={styles.reportKpi} title={r.hint}>
            <div className={styles.rateTop}>
              <span className={styles.reportKpiLbl}>{r.label}</span>
              <span className={styles.rateValWrap}>
                <span className={`tnum ${styles.rateVal}`}>{r.value}</span>
                {r.delta && (
                  <span
                    className={`tnum ${styles.rateDelta} ${
                      r.delta.good ? styles.deltaGood : styles.deltaBad
                    }`}
                  >
                    {r.delta.text}
                  </span>
                )}
              </span>
            </div>
            {r.series.length >= 2 && (
              <svg
                className={styles.rateSpark}
                width="100%"
                height="30"
                viewBox="0 0 120 30"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <polyline
                  points={sparkPath(r.series)}
                  fill="none"
                  stroke={r.color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className={styles.reportRow}>
        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Engagement funnel</div>
          {funnel.map((f) => (
            <div key={f.label} className={styles.funnelRow}>
              <div className={styles.funnelTop}>
                <span className={styles.funnelLbl}>{f.label}</span>
                <span className={`tnum ${styles.funnelVal}`}>
                  {f.count == null
                    ? f.empty
                    : `${f.count.toLocaleString('en-US')}${
                        f.barPct != null ? ` · ${f.barPct.toFixed(1)}%` : ''
                      }`}
                </span>
              </div>
              <div className={styles.funnelTrack}>
                {f.barPct != null && (
                  <div
                    className={styles.funnelBar}
                    style={{ width: `${Math.max(f.barPct, 1.5)}%`, background: f.color }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Top devices</div>
          <p className={styles.reportEmptyNote}>
            Read receipts don&apos;t carry device info yet — the desktop / mobile / tablet split
            appears here once opens report the device that read the message.
          </p>
        </div>
      </div>

      <div className={`${styles.reportRow} ${styles.reportRow2}`}>
        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Campaign details</div>
          {details.map(([k, v]) => (
            <div key={k} className={styles.reportDetail}>
              <span className={styles.reportDetailK}>{k}</span>
              <span className={styles.reportDetailV}>{v}</span>
            </div>
          ))}
        </div>

        <div className={styles.reportCard}>
          <div className={styles.reportCardTitle}>Top links clicked</div>
          <p className={styles.reportEmptyNote}>
            Every click event records the URL it hit — the ranking shows up here once the links
            aggregation endpoint lands.
          </p>
        </div>
      </div>

      <div className={styles.reportKpis}>
        {kpis.map((k) => (
          <div key={k.label} className={styles.reportKpi} title={k.hint}>
            <div className={styles.reportKpiLbl}>{k.label}</div>
            <div className={`tnum ${styles.reportKpiVal}${k.cls ? ` ${k.cls}` : ''}`}>
              {k.value}
            </div>
          </div>
        ))}
      </div>

      {/* per-recipient events */}
      <section className={`atable ${styles.revCard}`} aria-label="Recipient events">
        <div className={styles.revHead}>
          <div>
            <h2 className="acrd__title">Recipient events</h2>
            <p className={styles.revSub}>Individual delivery activity, per recipient.</p>
          </div>
          <button
            type="button"
            className="sbtn"
            onClick={exportEvents}
            disabled={filteredEvents.length === 0}
          >
            <Icon name="download" size={14} /> Export
          </button>
        </div>

        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Event type">
          {EVENT_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={eventTab === t}
              className={`atab${eventTab === t ? ' is-active' : ''}`}
              onClick={() => {
                setEventTab(t);
                setEventPage(1);
              }}
            >
              {EVENT_TAB_LABEL[t]}
              <span className="atab__count tnum">{eventCounts[t] ?? 0}</span>
            </button>
          ))}
        </div>

        <div className={`athead ${styles.revGrid}`}>
          <div>Recipient</div>
          <div>Event</div>
          <div>Channel</div>
          <div className={styles.revWhenHead}>When</div>
        </div>

        {pageEvents.map((e) => {
          const kind = EVENT_META[eventKind(e)];
          const meta = CHANNEL[e.channel] ?? CHANNEL.email;
          const display = e.name?.trim() || e.address;
          return (
            <div key={e.id} className={`atrow ${styles.revGrid} ${styles.revRow}`}>
              <div className={styles.revCell}>
                <span
                  className={styles.revAv}
                  style={{ background: meta.tint, color: meta.color }}
                  aria-hidden="true"
                >
                  {display.charAt(0).toUpperCase()}
                </span>
                <div className={styles.revWho}>
                  <div className={styles.revName}>{display}</div>
                  <div className={`${styles.revAddr} tnum`}>{e.address}</div>
                </div>
              </div>
              <div>
                <span className={`astatus ${kind.cls}`}>{kind.label}</span>
              </div>
              <div className={styles.revChannel}>{meta.label}</div>
              <div className={`${styles.revWhen} tnum`}>{e.at ? ago(e.at) : '—'}</div>
            </div>
          );
        })}

        {!live && (
          <div className="atable__empty">
            Recipient events load from the delivery service once the workspace is connected.
          </div>
        )}
        {live && !eventsLoading && filteredEvents.length === 0 && (
          <div className="atable__empty">No recipient events for this campaign yet.</div>
        )}
        {live && eventsLoading && events.length === 0 && (
          <div className="atable__empty">Loading recipient events…</div>
        )}

        <div className="atable__foot">
          <span className={filteredEvents.length === 0 ? undefined : 'tnum'}>
            {filteredEvents.length === 0
              ? 'Opens, clicks, unsubscribes, and complaints appear once engagement tracking lands'
              : `${eventStart}–${eventEnd} of ${filteredEvents.length} events`}
          </span>
          {eventPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pg}
                disabled={safeEventPage === 1}
                onClick={() => setEventPage((p) => Math.max(1, p - 1))}
                aria-label="Previous page"
              >
                <Icon name="chevron-right" size={15} className={styles.pgflip} />
              </button>
              {eventPagerPages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.pgn} tnum${n === safeEventPage ? ' is-on' : ''}`}
                  aria-current={n === safeEventPage ? 'page' : undefined}
                  onClick={() => setEventPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pg}
                disabled={safeEventPage === eventPages}
                onClick={() => setEventPage((p) => Math.min(eventPages, p + 1))}
                aria-label="Next page"
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
