import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { ChannelType } from '@/types/app';
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
import EmailBuilder from './EmailBuilder';
import VisualEmailBuilder from './VisualEmailBuilder';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { useToast } from './shared/useToast';
import { CHANNEL_TABS, VIEWS, ASC_FIRST, PAGE_SIZE } from './AppTemplates.logic';
import type { ViewKey, SortKey } from './AppTemplates.types';
import { api, ApiError } from '@/lib/app/api';
import { toGalleryTemplate, type ApiTemplate } from '@/lib/app/template-map';
import type { TEditorConfiguration } from 'email-builder-standalone';
import styles from './AppTemplates.module.css';

/* --------------------------------------------------------- small pieces ---- */

/** Channel of a template, as a tinted pill. `compact` drops the label to an
 *  icon so it fits the compact card's single row. */
function ChannelBadge({ channel, compact = false }: { channel: ChannelType; compact?: boolean }) {
  const m = CHANNEL[channel];
  return (
    <span
      className={compact ? styles.cbadge : styles.tbadge}
      style={{ background: m.tint, color: m.color }}
      title={compact ? m.label : undefined}
      aria-label={compact ? m.label : undefined}
    >
      <Icon name={m.icon} size={11} />
      {!compact && m.label}
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
      {on && <Icon name="check" size={Math.round(size * 0.62)} stroke={3} />}
    </button>
  );
}

function StarBtn({
  on,
  onClick,
  name,
  size = 15,
}: {
  on: boolean;
  onClick: () => void;
  name: string;
  size?: number;
}) {
  return (
    <button
      type="button"
      className={styles.star}
      onClick={onClick}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      style={{ color: on ? '#f59e0b' : 'var(--border2)' }}
    >
      <Icon name="star" size={size} />
    </button>
  );
}

/** Recreated faux-email preview — pure CSS blocks, never a real image. */
function FauxEmail({ t, variant }: { t: GalleryTemplate; variant: 'card' | 'drawer' }) {
  const lg = variant === 'drawer';
  return (
    <div className={`${styles.mail}${lg ? ` ${styles.mailLg}` : ''}`} aria-hidden="true">
      <div className={styles.mailBand} style={{ background: t.thumb }}>
        <div className={styles.mailKicker} style={{ color: t.fg }}>
          {t.kicker}
        </div>
        <div className={styles.mailTitle} style={{ color: t.fg }}>
          {t.title}
        </div>
      </div>
      <div className={styles.mailBody}>
        <span className={styles.mailBar} style={{ width: '80%', background: '#e7e5e4' }} />
        <span className={styles.mailBar} style={{ width: '95%', background: '#efedec' }} />
        <span className={styles.mailBar} style={{ width: '60%', background: '#efedec' }} />
        <span className={styles.mailCta} style={{ background: t.accent }}>
          {t.cta}
        </span>
      </div>
    </div>
  );
}

/**
 * Real template preview for the drawer: fetches the saved template and renders
 * its actual content — the exported HTML for email (in a sandboxed iframe), the
 * message body for SMS/WhatsApp/Voice. The `FauxEmail` mockup is only used as
 * the fixture-mode stand-in, when there is no backend to read real content from.
 */
