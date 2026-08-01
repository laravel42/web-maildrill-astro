import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ChannelType, TemplateApprovalStatus } from '@/types/app';

import {
  galleryTemplates,
  CATEGORY_COLOR,
  TEMPLATE_CATEGORIES,
  RATE_BUCKETS,
  rateBucket,
  type GalleryTemplate,
  type TplCategory,
} from '@/lib/app/templates-data';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import TemplatePreview from './shared/TemplatePreview';
import GalleryPreview, { FauxEmail } from './shared/GalleryPreview';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { useToast } from './shared/useToast';
import { visiblePageNumbers } from './shared/pagination';
import { CHANNEL_TABS, VIEWS, ASC_FIRST, PAGE_SIZE } from './AppTemplates.logic';
import type { ViewKey, SortKey } from './AppTemplates.types';
import { api, ApiError } from '@/lib/app/api';
import { toGalleryTemplate, type ApiTemplate } from '@/lib/app/template-map';
import { routes } from '@/config/routes';
import styles from './AppTemplates.module.css';

/* --------------------------------------------------------- small pieces ---- */

const APPROVAL_LABEL: Record<TemplateApprovalStatus, string> = {
  draft: 'Needs approval',
  pending: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
  paused: 'Paused',
  disabled: 'Disabled',
};

/** One-line explanation of each approval state, shown in the drawer + as a tooltip. */
const APPROVAL_HINT: Record<TemplateApprovalStatus, string> = {
  draft: 'Not submitted yet — submit it for Meta review.',
  pending: 'Submitted to Meta. Review usually takes a few minutes, up to 24h.',
  approved: 'Approved by Meta — ready to use in WhatsApp campaigns.',
  rejected: 'Meta rejected this template. Edit it and resubmit.',
  paused: 'Paused by Meta over quality — sending is temporarily blocked.',
  disabled: 'Disabled by Meta — this template can no longer be sent.',
};

/** Top-right approval icon for WhatsApp gallery cards; renders nothing otherwise. */
function ApprovalBadge({ t }: { t: GalleryTemplate }) {
  if (t.channel !== 'whatsapp') return null;
  const status = t.approvalStatus ?? 'draft';
  const meta =
    status === 'approved'
      ? { icon: 'check' as const, tone: 'ok' as const }
      : status === 'pending'
        ? { icon: 'clock' as const, tone: 'wait' as const }
        : status === 'rejected' || status === 'paused' || status === 'disabled'
          ? { icon: 'x' as const, tone: 'bad' as const }
          : { icon: 'alert-triangle' as const, tone: 'warn' as const };
  const hint = APPROVAL_HINT[status];
  return (
    <span
      className={`${styles.gApproval} ${styles[`gApproval_${meta.tone}`]}`}
      tabIndex={0}
      aria-label={`${APPROVAL_LABEL[status]}. ${hint}`}
    >
      <Icon name={meta.icon} size={13} stroke={2.6} />
      <span className={styles.gApprovalTip} role="tooltip">
        <strong>{APPROVAL_LABEL[status]}</strong>
        {hint}
      </span>
    </span>
  );
}

function ChannelBadge({ channel }: { channel: ChannelType }) {
  const m = CHANNEL[channel];
  return (
    <span className={styles.tbadge} style={{ background: m.tint, color: m.color }}>
      <Icon name={m.icon} size={11} />
      {m.label}
    </span>
  );
}

