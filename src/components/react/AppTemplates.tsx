import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
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
import type { IconName } from '@/lib/icons';

/* ---------------------------------------------------------------- meta ---- */

const CHANNEL: Record<ChannelType, { color: string; tint: string; icon: IconName; label: string }> =
  {
    email: { color: 'var(--ch-email)', tint: 'var(--ch-email-tint)', icon: 'mail', label: 'Email' },
    sms: { color: 'var(--ch-sms)', tint: 'var(--ch-sms-tint)', icon: 'sms', label: 'SMS' },
    whatsapp: {
      color: 'var(--ch-whatsapp)',
      tint: 'var(--ch-whatsapp-tint)',
      icon: 'whatsapp',
      label: 'WhatsApp',
    },
    voice: {
      color: 'var(--ch-voice)',
      tint: 'var(--ch-voice-tint)',
      icon: 'voice',
      label: 'Voice',
    },
  };

const CHANNEL_TABS: (ChannelType | 'all')[] = ['all', 'email', 'sms', 'whatsapp', 'voice'];
const VIEWS = [
  { key: 'gallery', label: 'Gallery', icon: 'templates' as IconName },
  { key: 'list', label: 'List', icon: 'lists' as IconName },
  { key: 'compact', label: 'Compact', icon: 'dashboard' as IconName },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

type SortKey = 'name' | 'cat' | 'updated' | 'avgOpen' | 'avgClick' | 'fav';
const ASC_FIRST = new Set<SortKey>(['name', 'cat']);
const PAGE_SIZE = 10;

/* --------------------------------------------------------- small pieces ---- */

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
      className={`tpl__box${on ? ' is-on' : ''}`}
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
      className="tpl__star"
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
    <div className={`tpl__mail${lg ? ' tpl__mail--lg' : ''}`} aria-hidden="true">
      <div className="tpl__mail-band" style={{ background: t.thumb }}>
        <div className="tpl__mail-kicker" style={{ color: t.fg }}>
          {t.kicker}
        </div>
        <div className="tpl__mail-title" style={{ color: t.fg }}>
          {t.title}
        </div>
      </div>
      <div className="tpl__mail-body">
        <span className="tpl__mail-bar" style={{ width: '80%', background: '#e7e5e4' }} />
        <span className="tpl__mail-bar" style={{ width: '95%', background: '#efedec' }} />
        <span className="tpl__mail-bar" style={{ width: '60%', background: '#efedec' }} />
        <span className="tpl__mail-cta" style={{ background: t.accent }}>
          {t.cta}
        </span>
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
    <div className="tpl__coldrop">
      <button
        type="button"
        className={`tpl__colbtn${count ? ' is-on' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={onOpenToggle}
      >
        {label}
        {count > 0 && <span className="tpl__colcount tnum">{count}</span>}
        <Icon name="chevron-down" size={12} className={`tpl__colcaret${open ? ' is-open' : ''}`} />
      </button>
      {open && (
        <>
          <button
            type="button"
            className="tpl__colscrim"
            aria-label="Close filter"
            onClick={onOpenToggle}
          />
          <div className="tpl__colpop" role="menu" aria-label={label}>
            {options.map((o) => {
              const on = selected.has(o);
              return (
                <button
                  key={o}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={on}
                  className="tpl__colopt"
                  onClick={() => onToggle(o)}
                >
                  <span className={`tpl__box tpl__box--sm${on ? ' is-on' : ''}`}>
                    {on && <Icon name="check" size={10} stroke={3} />}
                  </span>
                  {o}
                </button>
              );
            })}
            {count > 0 && (
              <button type="button" className="tpl__colclear" onClick={onClear}>
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

export default function AppTemplates() {
  const [channelTab, setChannelTab] = useState<ChannelType | 'all'>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewKey>('gallery');
  const [catSel, setCatSel] = useState<Set<string>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'cat' | 'opens' | 'clicks' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updated', dir: -1 });
  const [favIds, setFavIds] = useState<Set<string>>(
    () => new Set(galleryTemplates.filter((t) => t.favorite).map((t) => t.id)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isFav = (id: string) => favIds.has(id);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const resetPage = () => setPage(1);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: galleryTemplates.length };
    for (const t of CHANNEL_TABS)
      if (t !== 'all') c[t] = galleryTemplates.filter((x) => x.channel === t).length;
    return c;
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = galleryTemplates.filter((t) => {
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
  }, [channelTab, query, catSel, opensSel, clicksSel, sort, favIds]);

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
      if (next.has(id)) {
        next.delete(id);
        showToast(`Removed “${name}” from favorites`);
      } else {
        next.add(id);
        showToast(`Added “${name}” to favorites`);
      }
      return next;
    });
  };

  const bulk = (verb: string) => {
    const n = selected.size;
    showToast(`${verb} ${n} template${n === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  const openTpl = openId ? (galleryTemplates.find((t) => t.id === openId) ?? null) : null;

  const setTab = (t: ChannelType | 'all') => {
    setChannelTab(t);
    setSelected(new Set());
    resetPage();
  };

  const empty = total === 0;
  const rangeStart = empty ? 0 : start + 1;
  const rangeEnd = Math.min(start + PAGE_SIZE, total);

  return (
    <div className="screen tpl">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Templates</h1>
          <p className="screen__sub">Reusable email designs for your campaigns.</p>
        </div>
        <button
          type="button"
          className="pbtn"
          onClick={() => showToast('Opening template builder…')}
        >
          <Icon name="plus" size={15} stroke={2.2} />
          New template
        </button>
      </div>

      <div className="acrd tpl__card">
        {/* channel tab bar */}
        <div className="tpl__tabs" role="tablist" aria-label="Filter by channel">
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
                className={`tpl__tab${active ? ' is-active' : ''}`}
                style={{
                  color: active ? 'var(--text)' : 'var(--muted)',
                  borderBottomColor: active ? color : 'transparent',
                }}
                onClick={() => setTab(t)}
              >
                {m && <Icon name={m.icon} size={12} />}
                {t === 'all' ? 'All' : m!.label}
                <span
                  className="tpl__tabcount tnum"
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
        <div className="tpl__toolbar">
          <label className="tpl__search">
            <Icon name="search" size={15} className="tpl__searchic" />
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

          <span className="tpl__spacer" />

          <div className="aseg tpl__seg" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                className={`aseg__opt${view === v.key ? ' is-active' : ''}`}
                aria-pressed={view === v.key}
                onClick={() => setView(v.key)}
              >
                <Icon name={v.icon} size={13} />
                <span className="tpl__seg-lbl">{v.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* bulk-selection bar */}
        {selected.size > 0 && (
          <div className="tpl__bulk">
            <span className="tpl__bulkcount">{selected.size} selected</span>
            <span className="tpl__bulkdiv" />
            <button type="button" className="tpl__bulkbtn" onClick={() => bulk('Duplicated')}>
              <Icon name="copy" size={13} /> Duplicate
            </button>
            <button type="button" className="tpl__bulkbtn" onClick={() => bulk('Favorited')}>
              <Icon name="star" size={13} /> Favorite
            </button>
            <button
              type="button"
              className="tpl__bulkbtn tpl__bulkbtn--danger"
              onClick={() => bulk('Deleted')}
            >
              <Icon name="trash" size={13} /> Delete
            </button>
            <button type="button" className="tpl__bulkclear" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        {/* body */}
        {empty ? (
          <div className="atable__empty">No templates match your filters.</div>
        ) : view === 'gallery' ? (
          <div className="tpl__grid">
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              const m = CHANNEL[t.channel];
              return (
                <div
                  key={t.id}
                  className="acrd acrd--hover tpl__gcard"
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
                  <div className="tpl__preview">
                    <span className="tpl__gcheck" onClick={(e) => e.stopPropagation()}>
                      <Check
                        on={sel}
                        onClick={() => toggleSelect(t.id)}
                        label={`Select ${t.name}`}
                        size={19}
                      />
                    </span>
                    <span className="tpl__gbadge" style={{ background: m.tint, color: m.color }}>
                      <Icon name={m.icon} size={11} />
                      {m.label}
                    </span>
                    <FauxEmail t={t} variant="card" />
                    <div className="tpl__ov">
                      <button
                        type="button"
                        className="tpl__ov-use"
                        onClick={(e) => {
                          e.stopPropagation();
                          showToast(`Using “${t.name}”`);
                        }}
                      >
                        Use
                      </button>
                      <button
                        type="button"
                        className="tpl__ov-prev"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenId(t.id);
                        }}
                      >
                        Preview
                      </button>
                    </div>
                  </div>
                  <div className="tpl__gmeta">
                    <div className="tpl__gmeta-main">
                      <div className="tpl__gname">{t.name}</div>
                      <div className="tpl__gsub">
                        <span className="tpl__catpill">{t.category}</span>
                        <span className="tpl__updated">Updated {t.updated}</span>
                      </div>
                      <div className="tpl__metrics">
                        <span className="tpl__metric">
                          <span className="tpl__dot" style={{ background: '#4f46e5' }} />
                          <span className="tnum">{t.avgOpen}%</span> opens
                        </span>
                        <span className="tpl__metric">
                          <span className="tpl__dot" style={{ background: '#0891b2' }} />
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
          <div className="tpl__compact">
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              return (
                <div
                  key={t.id}
                  className="tpl__ccard"
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
                  <div className="tpl__cband" style={{ background: t.thumb, color: t.fg }}>
                    <span className="tpl__ccheck" onClick={(e) => e.stopPropagation()}>
                      <Check
                        on={sel}
                        onClick={() => toggleSelect(t.id)}
                        label={`Select ${t.name}`}
                        size={18}
                      />
                    </span>
                    {t.title}
                  </div>
                  <div className="tpl__cfoot">
                    <div className="tpl__crow">
                      <span className="tpl__cname">{t.name}</span>
                      <span onClick={(e) => e.stopPropagation()}>
                        <StarBtn
                          on={isFav(t.id)}
                          onClick={() => toggleFav(t.id, t.name)}
                          name={t.name}
                          size={13}
                        />
                      </span>
                    </div>
                    <div className="tpl__cmetrics tnum">
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
            <div className="tpl__lhead tpl__lgrid">
              <div className="tpl__lcheck">
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
              <div className="tpl__lright">
                <button
                  type="button"
                  onClick={() => toggleSort('avgOpen')}
                  aria-label="Sort by opens"
                >
                  Opens <span className="tnum">{sortArrow('avgOpen')}</span>
                </button>
              </div>
              <div className="tpl__lright">
                <button
                  type="button"
                  onClick={() => toggleSort('avgClick')}
                  aria-label="Sort by clicks"
                >
                  Clicks <span className="tnum">{sortArrow('avgClick')}</span>
                </button>
              </div>
              <div className="tpl__lcenter">
                <button
                  type="button"
                  onClick={() => toggleSort('fav')}
                  aria-label="Sort by favorite"
                >
                  Fav <span className="tnum">{sortArrow('fav')}</span>
                </button>
              </div>
              <div />
            </div>
            {pageItems.map((t) => {
              const sel = selected.has(t.id);
              return (
                <div
                  key={t.id}
                  className={`tpl__lrow tpl__lgrid${sel ? ' is-selected' : ''}`}
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
                  <div className="tpl__lcheck" onClick={(e) => e.stopPropagation()}>
                    <Check on={sel} onClick={() => toggleSelect(t.id)} label={`Select ${t.name}`} />
                  </div>
                  <div className="tpl__lname-cell">
                    <span className="tpl__lchip" style={{ background: t.thumb, color: t.fg }}>
                      {t.title}
                    </span>
                    <span className="tpl__lname">{t.name}</span>
                  </div>
                  <div>
                    <span className="tpl__catpill">{t.category}</span>
                  </div>
                  <div className="tpl__lmuted">{t.updated}</div>
                  <div className="tpl__lright tnum tpl__lmuted3">{t.avgOpen}%</div>
                  <div className="tpl__lright tnum tpl__lmuted3">{t.avgClick}%</div>
                  <div className="tpl__lcenter" onClick={(e) => e.stopPropagation()}>
                    <StarBtn
                      on={isFav(t.id)}
                      onClick={() => toggleFav(t.id, t.name)}
                      name={t.name}
                    />
                  </div>
                  <div className="tpl__lcenter" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="kbtn"
                      aria-label={`Actions for ${t.name}`}
                      onClick={() => showToast('Row menu')}
                    >
                      <Icon name="more" size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* footer / pager */}
        <div className="tpl__foot">
          <span className="tnum">
            {empty
              ? 'No templates match your filters'
              : `${rangeStart}–${rangeEnd} of ${total} template${total === 1 ? '' : 's'}`}
          </span>
          {pageCount > 1 && (
            <div className="tpl__pager">
              <button
                type="button"
                className="tpl__pgnav"
                disabled={safePage <= 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron-right" size={15} className="tpl__pgleft" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`tpl__pgbtn${n === safePage ? ' is-active' : ''}`}
                  aria-current={n === safePage ? 'page' : undefined}
                  aria-label={`Page ${n}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className="tpl__pgnav"
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
          fav={isFav(openTpl.id)}
          onFav={() => toggleFav(openTpl.id, openTpl.name)}
          onClose={() => setOpenId(null)}
          onToast={showToast}
          onUse={() => {
            setOpenId(null);
            showToast(`Editing “${openTpl.name}”`);
          }}
        />
      )}

      {toast && (
        <div className="tpl__toast" role="status">
          <span className="tpl__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

/* --------------------------------------------------------------- drawer ---- */

function TemplateDrawer({
  t,
  fav,
  onFav,
  onClose,
  onToast,
  onUse,
}: {
  t: GalleryTemplate;
  fav: boolean;
  onFav: () => void;
  onClose: () => void;
  onToast: (m: string) => void;
  onUse: () => void;
}) {
  const catColor = CATEGORY_COLOR[t.category as TplCategory] ?? 'var(--accent)';
  const details: [string, string][] = [
    ['Category', t.category],
    ['Channel', CHANNEL[t.channel].label],
    ['Last edited', t.updated],
    ['Used in', '3 campaigns'],
    ['Blocks', 'Header · Hero · CTA · Footer'],
    ['Responsive', 'Mobile optimized'],
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
          <div className="tpld__preview">
            <FauxEmail t={t} variant="drawer" />
          </div>

          <div className="tpld__titlerow">
            <h3 className="tpld__name">{t.name}</h3>
            <span
              className="tpld__catpill"
              style={{
                color: catColor,
                background: `color-mix(in srgb, ${catColor} 14%, transparent)`,
              }}
            >
              {t.category}
            </span>
          </div>
          <p className="tpld__updated">Updated {t.updated}</p>

          <div className="tpld__stats">
            <div className="tpld__stat">
              <div className="tpld__stat-lbl">Avg. opens</div>
              <div className="tnum tpld__stat-val" style={{ color: '#4f46e5' }}>
                {t.avgOpen}%
              </div>
            </div>
            <div className="tpld__stat">
              <div className="tpld__stat-lbl">Avg. clicks</div>
              <div className="tnum tpld__stat-val" style={{ color: '#0891b2' }}>
                {t.avgClick}%
              </div>
            </div>
          </div>

          <p className="adrawer__eyebrow tpld__eyebrow">About this template</p>
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
            className="sbtn tpld__favbtn"
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
            onClick={() => onToast(`Cloned “${t.name}”`)}
          >
            <Icon name="copy" size={14} /> Clone
          </button>
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onUse}>
            Use template
          </button>
        </div>

        <style>{`
          .tpld__preview { background: var(--surface2); border: 1px solid var(--border); border-radius: 14px; padding: 22px; display: flex; justify-content: center; }
          .tpld__titlerow { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 20px; }
          .tpld__name { font-size: 18px; font-weight: 600; letter-spacing: -.3px; margin: 0; }
          .tpld__catpill { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; flex: none; }
          .tpld__updated { font-size: 12.5px; color: var(--muted); margin: 6px 0 0; }
          .tpld__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
          .tpld__stat { background: var(--surface2); border: 1px solid var(--border); border-radius: 12px; padding: 12px 13px; }
          .tpld__stat-lbl { font-size: 11px; color: var(--muted); }
          .tpld__stat-val { font-size: 21px; font-weight: 600; margin-top: 3px; }
          .tpld__eyebrow { margin: 24px 0 8px; }
          .tpld__favbtn { flex: none; width: 40px; padding: 0; }
        `}</style>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- styles ---- */

const styles = `
  .tpl { animation: fade .3s ease; }
  .tpl__card { overflow: visible; }

  /* channel tabs */
  .tpl__tabs { display: flex; gap: 20px; padding: 0 19px; border-bottom: 1px solid var(--divider); overflow-x: auto; }
  .tpl__tab { display: inline-flex; align-items: center; gap: 6px; padding: 14px 0 13px; font-size: 13px; font-weight: 600; white-space: nowrap; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color var(--duration-fast) var(--ease-out); }
  .tpl__tabcount { font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 20px; }

  /* toolbar */
  .tpl__toolbar { display: flex; align-items: center; gap: 12px; padding: 14px 19px; border-bottom: 1px solid var(--divider); flex-wrap: wrap; row-gap: 10px; }
  .tpl__search { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0 11px; flex: 1 1 160px; min-width: 140px; max-width: 250px; }
  .tpl__searchic { color: var(--muted); flex: none; }
  .tpl__search input { border: none; background: none; padding: 9px 0; font-size: 13px; color: var(--text2); outline: none; width: 100%; }
  .tpl__spacer { flex: 1 1 0; }

  .tpl__coldrop { position: relative; }
  .tpl__colbtn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 11px; border-radius: 9px; font-size: 13px; font-weight: 500; background: var(--surface); border: 1px solid var(--border2); color: var(--text2); transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out); }
  .tpl__colbtn:hover { background: var(--surface2); }
  .tpl__colbtn.is-on { background: var(--accent-tint); border-color: color-mix(in srgb, var(--accent) 40%, transparent); color: var(--accent); }
  .tpl__colcount { min-width: 16px; height: 16px; border-radius: 8px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; padding: 0 3px; }
  .tpl__colcaret { opacity: .55; transition: transform var(--duration-fast) var(--ease-out); }
  .tpl__colcaret.is-open { transform: rotate(180deg); }
  .tpl__colscrim { position: fixed; inset: 0; z-index: 39; border: 0; background: none; }
  .tpl__colpop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 190px; max-height: 260px; overflow-y: auto; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); padding: 6px; animation: pop .14s ease; }
  .tpl__colopt { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 9px; border-radius: 8px; font-size: 13px; color: var(--text2); }
  .tpl__colopt:hover { background: var(--surface2); }
  .tpl__colclear { display: block; width: 100%; text-align: left; padding: 8px 9px; margin-top: 2px; border-top: 1px solid var(--divider); font-size: 12.5px; color: var(--muted); }

  .tpl__seg { flex: none; }
  .tpl__seg .aseg__opt { display: inline-flex; align-items: center; gap: 6px; }

  /* checkbox */
  .tpl__box { border-radius: 5px; border: 1.5px solid var(--border2); background: var(--surface); display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: all .12s; flex: none; }
  .tpl__box.is-on { background: var(--accent); border-color: var(--accent); }
  .tpl__box--sm { width: 17px; height: 17px; }

  /* bulk bar */
  .tpl__bulk { display: flex; align-items: center; gap: 10px; padding: 10px 19px; background: var(--accent-tint); border-bottom: 1px solid var(--divider); animation: fade .18s ease; flex-wrap: wrap; }
  .tpl__bulkcount { font-size: 13px; font-weight: 600; color: var(--accent); }
  .tpl__bulkdiv { width: 1px; height: 16px; background: var(--border2); }
  .tpl__bulkbtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border2); }
  .tpl__bulkbtn:hover { background: var(--surface2); }
  .tpl__bulkbtn--danger { color: var(--danger); border-color: #f3c9c9; }
  .tpl__bulkclear { margin-left: auto; font-size: 12.5px; color: var(--muted); }

  /* shared bits */
  .tpl__catpill { font-size: 10.5px; font-weight: 600; color: var(--text4); background: var(--surface2); border: 1px solid var(--border); padding: 1px 8px; border-radius: 20px; white-space: nowrap; }
  .tpl__star { display: inline-flex; align-items: center; justify-content: center; padding: 2px; border-radius: 6px; transition: transform var(--duration-fast) var(--ease-out); }
  .tpl__star:hover { transform: scale(1.12); }

  /* faux email */
  .tpl__mail { width: 100%; max-width: 170px; background: #fff; border-radius: 8px 8px 0 0; box-shadow: 0 4px 14px rgba(30,27,22,.1); overflow: hidden; align-self: flex-end; }
  .tpl__mail--lg { max-width: 260px; border-radius: 10px; box-shadow: 0 8px 26px rgba(30,27,22,.14); }
  .tpl__mail-band { height: 60px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0 14px; text-align: center; }
  .tpl__mail--lg .tpl__mail-band { height: auto; padding: 30px 20px; }
  .tpl__mail-kicker { font-size: 6px; font-weight: 700; letter-spacing: 1px; opacity: .8; }
  .tpl__mail--lg .tpl__mail-kicker { font-size: 8px; letter-spacing: 1.4px; opacity: .82; }
  .tpl__mail-title { font-size: 11px; font-weight: 800; letter-spacing: .4px; margin-top: 3px; line-height: 1.1; }
  .tpl__mail--lg .tpl__mail-title { font-size: 18px; letter-spacing: .5px; margin-top: 6px; }
  .tpl__mail-body { padding: 11px 13px 13px; display: flex; flex-direction: column; gap: 5px; align-items: flex-start; }
  .tpl__mail--lg .tpl__mail-body { padding: 18px 20px 20px; gap: 8px; }
  .tpl__mail-bar { height: 4px; border-radius: 3px; }
  .tpl__mail--lg .tpl__mail-bar { height: 6px; }
  .tpl__mail-cta { margin-top: 4px; font-size: 6.5px; font-weight: 700; color: #fff; padding: 4px 9px; border-radius: 5px; }
  .tpl__mail--lg .tpl__mail-cta { font-size: 9px; padding: 7px 14px; border-radius: 7px; margin-top: 6px; }

  /* gallery */
  .tpl__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; padding: 18px 19px; }
  .tpl__gcard { border-radius: 16px; overflow: hidden; cursor: pointer; display: flex; flex-direction: column; }
  .tpl__preview { position: relative; height: 172px; background: var(--surface2); padding: 16px 18px 0; display: flex; justify-content: center; }
  .tpl__gcheck { position: absolute; top: 12px; left: 12px; z-index: 2; }
  .tpl__gcheck .tpl__box { box-shadow: 0 1px 2px rgba(30,27,22,.12); }
  .tpl__gbadge { position: absolute; top: 12px; right: 12px; z-index: 2; display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-weight: 700; padding: 4px 8px; border-radius: 20px; }
  .tpl__ov { position: absolute; inset: 0; background: rgba(28,25,23,.5); opacity: 0; display: flex; align-items: center; justify-content: center; gap: 9px; transition: opacity .16s; }
  .tpl__gcard:hover .tpl__ov, .tpl__gcard:focus-visible .tpl__ov { opacity: 1; }
  .tpl__ov-use { background: var(--surface); color: var(--text2); padding: 7px 13px; border-radius: 9px; font-size: 12px; font-weight: 600; }
  .tpl__ov-prev { background: rgba(255,255,255,.16); color: #fff; border: 1px solid rgba(255,255,255,.35); padding: 7px 11px; border-radius: 9px; font-size: 12px; font-weight: 600; }
  .tpl__gmeta { padding: 13px 15px; border-top: 1px solid var(--divider); display: flex; justify-content: space-between; gap: 8px; }
  .tpl__gmeta-main { min-width: 0; }
  .tpl__gname { font-weight: 600; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tpl__gsub { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
  .tpl__updated { font-size: 11.5px; color: var(--muted); }
  .tpl__metrics { display: flex; gap: 12px; margin-top: 8px; }
  .tpl__metric { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; color: var(--text3); }
  .tpl__dot { width: 6px; height: 6px; border-radius: 50%; flex: none; }
  .tpl__star { flex: none; }

  /* compact */
  .tpl__compact { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; padding: 18px 19px; }
  .tpl__ccard { border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer; background: var(--surface); position: relative; transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out); }
  .tpl__ccard:hover { box-shadow: var(--shadow-md); }
  .tpl__cband { position: relative; height: 92px; display: flex; align-items: center; justify-content: center; padding: 0 12px; text-align: center; font-weight: 700; font-size: 10px; letter-spacing: .3px; }
  .tpl__ccheck { position: absolute; top: 8px; left: 8px; }
  .tpl__ccheck .tpl__box { box-shadow: 0 1px 2px rgba(30,27,22,.14); }
  .tpl__cfoot { padding: 9px 11px; }
  .tpl__crow { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
  .tpl__cname { font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tpl__cmetrics { font-size: 10.5px; color: var(--muted); margin-top: 3px; }

  /* list */
  .tpl__lgrid { display: grid; grid-template-columns: 36px 2fr 1fr .9fr .7fr .7fr 60px 36px; column-gap: 16px; align-items: center; }
  .tpl__lhead { padding: 12px 19px; border-bottom: 1px solid var(--surface2); }
  .tpl__lhead > div { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .3px; text-transform: uppercase; }
  .tpl__lhead button { display: inline-flex; align-items: center; gap: 4px; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; }
  .tpl__lhead button:hover { color: var(--text); }
  .tpl__lright { text-align: right; justify-self: end; }
  .tpl__lcenter { display: flex; align-items: center; justify-content: center; }
  .tpl__lrow { padding: 12px 19px; border-bottom: 1px solid var(--divider); font-size: 13px; cursor: pointer; transition: background .12s var(--ease-out); }
  .tpl__lrow:hover { background: var(--surface2); }
  .tpl__lrow.is-selected { background: var(--accent-tint); }
  .tpl__lcheck { display: flex; align-items: center; }
  .tpl__lname-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .tpl__lchip { width: 54px; height: 37px; flex: none; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); display: flex; align-items: center; justify-content: center; text-align: center; font-weight: 700; font-size: 7px; letter-spacing: .2px; padding: 0 4px; overflow: hidden; }
  .tpl__lname { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tpl__lmuted { color: var(--muted); font-size: 12px; }
  .tpl__lmuted3 { color: var(--text3); font-size: 12.5px; }

  /* footer / pager */
  .tpl__foot { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 19px; border-top: 1px solid var(--divider); font-size: 12px; color: var(--muted); flex-wrap: wrap; }
  .tpl__pager { display: flex; align-items: center; gap: 6px; }
  .tpl__pgnav { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border2); background: var(--surface); color: var(--text3); display: inline-flex; align-items: center; justify-content: center; }
  .tpl__pgnav:hover:not(:disabled) { background: var(--surface2); }
  .tpl__pgnav:disabled { opacity: .4; pointer-events: none; }
  .tpl__pgleft { transform: rotate(180deg); }
  .tpl__pgbtn { min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--border2); background: var(--surface); color: var(--text3); font-size: 12.5px; font-weight: 600; }
  .tpl__pgbtn:hover { background: var(--surface2); }
  .tpl__pgbtn.is-active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }

  /* toast */
  .tpl__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: var(--bg); padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
  .tpl__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }

  @media (max-width: 900px) {
    .tpl__lgrid { grid-template-columns: 32px 2fr 1fr .8fr 44px 32px; }
    .tpl__lgrid > :nth-child(5), .tpl__lgrid > :nth-child(6) { display: none; }
  }
  @media (max-width: 640px) {
    .tpl__seg-lbl { display: none; }
    .tpl__lgrid { grid-template-columns: 30px 1.7fr .9fr 44px 30px; }
    .tpl__lgrid > :nth-child(4) { display: none; }
    .tpl__lchip { display: none; }
  }
`;