function TemplatePreview({
  id,
  channel,
  live,
  fallback,
}: {
  id: string;
  channel: ChannelType;
  live: boolean;
  fallback: React.ReactNode;
}) {
  const [state, setState] = useState<'loading' | 'ready' | 'empty' | 'error'>(
    live ? 'loading' : 'ready',
  );
  const [html, setHtml] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!live) return;
    let alive = true;
    void (async () => {
      try {
        const full = await api.get<ApiTemplate>(`templates/${id}`);
        if (!alive) return;
        if (full.html && full.html.trim()) {
          setHtml(full.html);
          setState('ready');
        } else if (full.text && full.text.trim()) {
          setText(full.text);
          setState('ready');
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
  }, [id, live]);

  // No workspace to read from — the CSS mockup is the honest stand-in.
  if (!live) return <>{fallback}</>;
  if (state === 'loading') return <div className={styles.pvMsg}>Loading preview…</div>;
  if (state === 'error') return <div className={styles.pvMsg}>Couldn’t load the preview.</div>;
  if (state === 'empty')
    return <div className={styles.pvMsg}>This template has no saved content yet.</div>;
  if (html) return <HtmlPreview html={html} />;
  return <TextPreview text={text ?? ''} channel={channel} />;
}

/**
 * Renders exported email HTML in a sandboxed iframe scaled to fit the drawer.
 * The frame allows same-origin (so the rendered height can be measured) but not
 * scripts, so any JS embedded in a template can't run.
 */
const EMAIL_LOGICAL_WIDTH = 600;
const PREVIEW_MAX_HEIGHT = 520;

function HtmlPreview({ html }: { html: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.55);
  const [docHeight, setDocHeight] = useState(EMAIL_LOGICAL_WIDTH);

  useLayoutEffect(() => {
    const measure = () => {
      const w = viewportRef.current?.clientWidth ?? EMAIL_LOGICAL_WIDTH;
      setScale(Math.min(1, w / EMAIL_LOGICAL_WIDTH));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (viewportRef.current) ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);

  const onLoad = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setDocHeight(h);
  };

  return (
    <div
      ref={viewportRef}
      className={styles.pvViewport}
      style={{ height: Math.min(docHeight * scale, PREVIEW_MAX_HEIGHT) }}
    >
      {/* reserves the scaled height so the viewport can scroll the whole email */}
      <div style={{ height: docHeight * scale, position: 'relative' }}>
        <iframe
          ref={frameRef}
          title="Template preview"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={onLoad}
          className={styles.pvFrame}
          style={{
            width: EMAIL_LOGICAL_WIDTH,
            height: docHeight,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      </div>
    </div>
  );
}

/** Message-body preview for the text channels. */
function TextPreview({ text, channel }: { text: string; channel: ChannelType }) {
  return (
    <div className={styles.pvText}>
      <div className={`${styles.pvBubble} ${channel === 'whatsapp' ? styles.pvBubbleWa : ''}`}>
        {text}
      </div>
    </div>
  );
}

function ColFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
  open,
  onOpenToggle,
}: {
  label: string;
  options: readonly string[];
  selected: Set<string>;
  onToggle: (v: string) => void;
  onClear: () => void;
  open: boolean;
  onOpenToggle: () => void;
}) {
  const count = selected.size;
  return (
    <div className={styles.coldrop}>
      <button
        type="button"
        className={`${styles.colbtn}${count ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onOpenToggle}
      >
        {label}
        {count > 0 && <span className={`${styles.colcount} tnum`}>{count}</span>}
        <Icon
          name="chevron-down"
          size={12}
          className={`${styles.colcaret}${open ? ` ${styles.caretOpen}` : ''}`}
        />
      </button>
      {open && (
        <>
          <button
            type="button"
            className={styles.colscrim}
            aria-label="Close filter"
            onClick={onOpenToggle}
          />
          <div
            className={styles.colpop}
            role="menu"
            aria-label={label}
            style={{ animation: 'pop .14s ease' }}
          >
            {options.map((o) => {
              const on = selected.has(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className={styles.colopt}
                  onClick={() => onToggle(o)}
                >
                  <span className={`${styles.box} ${styles.boxSm}${on ? ' is-on' : ''}`}>
                    {on && <Icon name="check" size={10} stroke={3} />}
                  </span>
                  {o}
                </button>
              );
            })}
            {count > 0 && (
              <button type="button" className={styles.colclear} onClick={onClear}>
                Clear
              </button>
            )}
          </div>
        </>
      )}
    </div>
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
  const [favIds, setFavIds] = useState<Set<string>>(
    () => new Set((initial ?? galleryTemplates).filter((t) => t.favorite).map((t) => t.id)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Set while a destructive action waits on confirmation.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, show } = useToast();
  const [builder, setBuilder] = useState<{
    channel: ChannelType;
    name: string | null;
    id?: string;
    document?: TEditorConfiguration;
    category?: string;
    /** Saved body for the SMS/WhatsApp/Voice composer when reopening. */
    message?: string;
  } | null>(
    null,
  );

  const isFav = (id: string) => favIds.has(id);

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
        case 'fav':
          return isFav(t.id) ? 1 : 0;
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
  }, [channelTab, query, catSel, opensSel, clicksSel, sort, favIds, templates]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
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

  const toggleFav = (id: string, name: string) => {
    setFavIds((prev) => {
      const next = new Set(prev);
      const willFav = !next.has(id);
      if (willFav) next.add(id);
      else next.delete(id);
      show(willFav ? `Added “${name}” to favorites` : `Removed “${name}” from favorites`);
      if (live) void api.patch(`templates/${id}`, { favorite: willFav }).catch(() => undefined);
      return next;
    });
  };

  /* Delete selected — persists to the service in live mode, else local-only. */
  const removeSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!live) {
      setTemplates((prev) => prev.filter((t) => !selected.has(t.id)));
      show(`Deleted ${ids.length} template${ids.length === 1 ? '' : 's'}`);
      setSelected(new Set());
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`templates/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setTemplates((prev) => prev.filter((t) => !okIds.has(t.id)));
    const failed = ids.length - okIds.size;
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} template${okIds.size === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
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
          subject: full.subject ?? null,
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
    show(
      failed
        ? `Duplicated ${made.length}, ${failed} failed`
        : `Duplicated ${made.length} template${made.length === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
  };

  /* Favorite/unfavorite in bulk, persisted per template. */
  const favoriteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (live) {
      const results = await Promise.allSettled(
        ids.map((id) => api.patch<ApiTemplate>(`templates/${id}`, { favorite: true })),
      );
      const okIds = ids.filter((_, i) => results[i].status === 'fulfilled');
      setFavIds((prev) => new Set([...prev, ...okIds]));
      const failed = ids.length - okIds.length;
      show(failed ? `Favorited ${okIds.length}, ${failed} failed` : `Favorited ${okIds.length}`);
    } else {
      setFavIds((prev) => new Set([...prev, ...ids]));
      show(`Favorited ${ids.length}`);
    }
    setSelected(new Set());
  };

  const openTpl = openId ? (templates.find((t) => t.id === openId) ?? null) : null;

  /* Open an editor on an existing template. The saved row is fetched for every
     channel — carrying `id` is what makes the editor PATCH in place instead of
     POSTing a copy, and the body has to come back with it or the first save
     would overwrite the stored content with an empty editor. */
  const openForEdit = async (tpl: GalleryTemplate) => {
    setOpenId(null);
    if (!live) {
      setBuilder({ channel: tpl.channel, name: tpl.name, category: tpl.category });
      return;
    }
    let full: ApiTemplate;
    try {
      full = await api.get<ApiTemplate>(`templates/${tpl.id}`);
    } catch (e) {
      // Opening without the saved content would let the next save destroy it,
      // so refuse to open rather than risk the template.
      show(e instanceof ApiError ? e.message : `Could not open “${tpl.name}”`);
      return;
    }
    setBuilder({
      channel: tpl.channel,
      name: tpl.name,
      id: tpl.id,
      category: full.category ?? tpl.category,
      document: (full.builderDoc as TEditorConfiguration | null) ?? undefined,
      message: full.text ?? undefined,
    });
  };

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
                        setBuilder({ channel: ch, name: null });
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

        {/* toolbar */}
        <div className={styles.toolbar}>
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
                <Icon name={v.icon} size={13} />
                <span className={styles.segLbl}>{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* bulk-selection bar */}
        {selected.size > 0 && (
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={styles.bulkcount}>{selected.size} selected</span>
            <span className={styles.bulkdiv} />
            <button type="button" className={styles.bulkbtn} onClick={() => void duplicateTemplates([...selected])}>
              <Icon name="copy" size={13} /> Duplicate
            </button>
            <button type="button" className={styles.bulkbtn} onClick={() => void favoriteSelected()}>
              <Icon name="star" size={13} /> Favorite
            </button>
            <button
              type="button"
              className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
              onClick={() => setConfirmDelete(true)}
            >
              <Icon name="trash" size={13} /> Delete
            </button>
            <button type="button" className={styles.bulkclear} onClick={() => setSelected(new Set())}>
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
                    <span className={styles.gbadge} style={{ background: m.tint, color: m.color }}>
                      <Icon name={m.icon} size={11} />
                      {m.label}
                    </span>
                    <FauxEmail t={t} variant="card" />
                    <div className={styles.ov}>
                      <button
                        type="button"
                        className={styles.ovUse}
                        onClick={(e) => {
                          e.stopPropagation();
                          void openForEdit(t);
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
                  <div className={styles.gmeta}>
                    <div className={styles.gmetaMain}>
                      <div className={styles.gname}>{t.name}</div>
                      <div className={styles.gsub}>
                        <span className={styles.catpill}>{t.category}</span>
                        <span className={styles.updated}>Updated {t.updated}</span>
                      </div>
                      <div className={styles.metrics}>
                        <span className={styles.metric}>
                          <span className={styles.dot} style={{ background: '#4f46e5' }} />
                          <span className="tnum">{t.avgOpen}%</span> opens
                        </span>
                        <span className={styles.metric}>
                          <span className={styles.dot} style={{ background: '#0891b2' }} />
                          <span className="tnum">{t.avgClick}%</span> clicks
                        </span>
                      </div>
                    </div>
                    <span onClick={(e) => e.stopPropagation()}>
                      <StarBtn
                        on={isFav(t.id)}
                        onClick={() => toggleFav(t.id, t.name)}
                        name={t.name}
                      />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === 'compact' ? (
          <div className={styles.compact}>
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              return (
                <div
                  key={t.id}
                  className={styles.ccard}
                  style={{ borderColor: sel ? 'var(--accent)' : 'var(--border)' }}
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
                  <div className={styles.cband} style={{ background: t.thumb, color: t.fg }}>
                    <span className={styles.ccheck} onClick={(e) => e.stopPropagation()}>
                      <Check
                        on={sel}
                        onClick={() => toggleSelect(t.id)}
                        label={`Select ${t.name}`}
                        size={18}
                      />
                    </span>
                    {t.title}
                  </div>
                  <div className={styles.cfoot}>
                    <div className={styles.crow}>
                      <ChannelBadge channel={t.channel} compact />
                      <span className={styles.cname}>{t.name}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <StarBtn
                          on={isFav(t.id)}
                          onClick={() => toggleFav(t.id, t.name)}
                          name={t.name}
                          size={13}
                        />
                      </span>
                    </div>
                    <div className={`${styles.cmetrics} tnum`}>
                      {t.avgOpen}% open · {t.avgClick}% click
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
                  onClick={() => toggleSort('name')}
                  aria-label="Sort by template"
                >
                  Template <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => toggleSort('channel')}
                  aria-label="Sort by type"
                >
                  Type <span className="tnum">{sortArrow('channel')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => toggleSort('cat')}
                  aria-label="Sort by category"
                >
                  Category <span className="tnum">{sortArrow('cat')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => toggleSort('updated')}
                  aria-label="Sort by updated"
                >
                  Updated <span className="tnum">{sortArrow('updated')}</span>
                </button>
              </div>
              <div className={styles.lright}>
                <button
                  type="button"
                  onClick={() => toggleSort('avgOpen')}
                  aria-label="Sort by opens"
                >
                  Opens <span className="tnum">{sortArrow('avgOpen')}</span>
                </button>
              </div>
              <div className={styles.lright}>
                <button
                  type="button"
                  onClick={() => toggleSort('avgClick')}
                  aria-label="Sort by clicks"
                >
                  Clicks <span className="tnum">{sortArrow('avgClick')}</span>
                </button>
              </div>
              <div className={styles.lcenter}>
                <button
                  type="button"
                  onClick={() => toggleSort('fav')}
                  aria-label="Sort by favorite"
                >
                  Fav <span className="tnum">{sortArrow('fav')}</span>
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
                  <div className={styles.lmuted}>{t.updated}</div>
                  <div className={`${styles.lright} tnum ${styles.lmuted3}`}>{t.avgOpen}%</div>
                  <div className={`${styles.lright} tnum ${styles.lmuted3}`}>{t.avgClick}%</div>
                  <div className={styles.lcenter} onClick={(e) => e.stopPropagation()}>
                    <StarBtn
                      on={isFav(t.id)}
                      onClick={() => toggleFav(t.id, t.name)}
                      name={t.name}
                    />
                  </div>
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
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
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
          fav={isFav(openTpl.id)}
          onFav={() => toggleFav(openTpl.id, openTpl.name)}
          onClose={() => setOpenId(null)}
          onUse={() => {
            if (openTpl) void openForEdit(openTpl);
          }}
          onClone={() => {
            const id = openTpl.id;
            setOpenId(null);
            void duplicateTemplates([id]);
          }}
        />
      )}

      {/* Email uses the full EmailBuilder.js visual editor; other channels keep
          the lightweight composer. */}
      {builder && builder.channel === 'email' && (
        <VisualEmailBuilder
          name={builder.name}
          initialDocument={builder.document}
          initialCategory={builder.category}
          onClose={() => setBuilder(null)}
          onSave={async ({ name, html, document, category }) => {
            const ed = builder;
            if (!ed) return;
            // Stay in the editor and let it show a saved badge; don't close.
            // Errors propagate so the editor surfaces them. Local (no-service)
            // mode just acknowledges.
            if (!live) return;
            const body = {
              name: name && name !== 'Untitled' ? name : 'Untitled template',
              channel: 'email' as const,
              html,
              builderDoc: document as Record<string, unknown>,
              category,
            };
            if (ed.id) {
              // Editing an existing template — update it in place.
              const updated = await api.patch<ApiTemplate>(`templates/${ed.id}`, body);
              setTemplates((prev) =>
                prev.map((t) => (t.id === ed.id ? toGalleryTemplate(updated) : t)),
              );
            } else {
              const created = await api.post<ApiTemplate>('templates', body);
              setTemplates((prev) => [toGalleryTemplate(created), ...prev]);
              // Switch to update mode so subsequent saves patch this template
              // instead of creating duplicates.
              setBuilder((prev) => (prev ? { ...prev, id: created.id } : prev));
            }
          }}
        />
      )}

      {builder && builder.channel !== 'email' && (
        <EmailBuilder
          channel={builder.channel}
          name={builder.name}
          kind="template"
          initialCategory={builder.category}
          initialMessage={builder.message}
          onClose={() => setBuilder(null)}
          onSave={async ({ channel, name, message, category }) => {
            const ed = builder;
            if (!ed || !live) return;
            const body = {
              name: name && name !== 'Untitled' ? name : 'Untitled template',
              channel,
              text: message || null,
              category,
            };
            if (ed.id) {
              const updated = await api.patch<ApiTemplate>(`templates/${ed.id}`, body);
              setTemplates((prev) =>
                prev.map((t) => (t.id === ed.id ? toGalleryTemplate(updated) : t)),
              );
            } else {
              const created = await api.post<ApiTemplate>('templates', body);
              setTemplates((prev) => [toGalleryTemplate(created), ...prev]);
              setBuilder((prev) => (prev ? { ...prev, id: created.id } : prev));
            }
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${selected.size} template${selected.size === 1 ? '' : 's'}?`}
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

/* --------------------------------------------------------------- drawer ---- */

function TemplateDrawer({
  t,
  live,
  fav,
  onFav,
  onClose,
  onUse,
  onClone,
}: {
  t: GalleryTemplate;
  live: boolean;
  fav: boolean;
  onFav: () => void;
  onClose: () => void;
  onUse: () => void;
  onClone: () => void;
}) {
  const catColor = CATEGORY_COLOR[t.category as TplCategory] ?? 'var(--accent)';
  const details: [string, string][] = [
    ['Category', t.category],
    ['Channel', CHANNEL[t.channel].label],
    ['Last edited', t.updated],
  ];

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
          <p className={styles.dUpdated}>Updated {t.updated}</p>

          <div className={styles.dStats}>
            <div className={styles.dStat}>
              <div className={styles.dStatLbl}>Avg. opens</div>
              <div className={`tnum ${styles.dStatVal}`} style={{ color: '#4f46e5' }}>
                {t.avgOpen}%
              </div>
            </div>
            <div className={styles.dStat}>
              <div className={styles.dStatLbl}>Avg. clicks</div>
              <div className={`tnum ${styles.dStatVal}`} style={{ color: '#0891b2' }}>
                {t.avgClick}%
              </div>
            </div>
          </div>

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
            className={`sbtn ${styles.dFavbtn}`}
            onClick={onFav}
            aria-pressed={fav}
            aria-label={fav ? 'Remove from favorites' : 'Add to favorites'}
            style={{ color: fav ? '#f59e0b' : 'var(--text3)' }}
          >
            <Icon name="star" size={16} />
          </button>
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={onClone}
          >
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