function Check({
  on,
  onClick,
  label,
  size = 17,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={`${styles.box}${on ? ' is-on' : ''}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
    >
      {on && <Icon name="check" size={Math.round(size * 0.88)} stroke={3.5} />}
    </button>
  );
}

/* --------------------------------------------------------------- screen ---- */

export default function AppTemplates({ initial }: { initial?: GalleryTemplate[] } = {}) {
  // Live workspace templates from SSR when provided; else the fixture gallery.
  const live = initial !== undefined;
  const [templates, setTemplates] = useState<GalleryTemplate[]>(
    initial !== undefined ? initial : galleryTemplates,
  );
  const [channelTab, setChannelTab] = useState<ChannelType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewKey>('gallery');
  const [catSel, setCatSel] = useState<Set<string>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'cat' | 'opens' | 'clicks' | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updated', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids waiting on the delete confirm dialog (bulk toolbar or drawer).
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, show } = useToast();

  const resetPage = () => setPage(1);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: templates.length };
    for (const t of CHANNEL_TABS)
      if (t !== 'all') c[t] = templates.filter((x) => x.channel === t).length;
    return c;
  }, [templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = templates.filter((t) => {
      if (channelTab !== 'all' && t.channel !== channelTab) return false;
      if (catSel.size && !catSel.has(t.category)) return false;
      if (opensSel.size && !opensSel.has(rateBucket(t.avgOpen))) return false;
      if (clicksSel.size && !clicksSel.has(rateBucket(t.avgClick))) return false;
      if (q && !t.name.toLowerCase().includes(q)) return false;
      return true;
    });
    const { key, dir } = sort;
    const val = (t: GalleryTemplate): string | number => {
      switch (key) {
        case 'name':
          return t.name.toLowerCase();
        case 'channel':
          return t.channel;
        case 'cat':
          return t.category.toLowerCase();
        case 'updated':
          return -t.updatedMin;
        case 'avgOpen':
          return t.avgOpen;
        case 'avgClick':
          return t.avgClick;
        default:
          return 0;
      }
    };
    return [...list].sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.name.localeCompare(b.name);
    });
  }, [channelTab, query, catSel, opensSel, clicksSel, sort, templates]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir * -1) as 1 | -1 }
        : { key, dir: ASC_FIRST.has(key) ? 1 : -1 },
    );
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  const toggleSet = (setter: Dispatch<SetStateAction<Set<string>>>) => (v: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    resetPage();
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allChecked = pageItems.length > 0 && pageItems.every((t) => selected.has(t.id));
  const toggleAll = () => setSelected(allChecked ? new Set() : new Set(pageItems.map((t) => t.id)));

  /* Delete by id list — persists to the service in live mode, else local-only. */
  const removeTemplates = async (ids: string[]) => {
    if (ids.length === 0) return;
    const doomed = new Set(ids);
    if (!live) {
      setTemplates((prev) => prev.filter((t) => !doomed.has(t.id)));
      show(`Deleted ${ids.length} template${ids.length === 1 ? '' : 's'}`);
      setSelected((prev) => new Set([...prev].filter((id) => !doomed.has(id))));
      if (openId && doomed.has(openId)) setOpenId(null);
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`templates/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setTemplates((prev) => prev.filter((t) => !okIds.has(t.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !okIds.has(id))));
    if (openId && okIds.has(openId)) setOpenId(null);
    const failed = ids.length - okIds.size;
    window.posthog?.capture('template_deleted', { count: okIds.size, failed });
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} template${okIds.size === 1 ? '' : 's'}`,
    );
  };

  /* Copy templates. The full row is fetched first because the gallery shape
     carries no html/text/builderDoc — copying from it would produce an empty
     template that looks like the original. */
  const duplicateTemplates = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!live) {
      show(`Duplicated ${ids.length} template${ids.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      return;
    }
    const results = await Promise.allSettled(
      ids.map(async (id) => {
        const full = await api.get<ApiTemplate>(`templates/${id}`);
        return api.post<ApiTemplate>('templates', {
          name: `${full.name} (copy)`,
          channel: full.channel,
          preheader: full.preheader ?? null,
          html: full.html ?? null,
          text: full.text ?? null,
          builderDoc: full.builderDoc ?? null,
          category: full.category ?? null,
        });
      }),
    );
    const made = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    setTemplates((prev) => [...made.map(toGalleryTemplate), ...prev]);
    const failed = ids.length - made.length;
    window.posthog?.capture('template_duplicated', { count: made.length, failed });
    show(
      failed
        ? `Duplicated ${made.length}, ${failed} failed`
        : `Duplicated ${made.length} template${made.length === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
  };

  /* Submit a WhatsApp template to Meta (via Infobip) for review. */
  const submitTemplate = async (id: string) => {
    if (!live) return;
    try {
      const updated = await api.post<ApiTemplate>(`templates/${id}/submit`, {});
      setTemplates((prev) => prev.map((t) => (t.id === id ? toGalleryTemplate(updated) : t)));
      show('Submitted for approval');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not submit for approval');
    }
  };

  /* Manual fallback when a status webhook was missed — pulls the live status. */
  const refreshApproval = async (id: string) => {
    if (!live) return;
    try {
      const updated = await api.post<ApiTemplate>(`templates/${id}/refresh-status`, {});
      setTemplates((prev) => prev.map((t) => (t.id === id ? toGalleryTemplate(updated) : t)));
      show('Approval status refreshed');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not refresh status');
    }
  };

  const openTpl = openId ? (templates.find((t) => t.id === openId) ?? null) : null;

  /* Each channel's builder lives on its own page (/dashboard/templates/<channel>);
     editing hands the id over via ?id= and the page SSR-fetches the saved row.
     Demo mode has no row to fetch, so it passes name/category prefills instead. */
  const builderHref = (tpl: GalleryTemplate) => {
    const params = new URLSearchParams(
      live ? { id: tpl.id } : { name: tpl.name, category: tpl.category },
    );
    return `${routes.app.templateBuilder(tpl.channel)}?${params}`;
  };
  const openForEdit = (tpl: GalleryTemplate) => window.location.assign(builderHref(tpl));

  // Sidebar pins: /dashboard/templates?edit=<id> forwards to that template's
  // channel builder page.
  const editDeepLinkDone = useRef(false);
  useEffect(() => {
    if (editDeepLinkDone.current) return;
    const editId = new URLSearchParams(window.location.search).get('edit');
    if (!editId) return;
    const tpl = templates.find((t) => t.id === editId);
    if (!tpl) return;
    editDeepLinkDone.current = true;
    window.location.replace(builderHref(tpl));
  }, [templates]);

  const setTab = (t: ChannelType | 'all') => {
    setChannelTab(t);
    setSelected(new Set());
    resetPage();
  };

  const empty = total === 0;
  const rangeStart = empty ? 0 : start + 1;
  const rangeEnd = Math.min(start + PAGE_SIZE, total);

  return (
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Templates</h1>
          <p className="screen__sub">Reusable email designs for your campaigns.</p>
        </div>
        <div className={styles.coldrop}>
          <button
            type="button"
            className="pbtn"
            aria-haspopup="menu"
            aria-expanded={newOpen}
            onClick={() => setNewOpen((v) => !v)}
          >
            <Icon name="plus" size={15} stroke={2.2} />
            New template
            <Icon name="chevron-down" size={13} />
          </button>
          {newOpen && (
            <>
              <button
                type="button"
                className={styles.colscrim}
                aria-label="Close menu"
                onClick={() => setNewOpen(false)}
              />
              <div
                className={styles.colpop}
                role="menu"
                aria-label="New template channel"
                style={{ left: 'auto', right: 0, animation: 'pop .14s ease' }}
              >
                {CHANNEL_ORDER.map((ch) => {
                  const m = CHANNEL[ch];
                  return (
                    <button
                      key={ch}
                      type="button"
                      role="menuitem"
                      className={styles.colopt}
                      onClick={() => {
                        setNewOpen(false);
                        window.location.assign(routes.app.templateBuilder(ch));
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          flex: 'none',
                          background: m.tint,
                          color: m.color,
                        }}
                      >
                        <Icon name={m.icon} size={13} />
                      </span>
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      <div className={`acrd ${styles.card}`}>
        {/* channel tab bar */}
        <div className={styles.tabs} role="tablist" aria-label="Filter by channel">
          {CHANNEL_TABS.map((t) => {
            const active = channelTab === t;
            const m = t === 'all' ? null : CHANNEL[t];
            const color = t === 'all' ? 'var(--accent)' : m!.color;
            return (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={active}
                className={`${styles.tab}${active ? ' is-active' : ''}`}
                style={{
                  color: active ? 'var(--text)' : 'var(--muted)',
                  borderBottomColor: active ? color : 'transparent',
                }}
                onClick={() => setTab(t)}
              >
                {m && <Icon name={m.icon} size={12} />}
                {t === 'all' ? 'All' : m!.label}
                <span
                  className={`${styles.tabcount} tnum`}
                  style={{
                    background: active
                      ? t === 'all'
                        ? 'var(--accent-tint)'
                        : m!.tint
                      : 'var(--surface2)',
                    color: active ? color : 'var(--muted)',
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
                placeholder="Search templates…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  resetPage();
                }}
                aria-label="Search templates"
              />
            </label>

            <ColFilter
              label="Category"
              icon="layers"
              options={TEMPLATE_CATEGORIES}
              selected={catSel}
              onToggle={toggleSet(setCatSel)}
              onClear={() => {
                setCatSel(new Set());
                resetPage();
              }}
              open={openFilter === 'cat'}
              onOpenToggle={() => setOpenFilter((o) => (o === 'cat' ? null : 'cat'))}
            />
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

            <span className={styles.spacer} />

            <div className={`aseg ${styles.seg}`} role="group" aria-label="View">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  className={`aseg__opt${view === v.key ? ' is-active' : ''}`}
                  aria-pressed={view === v.key}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <FilterChipsRow
            chips={[
              ...[...catSel].map((c) => ({
                key: `cat:${c}`,
                label: `Category: ${c}`,
                onRemove: () => toggleSet(setCatSel)(c),
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
              setCatSel(new Set());
              setOpensSel(new Set());
              setClicksSel(new Set());
              resetPage();
            }}
          />
        </div>

        {/* bulk-selection bar */}
        {selected.size > 0 && (
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={styles.bulkcount}>{selected.size} selected</span>
            <span className={styles.bulkdiv} />
            <button
              type="button"
              className={styles.bulkbtn}
              onClick={() => void duplicateTemplates([...selected])}
            >
              <Icon name="copy" size={13} /> Duplicate
            </button>
            <button
              type="button"
              className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
              onClick={() => setConfirmDelete([...selected])}
            >
              <Icon name="trash" size={13} /> Delete
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

        {/* body */}
        {empty ? (
          <div className="atable__empty">No templates match your filters.</div>
        ) : view === 'gallery' ? (
          <div className={styles.grid}>
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              const m = CHANNEL[t.channel];
              return (
                <div
                  key={t.id}
                  className={`acrd acrd--hover ${styles.gcard}`}
                  style={{ borderColor: sel ? 'var(--accent)' : undefined }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t.name}`}
                  onClick={() => setOpenId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(t.id);
                    }
                  }}
                >
                  <div className={styles.preview}>
                    <span className={styles.gcheck} onClick={(e) => e.stopPropagation()}>
                      <Check
                        on={sel}
                        onClick={() => toggleSelect(t.id)}
                        label={`Select ${t.name}`}
                        size={19}
                      />
                    </span>
                    <span className={styles.gTopRight}>
                      <span
                        className={styles.gbadge}
                        style={{ background: m.tint, color: m.color }}
                      >
                        <Icon name={m.icon} size={11} />
                        {m.label}
                      </span>
                      <ApprovalBadge t={t} />
                    </span>
                    <GalleryPreview channel={t.channel} t={t} />
                    <div className={styles.ov}>
                      <button
                        type="button"
                        className={styles.ovUse}
                        onClick={(e) => {
                          e.stopPropagation();
                          openForEdit(t);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={styles.ovPrev}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(t.id);
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                  <div
                    className={styles.gcatbar}
                    style={{
                      /* Text keeps the category hue but leans on the theme's
                         foreground so it stays readable on the tint in both
                         light and dark. */
                      color: `color-mix(in srgb, ${CATEGORY_COLOR[t.category] ?? 'var(--accent)'} 55%, var(--text))`,
                      background: `color-mix(in srgb, ${CATEGORY_COLOR[t.category] ?? 'var(--accent)'} 12%, transparent)`,
                    }}
                  >
                    {t.category}
                  </div>
                  <div className={styles.gmeta}>
                    <div className={styles.gname}>{t.name}</div>
                    <div className={styles.gsub}>
                      <span className={styles.metric}>
                        <span className="tnum">{t.avgOpen}%</span> opens
                      </span>
                      <span className={styles.metric}>
                        · <span className="tnum">{t.avgClick}%</span> clicks
                      </span>
                      <span className={styles.updated} title={`Updated ${t.updated}`}>
                        {t.updated}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* list view */
          <div className="tpl__list">
            <div className={`${styles.lhead} ${styles.lgrid}`}>
              <div className={styles.lcheck}>
                <Check on={allChecked} onClick={toggleAll} label="Select all on this page" />
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'name' ? styles.isActive : undefined}
                  onClick={() => toggleSort('name')}
                  aria-label="Sort by template"
                >
                  Template <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'channel' ? styles.isActive : undefined}
                  onClick={() => toggleSort('channel')}
                  aria-label="Sort by type"
                >
                  Type <span className="tnum">{sortArrow('channel')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'cat' ? styles.isActive : undefined}
                  onClick={() => toggleSort('cat')}
                  aria-label="Sort by category"
                >
                  Category <span className="tnum">{sortArrow('cat')}</span>
                </button>
              </div>
              <div className={styles.lcenter}>
                <button
                  type="button"
                  className={sort.key === 'updated' ? styles.isActive : undefined}
                  onClick={() => toggleSort('updated')}
                  aria-label="Sort by updated"
                >
                  Updated <span className="tnum">{sortArrow('updated')}</span>
                </button>
              </div>
              <div className={styles.lcenter}>
                <button
                  type="button"
                  className={sort.key === 'avgOpen' ? styles.isActive : undefined}
                  onClick={() => toggleSort('avgOpen')}
                  aria-label="Sort by opens"
                >
                  Opens <span className="tnum">{sortArrow('avgOpen')}</span>
                </button>
              </div>
              <div className={styles.lcenter}>
                <button
                  type="button"
                  className={sort.key === 'avgClick' ? styles.isActive : undefined}
                  onClick={() => toggleSort('avgClick')}
                  aria-label="Sort by clicks"
                >
                  Clicks <span className="tnum">{sortArrow('avgClick')}</span>
                </button>
              </div>
            </div>
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`${styles.lrow} ${styles.lgrid}${sel ? ' is-selected' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${t.name}`}
                  onClick={() => setOpenId(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenId(t.id);
                    }
                  }}
                >
                  <div className={styles.lcheck} onClick={(e) => e.stopPropagation()}>
                    <Check on={sel} onClick={() => toggleSelect(t.id)} label={`Select ${t.name}`} />
                  </div>
                  <div className={styles.lnameCell}>
                    <span className={styles.lchip} style={{ background: t.thumb, color: t.fg }}>
                      {t.title}
                    </span>
                    <span className={styles.lname}>{t.name}</span>
                  </div>
                  <div>
                    <ChannelBadge channel={t.channel} />
                  </div>
                  <div>
                    <span className={styles.catpill}>{t.category}</span>
                  </div>
                  <div className={`${styles.lcenter} ${styles.lmuted}`}>{t.updated}</div>
                  <div className={`${styles.lcenter} tnum ${styles.lmuted3}`}>{t.avgOpen}%</div>
                  <div className={`${styles.lcenter} tnum ${styles.lmuted3}`}>{t.avgClick}%</div>
                </div>
              );
            })}
          </div>
        )}

        {/* footer / pager */}
        <div className={styles.foot}>
          <span className="tnum">
            {empty
              ? 'No templates match your filters'
              : `${rangeStart}–${rangeEnd} of ${total} template${total === 1 ? '' : 's'}`}
          </span>
          {pageCount > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pgnav}
                disabled={safePage <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron-right" size={15} className={styles.pgleft} />
              </button>
              {pagerPages.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.pgbtn}${n === safePage ? ' is-active' : ''}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  aria-label={`Page ${n}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pgnav}
                disabled={safePage >= pageCount}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {openTpl && (
        <TemplateDrawer
          t={openTpl}
          live={live}
          onSubmit={() => submitTemplate(openTpl.id)}
          onRefresh={() => refreshApproval(openTpl.id)}
          onClose={() => setOpenId(null)}
          onUse={() => {
            if (openTpl) openForEdit(openTpl);
          }}
          onClone={() => {
            const id = openTpl.id;
            setOpenId(null);
            void duplicateTemplates([id]);
          }}
          onDelete={() => setConfirmDelete([openTpl.id])}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.length} template${confirmDelete.length === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const ids = confirmDelete;
            setConfirmDelete(null);
            void removeTemplates(ids);
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

/* --------------------------------------------------------------- drawer ---- */

function TemplateDrawer({
  t,
  live,
  onSubmit,
  onRefresh,
  onClose,
  onUse,
  onClone,
  onDelete,
}: {
  t: GalleryTemplate;
  live: boolean;
  onSubmit: () => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onClose: () => void;
  onUse: () => void;
  onClone: () => void;
  onDelete: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const catColor = CATEGORY_COLOR[t.category as TplCategory] ?? 'var(--accent)';
  // WhatsApp templates carry an approval status; other channels don't.
  const approval: TemplateApprovalStatus | null =
    t.channel === 'whatsapp' ? (t.approvalStatus ?? 'draft') : null;
  const details: [string, string][] = [
    ['Created on', t.createdOn ?? '—'],
    ['Last edited', t.updated],
  ];
  const runBusy = (fn: () => void | Promise<void>) => async () => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div
        className="adrawer tpld"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${t.name} preview`}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">Template preview</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body">
          <div className={styles.dPreview}>
            <TemplatePreview
              id={t.id}
              channel={t.channel}
              live={live}
              fallback={<FauxEmail t={t} variant="drawer" />}
            />
          </div>

          <div className={styles.dTitlerow}>
            <h3 className={styles.dName}>{t.name}</h3>
            <span
              className={styles.dCatpill}
              style={{
                color: catColor,
                background: `color-mix(in srgb, ${catColor} 14%, transparent)`,
              }}
            >
              {t.category}
            </span>
          </div>
          <div className={`adrawer__kpis ${styles.dStats}`}>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Avg. opens</div>
              <div className="tnum adrawer__kpi-v" style={{ color: '#4f46e5' }}>
                {t.avgOpen}%
              </div>
            </div>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Avg. clicks</div>
              <div className="tnum adrawer__kpi-v" style={{ color: '#0891b2' }}>
                {t.avgClick}%
              </div>
            </div>
          </div>

          {approval && (
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: '12px 14px',
                marginTop: 6,
                marginBottom: 16,
                background: 'var(--surface2)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <p className={`adrawer__eyebrow ${styles.dEyebrow}`} style={{ margin: 0 }}>
                  Approval status
                </p>
                <span className={`astatus tstat--${approval}`}>{APPROVAL_LABEL[approval]}</span>
              </div>
              <p
                style={{
                  fontSize: 12.5,
                  color: 'var(--text3)',
                  lineHeight: 1.5,
                  margin: '8px 0 0',
                }}
              >
                {APPROVAL_HINT[approval]}
              </p>
              {approval === 'rejected' && t.rejectionReason && (
                <div
                  style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    borderRadius: 8,
                    background: 'var(--danger-bg)',
                    color: 'var(--danger)',
                    fontSize: 12,
                  }}
                >
                  <strong>Reason:</strong> {t.rejectionReason}
                </div>
              )}
              {approval !== 'approved' && (
                <button
                  type="button"
                  className="pbtn"
                  style={{ width: '100%', marginTop: 12 }}
                  disabled={busy || !live || (approval !== 'pending' && !t.hasContent)}
                  onClick={runBusy(approval === 'pending' ? onRefresh : onSubmit)}
                >
                  {busy
                    ? 'Working…'
                    : approval === 'pending'
                      ? 'Refresh status'
                      : approval === 'rejected'
                        ? 'Resubmit for approval'
                        : 'Submit for approval'}
                </button>
              )}
              {live && approval !== 'pending' && approval !== 'approved' && !t.hasContent && (
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
                  Add template content before submitting for approval.
                </p>
              )}
              {!live && (
                <p style={{ fontSize: 11, color: 'var(--muted)', margin: '8px 0 0' }}>
                  Connect a workspace to submit templates.
                </p>
              )}
            </div>
          )}

          <p className={`adrawer__eyebrow ${styles.dEyebrow}`}>About this template</p>
          <div>
            {details.map(([k, v]) => (
              <div key={k} className="adetail">
                <span className="adetail__k">{k}</span>
                <span className="adetail__v">{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none', color: 'var(--danger)' }}
            aria-label={`Delete ${t.name}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="sbtn" style={{ flex: 1 }} onClick={onClone}>
            <Icon name="copy" size={14} /> Clone
          </button>
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onUse}>
            <Icon name="edit" size={14} /> Edit template
          </button>
        </div>
      </div>
    </div>
  );
}
