import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import ListCustomFields from './ListCustomFields';
import ListEditorModal, { type ListEditorValues } from './ListEditorModal';
import { ago } from './shared/time';
import {
  AVATAR_GRADS,
  fmtPct,
  PAGE_SIZE,
  rows as mockRows,
  trendPath,
  weeklyGain,
} from './AppLists.logic';
import type { ListRow, SortKey, View } from './AppLists.types';
import { api, ApiError } from '@/lib/app/api';
import { toListRow, type ApiList } from '@/lib/app/list-map';
import { RATE_BUCKETS, parseRatePercent, rateBucket } from '@/lib/app/templates-data';
import { matchesSearchQuery } from '@/lib/app/search-match';
import { tagStyle } from '@/lib/app/tag-style';
import TagFilter from './shared/TagFilter';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import { visiblePageNumbers } from './shared/pagination';
import styles from './AppLists.module.css';

export default function AppLists({ initial }: { initial?: ListRow[] } = {}) {
  // Live workspace lists from SSR when provided; otherwise the fixture preview.
  const live = initial !== undefined;
  const [listRows, setListRows] = useState<ListRow[]>(initial !== undefined ? initial : mockRows);
  const [query, setQuery] = useState('');
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [openFilter, setOpenFilter] = useState<'opens' | 'clicks' | null>(null);
  const [view, setView] = useState<View>('table');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'updatedAt', dir: -1 });
  const [page, setPage] = useState(1);

  // Every tag present across the workspace's lists, with list counts.
  const allTags = useMemo(() => {
    const freq = new Map<string, number>();
    for (const l of listRows) {
      for (const t of l.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [listRows]);
  const toggleTag = (t: string) =>
    setTagSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });

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
  const [openId, setOpenId] = useState<string | null>(null);

  // Deep link from sidebar pins: /dashboard/lists?open=<id> opens the drawer.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('open');
    if (id) setOpenId(id);
  }, []);
  const [closing, setClosing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editor, setEditor] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; id: string; name: string; color: string; notes: string }
    | null
  >(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const saveList = async (values: ListEditorValues) => {
    const ed = editor;
    if (!ed) return;
    if (!live) {
      setEditor(null);
      showToast(
        ed.mode === 'create' ? `List “${values.name}” created` : `List “${values.name}” updated`,
      );
      return;
    }
    try {
      if (ed.mode === 'create') {
        const created = await api.post<ApiList>('lists', {
          name: values.name,
          notes: values.notes || null,
          color: values.color,
        });
        setListRows((prev) => [toListRow(created), ...prev]);
        showToast(`List “${values.name}” created`);
      } else {
        const updated = await api.patch<ApiList>(`lists/${ed.id}`, {
          name: values.name,
          notes: values.notes || null,
          color: values.color,
        });
        setListRows((prev) =>
          prev.map((l) =>
            l.id === ed.id
              ? {
                  ...l,
                  name: updated.name,
                  color: updated.color || l.color,
                  notes: updated.notes ?? values.notes,
                }
              : l,
          ),
        );
        showToast(`List “${values.name}” updated`);
      }
      setEditor(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Could not save list');
    }
  };

  // Set while a delete waits on confirmation.
  const [confirmList, setConfirmList] = useState<{ id: string; name: string } | null>(null);

  /* Persist a tags/notes change from the drawer. Optimistic: the row updates
     immediately so a reopen reflects it, then the PATCH syncs the service. */
  const patchList = async (id: string, patch: { tags?: string[]; notes?: string }) => {
    setListRows((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    if (!live) return;
    try {
      await api.patch(`lists/${id}`, patch);
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
    setListRows((prev) => prev.filter((l) => l.id !== id));
    closeDrawer();
    showToast(`List “${name}” deleted`);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = listRows.filter((l) => {
      if (tagSel.size > 0 && !l.tags.some((t) => tagSel.has(t))) return false;
      if (opensSel.size && !opensSel.has(rateBucket(parseRatePercent(l.openRate)))) return false;
      if (clicksSel.size && !clicksSel.has(rateBucket(parseRatePercent(l.clickRate)))) return false;
      if (!q) return true;
      return (
        matchesSearchQuery(l.name, q) ||
        l.tags.some((t) => matchesSearchQuery(t, q)) ||
        matchesSearchQuery(l.recentCampaign, q)
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
  }, [query, tagSel, opensSel, clicksSel, sort, listRows]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(safePage, pageCount);
  const startIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Snap back to the first page whenever the filtered set changes underneath.
  useEffect(() => {
    setPage(1);
  }, [query, tagSel, opensSel, clicksSel, sort]);

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
        <button type="button" className="pbtn" onClick={() => setEditor({ mode: 'create' })}>
          <Icon name="plus" size={15} stroke={2.2} />
          New list
        </button>
      </div>

      <div className={`atable ${styles.tablecard}`}>
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
                  Growth <span className="tnum">{sortArrow('growthPct')}</span>
                </button>
              </div>
              <div>Recent campaign</div>
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

            {filtered.length === 0 ? (
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
                    <div className={styles.muted3}>{l.recentCampaign}</div>
                    <div className={styles.dateCell}>{ago(l.updatedAt)}</div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* CARDS VIEW */}
        {view === 'cards' &&
          (filtered.length === 0 ? (
            <div className="atable__empty">No lists match your search.</div>
          ) : (
            <div className={styles.cards}>
              {pageRows.map((l) => {
                const up = l.growthPct >= 0;
                return (
                  <div
                    key={l.id}
                    className={`acrd acrd--hover ${styles.card}`}
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
                      <span className={styles.dot} style={{ background: l.color }} />
                      <span className={styles.cardName}>{l.name}</span>
                      <span
                        className={`${styles.cardPct} tnum`}
                        style={{ color: up ? 'var(--success-text)' : 'var(--danger-text)' }}
                      >
                        {fmtPct(l.growthPct)}
                      </span>
                    </div>
                    <div className={styles.cardStat}>
                      <span className={`${styles.cardNum} tnum`}>
                        {l.subscribers.toLocaleString('en-US')}
                      </span>
                      <span className={styles.cardStatSub}>
                        {/* Label truncates under pressure; the delta never does. */}
                        <span className={styles.cardStatLabel}>subscribers</span>
                        <span className={styles.cardStatDelta}>
                          ·{' '}
                          <span
                            className="tnum"
                            style={{ color: up ? 'var(--success-text)' : 'var(--danger-text)' }}
                          >
                            {up ? '↑' : '↓'} {Math.abs(weeklyGain(l.trend)).toLocaleString('en-US')}
                          </span>{' '}
                          this week
                        </span>
                      </span>
                    </div>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardRecent}>Recent: {l.recentCampaign}</span>
                      <span className={styles.cardUpdated}>Updated {ago(l.updatedAt)}</span>
                    </div>
                    <div className={styles.cardFoot}>
                      <div className={styles.avatars} aria-hidden="true">
                        {AVATAR_GRADS.map((g, i) => (
                          <span key={i} className={styles.avatar} style={{ background: g }} />
                        ))}
                      </div>
                      <span className={`${styles.more} tnum`}>{l.more} more</span>
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
          <span className={filtered.length === 0 ? undefined : 'tnum'}>
            {filtered.length === 0
              ? 'No lists match your search'
              : `${startIdx}–${endIdx} of ${filtered.length} list${filtered.length === 1 ? '' : 's'}`}
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
          live={live}
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
          onEdit={() => {
            setEditor({
              mode: 'edit',
              id: open.id,
              name: open.name,
              color: open.color,
              notes: open.notes,
            });
            closeDrawer();
          }}
        />
      )}

      {editor && (
        <ListEditorModal
          mode={editor.mode}
          initialName={editor.mode === 'edit' ? editor.name : ''}
          initialNotes={editor.mode === 'edit' ? editor.notes : ''}
          initialColor={editor.mode === 'edit' ? editor.color : undefined}
          onClose={() => setEditor(null)}
          onSave={saveList}
        />
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

function ListDrawer({
  list,
  live,
  closing,
  onClose,
  onToast,
  onPatch,
  onFilterTag,
  onDelete,
  onEdit,
}: {
  list: ListRow;
  live: boolean;
  closing: boolean;
  onClose: () => void;
  onToast: (m: string) => void;
  onPatch: (id: string, patch: { tags?: string[]; notes?: string }) => void;
  onFilterTag: (tag: string) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  // Notes persist on Save; tags persist immediately as they're added/removed.
  const [note, setNote] = useState(list.notes);
  const [savedNote, setSavedNote] = useState(list.notes);
  const dirty = note !== savedNote;

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

  const saveNote = () => {
    setSavedNote(note);
    onPatch(list.id, { notes: note });
    onToast('Note saved');
  };

  const up = list.growthPct >= 0;
  const gain = weeklyGain(list.trend);
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
            <span className={styles.dDot} style={{ background: list.color }} />
            <div className={styles.dIdtext}>
              <div className={styles.dName}>{list.name}</div>
              <div className={styles.dUpdated}>Updated {ago(list.updatedAt)}</div>
            </div>
          </div>

          {/* stat cards */}
          <div className={styles.dStats}>
            <div className={styles.dStat}>
              <div className={styles.dStatLbl}>Subscribers</div>
              <div className={`tnum ${styles.dStatVal}`}>
                {list.subscribers.toLocaleString('en-US')}
              </div>
            </div>
            <div className={styles.dStat}>
              <div className={styles.dStatLbl}>Growth</div>
              <div
                className={`tnum ${styles.dStatVal}`}
                style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
              >
                {fmtPct(list.growthPct)}
              </div>
            </div>
          </div>

          {/* subscriber trend */}
          <div className={styles.dTrend}>
            <div className={styles.dTrendHead}>
              <span className="adrawer__eyebrow">Subscriber trend</span>
              <span
                className={`tnum ${styles.dTrendGain}`}
                style={{ color: up ? 'var(--success)' : 'var(--danger)' }}
              >
                {up ? '↑' : '↓'} {Math.abs(gain).toLocaleString('en-US')} this week
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

          {/* custom fields — workspace-wide subscriber attribute schema */}
          <ListCustomFields live={live} onToast={onToast} />

          {/* notes */}
          <div className={styles.dNoteshead}>
            <span className="adrawer__eyebrow">Notes</span>
            <button
              type="button"
              className={`${styles.dSavenote}${dirty ? ` ${styles.isDirty}` : ''}`}
              disabled={!dirty}
              onClick={saveNote}
            >
              Save note
            </button>
          </div>
          <textarea
            className={styles.dNotes}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note about this list…"
            aria-label="List notes"
          />
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
          <button type="button" className="pbtn" style={{ flex: 1 }} onClick={onEdit}>
            Edit list
          </button>
        </div>
      </div>
    </div>
  );
}
