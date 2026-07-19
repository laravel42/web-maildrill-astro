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
import EmailBuilder from './EmailBuilder';
import { CHANNEL } from './shared/channels';
import { useToast } from './shared/useToast';
import { CHANNEL_TABS, VIEWS, ASC_FIRST, PAGE_SIZE } from './AppTemplates.logic';
import type { ViewKey, SortKey } from './AppTemplates.types';
import { api, ApiError } from '@/lib/app/api';
import { toGalleryTemplate, type ApiTemplate } from '@/lib/app/template-map';
import styles from './AppTemplates.module.css';

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
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updated', dir: -1 });
  const [favIds, setFavIds] = useState<Set<string>>(
    () => new Set((initial ?? galleryTemplates).filter((t) => t.favorite).map((t) => t.id)),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { toast, show } = useToast();
  const [builder, setBuilder] = useState<{ channel: ChannelType; name: string | null } | null>(
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

  const bulk = (verb: string) => {
    const n = selected.size;
    show(`${verb} ${n} template${n === 1 ? '' : 's'}`);
    setSelected(new Set());
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

  const openTpl = openId ? (templates.find((t) => t.id === openId) ?? null) : null;

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
        <button
          type="button"
          className="pbtn"
          onClick={() => setBuilder({ channel: 'email', name: null })}
        >
          <Icon name="plus" size={15} stroke={2.2} />
          New template
        </button>
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
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Duplicated')}>
              <Icon name="copy" size={13} /> Duplicate
            </button>
            <button type="button" className={styles.bulkbtn} onClick={() => bulk('Favorited')}>
              <Icon name="star" size={13} /> Favorite
            </button>
            <button
              type="button"
              className={`${styles.bulkbtn} ${styles.bulkbtnDanger}`}
              onClick={() => void removeSelected()}
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
                          show(`Using “${t.name}”`);
                        }}
                      >
                        Use
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
              <div />
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
                  <div className={styles.lcenter} onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="kbtn"
                      aria-label={`Actions for ${t.name}`}
                      onClick={() => show('Row menu')}
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
          fav={isFav(openTpl.id)}
          onFav={() => toggleFav(openTpl.id, openTpl.name)}
          onClose={() => setOpenId(null)}
          onToast={show}
          onUse={() => {
            const tpl = openTpl;
            setOpenId(null);
            setBuilder({ channel: tpl.channel, name: tpl.name });
          }}
        />
      )}

      {builder && (
        <EmailBuilder
          channel={builder.channel}
          name={builder.name}
          kind="template"
          onClose={() => setBuilder(null)}
          onSave={async ({ channel, name, message }) => {
            if (!live) {
              setBuilder(null);
              show(name && name !== 'Untitled' ? `“${name}” saved` : 'Template saved');
              return;
            }
            try {
              const created = await api.post<ApiTemplate>('templates', {
                name: name && name !== 'Untitled' ? name : 'Untitled template',
                channel,
                text: message || null,
              });
              setTemplates((prev) => [toGalleryTemplate(created), ...prev]);
              show(`“${created.name}” saved`);
              setBuilder(null);
            } catch (e) {
              show(e instanceof ApiError ? e.message : 'Could not save template');
            }
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
          <div className={styles.dPreview}>
            <FauxEmail t={t} variant="drawer" />
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
            onClick={() => onToast(`Cloned “${t.name}”`)}
          >
            <Icon name="copy" size={14} /> Clone
          </button>
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onUse}>
            Use template
          </button>
        </div>
      </div>
    </div>
  );
}
