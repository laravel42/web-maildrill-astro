import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import type { ChannelType, SubscriberStatus } from '@/types/app';
import {
  richSubscribers as mockSubscribers,
  SEG_FIELD_LIST,
  SEG_OPS,
  STATUS_VALUES,
  opNeedsValue,
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
import { toRichSubscriber, type ApiSubscriber } from '@/lib/app/subscriber-map';
import { matchesSearchQuery } from '@/lib/app/search-match';
import { RATE_BUCKETS, parseRatePercent, rateBucket } from '@/lib/app/templates-data';
import SubscriberEditorModal from './SubscriberEditorModal';
import { buildCsv, downloadCsv, exportFilename, subscribersCsv } from '@/lib/app/subscriber-export';
import type { CustomField } from '@/lib/app/custom-fields';
import TagFilter from './shared/TagFilter';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import { CHANNEL, CHANNEL_ORDER } from './shared/channels';
import { ago, agoNow } from './shared/time';
import { useToast } from './shared/useToast';
import { useEscapeClose } from './shared/useEscapeClose';
import {
  STATUS_LABEL,
  STATUS_TABS,
  PAGE_SIZE,
  visiblePageNumbers,
  tagStyle,
  reachOf,
  initials,
} from './AppSubscribers.logic';
import type { SortKey, ViewMode } from './AppSubscribers.types';
import { routes } from '@/config/routes';
import styles from './AppSubscribers.module.css';

export default function AppSubscribers({
  initial,
  initialSegments,
  allLists = [],
  allTagRows = [],
}: {
  initial?: RichSubscriber[];
  /** Saved segments from the service — the workspace's, not this browser's. */
  initialSegments?: SavedSegment[];
  /** Real lists, used for segment rules and list membership; color tints chips. */
  allLists?: { id: string; name: string; color?: string | null }[];
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
  const [view, setView] = useState<ViewMode>('table');
  const [tab, setTab] = useState<'all' | SubscriberStatus>('all');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<Set<ChannelType>>(new Set());
  const [channelOpen, setChannelOpen] = useState(false);
  const [listFilter, setListFilter] = useState<Set<string>>(new Set());
  const [listOpen, setListOpen] = useState(false);
  const [opensSel, setOpensSel] = useState<Set<string>>(new Set());
  const [clicksSel, setClicksSel] = useState<Set<string>>(new Set());
  const [rateFilterOpen, setRateFilterOpen] = useState<'opens' | 'clicks' | null>(null);
  const [segSel, setSegSel] = useState<Set<string>>(new Set());
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
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
  const [segMembers, setSegMembers] = useState<Record<string, Set<string>>>({});
  const [segModal, setSegModal] = useState<{ open: boolean; edit: SavedSegment | null }>({
    open: false,
    edit: null,
  });
  const [subEditor, setSubEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; sub: RichSubscriber } | null
  >(null);
  const [exporting, setExporting] = useState(false);

  /* Full CSV export. The table only holds the first page, so live workspaces
     re-fetch every subscriber (200 a page); demo mode exports what's on
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
      const all: ApiSubscriber[] = [];
      for (let offset = 0; offset < 10_000; offset += 200) {
        const page = await api.get<{ data: ApiSubscriber[] }>(
          `subscribers?limit=200&offset=${offset}`,
        );
        all.push(...page.data);
        if (page.data.length < 200) break;
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
    setSubEditor({ mode: 'create' });
    url.searchParams.delete('new');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, []);

  // Custom-field keys feed the import wizard's column-mapping targets.
  const [customFieldKeys, setCustomFieldKeys] = useState<string[]>([]);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    void api
      .get<{ data: Array<{ key: string }> }>('custom-fields')
      .then((res) => {
        if (alive) setCustomFieldKeys(res.data.map((f) => f.key));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [live]);

  const effTags = (s: RichSubscriber): string[] => tagStore[s.id] ?? s.tags;

  // Tags actually present on subscribers, with counts for the filter dropdown.
  const tagUniverse = useMemo(() => {
    const freq = new Map<string, number>();
    for (const s of richSubscribers) {
      for (const t of effTags(s)) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [richSubscribers, tagStore]);

  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  /* Segment sizes come from the service, which evaluates against every
     subscriber. Counting in the browser would only ever see the loaded page. */
  const refreshCounts = async (segs: SavedSegment[]) => {
    if (!live || segs.length === 0) return;
    const results = await Promise.allSettled(
      segs.map((seg) =>
        api
          .post<{ count: number }>('segments/preview', {
            matchType: seg.matchType,
            rules: toApiRules(seg.rows),
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
  }, [segments, live]);

  /* Membership for a selected segment is resolved by the service too, so
     filtering isn't limited to the rows this page happens to hold. */
  useEffect(() => {
    if (!live) return;
    const missing = [...segSel].filter((id) => !segMembers[id]);
    if (missing.length === 0) return;
    let cancelled = false;
    void Promise.allSettled(
      missing.map((id) =>
        api
          .get<{ data: { id: string }[] }>(`segments/${id}/subscribers?limit=1000`)
          .then((r) => [id, new Set(r.data.map((x) => x.id))] as const),
      ),
    ).then((results) => {
      if (cancelled) return;
      setSegMembers((prev) => {
        const next = { ...prev };
        for (const r of results) if (r.status === 'fulfilled') next[r.value[0]] = r.value[1];
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [segSel, live, segMembers]);

  const segCount = (seg: SavedSegment): number => segCounts[seg.id] ?? 0;

  /* Pipeline: segment → status → search+channel → tag filter → sort. */
  const segFiltered = useMemo(() => {
    if (segSel.size === 0) return richSubscribers;
    // Union of the service-resolved memberships for the selected segments.
    const ids = new Set<string>();
    for (const segId of segSel) for (const id of segMembers[segId] ?? []) ids.add(id);
    return richSubscribers.filter((s) => ids.has(s.id));
  }, [segSel, segMembers, richSubscribers]);

  const tabCounts = useMemo(() => {
    const c: Record<string, number> = { all: segFiltered.length };
    (['active', 'unsubscribed', 'bounced'] as SubscriberStatus[]).forEach((st) => {
      c[st] = segFiltered.filter((s) => s.status === st).length;
    });
    return c;
  }, [segFiltered]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = segFiltered.filter((s) => {
      if (tab !== 'all' && s.status !== tab) return false;
      if (q) {
        const hit =
          matchesSearchQuery(s.name, q) ||
          s.email.toLowerCase().includes(q) ||
          effTags(s).some((t) => matchesSearchQuery(t, q));
        if (!hit) return false;
      }
      if (channelFilter.size > 0) {
        const r = reachOf(s);
        if (![...channelFilter].some((ch) => r[ch])) return false;
      }
      if (listFilter.size > 0 && !s.listIds.some((id) => listFilter.has(id))) return false;
      if (tagSel.size > 0 && !effTags(s).some((t) => tagSel.has(t))) return false;
      if (opensSel.size && !opensSel.has(rateBucket(parseRatePercent(s.opens)))) return false;
      if (clicksSel.size && !clicksSel.has(rateBucket(parseRatePercent(s.clicks)))) return false;
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
        av = a.status;
        bv = b.status;
      } else if (key === 'subscribed') {
        av = new Date(a.createdAt).getTime();
        bv = new Date(b.createdAt).getTime();
      } else {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [
    segFiltered,
    tab,
    query,
    channelFilter,
    listFilter,
    tagSel,
    opensSel,
    clicksSel,
    sort,
    tagStore,
  ]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pagerPages = visiblePageNumbers(safePage, pageCount);

  const resetPageAndSel = () => {
    setPage(1);
    setSelected(new Set());
  };

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
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

  const toggleChannel = (ch: ChannelType) => {
    setChannelFilter((prev) => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
    resetPageAndSel();
  };

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
    setTab('all');
    setTagSel(new Set());
    setChannelFilter(new Set());
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

  /* Reconcile list membership against the service. The editor now offers a
     multi-select, so this adds every newly chosen list and removes the ones the
     subscriber was dropped from — all in one save. */
  const applyListMembership = async (
    subscriberId: string,
    currentListIds: string[],
    nextListIds: string[],
  ) => {
    const next = new Set(nextListIds);
    const current = new Set(currentListIds);
    const toRemove = currentListIds.filter((id) => !next.has(id));
    const toAdd = nextListIds.filter((id) => !current.has(id));
    await Promise.allSettled([
      ...toRemove.map((id) => api.del(`lists/${id}/members/${subscriberId}`)),
      ...toAdd.map((id) => api.post(`lists/${id}/members`, { subscriberId })),
    ]);
  };

  /* Segments are workspace resources: they persist to the service so teammates
     see them, rather than living in this browser's localStorage. */
  const saveSegment = async (seg: SavedSegment) => {
    const body = {
      name: seg.name,
      matchType: seg.matchType,
      rules: toApiRules(seg.rows),
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
      // Drop any cached membership so the filter re-resolves against new rules.
      setSegMembers((prev) => {
        const next = { ...prev };
        delete next[mapped.id];
        return next;
      });
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

  const startIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length);

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
            onClick={() => setSegModal({ open: true, edit: null })}
          >
            <Icon name="filter" size={15} />
            Create segment
          </button>
          <button
            type="button"
            className="sbtn"
            disabled={exporting}
            onClick={() => void exportSubscribers()}
          >
            <Icon name="download" size={15} />
            {exporting ? 'Exporting…' : 'Export'}
          </button>
          <button type="button" className="pbtn" onClick={() => setSubEditor({ mode: 'create' })}>
            <Icon name="plus" size={15} stroke={2.2} />
            Add subscriber
          </button>
        </div>
      </div>

      {/* saved segments chip row */}
      <div className={styles.segrow} role="group" aria-label="Saved segments">
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
          <span className={`${styles.segn} tnum`}>{richSubscribers.length}</span>
        </button>
        {segments.map((seg) => {
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
                <span className={`${styles.segn} tnum`}>{segCount(seg)}</span>
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
        {/* status tabs */}
        <div className={`${styles.tabs} atabs`} role="tablist" aria-label="Subscriber status">
          {STATUS_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`atab${tab === t ? ' is-active' : ''}`}
              onClick={() => {
                setTab(t);
                resetPageAndSel();
              }}
            >
              {t === 'all' ? 'All' : STATUS_LABEL[t]}
              <span className="atab__count tnum">{tabCounts[t] ?? 0}</span>
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
                className={`${styles.filter}${channelFilter.size ? ' is-on' : ''}`}
                aria-expanded={channelOpen}
                aria-haspopup="true"
                onClick={() => setChannelOpen((v) => !v)}
              >
                <Icon name="filter" size={14} />
                Channel
                {channelFilter.size > 0 && (
                  <span className={`${styles.filtercount} tnum`}>{channelFilter.size}</span>
                )}
                <Icon name="chevron-down" size={12} className={styles.filtercaret} />
              </button>
              {channelOpen && (
                <>
                  <button
                    type="button"
                    className={styles.scrim}
                    aria-label="Close"
                    onClick={() => setChannelOpen(false)}
                  />
                  <div className={styles.pop} style={{ animation: 'pop .14s ease' }} role="menu">
                    <div className={styles.poptitle}>Subscribed to</div>
                    {CHANNEL_ORDER.map((ch) => {
                      const m = CHANNEL[ch];
                      const on = channelFilter.has(ch);
                      return (
                        <button
                          key={ch}
                          type="button"
                          role="menuitemcheckbox"
                          aria-checked={on}
                          className={styles.popopt}
                          onClick={() => toggleChannel(ch)}
                        >
                          <span className={`${styles.box}${on ? ' is-on' : ''}`}>
                            {on && <Icon name="check" size={15} stroke={3.5} />}
                          </span>
                          <span className="apill" style={{ background: m.tint, color: m.color }}>
                            <Icon name={m.icon} size={12} />
                            {m.label}
                          </span>
                        </button>
                      );
                    })}
                    {channelFilter.size > 0 && (
                      <button
                        type="button"
                        className={styles.popclear}
                        onClick={() => {
                          setChannelFilter(new Set());
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
                disabled={allLists.length === 0}
                onClick={() => setListOpen((v) => !v)}
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
                    {allLists.map((l) => {
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
                          {l.name}
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

            <ColFilter
              label="Opens"
              icon="eye"
              options={RATE_BUCKETS}
              selected={opensSel}
              onToggle={toggleSet(setOpensSel)}
              onClear={() => {
                setOpensSel(new Set());
                resetPageAndSel();
              }}
              open={rateFilterOpen === 'opens'}
              onOpenToggle={() => setRateFilterOpen((o) => (o === 'opens' ? null : 'opens'))}
            />
            <ColFilter
              label="Clicks"
              icon="target"
              options={RATE_BUCKETS}
              selected={clicksSel}
              onToggle={toggleSet(setClicksSel)}
              onClear={() => {
                setClicksSel(new Set());
                resetPageAndSel();
              }}
              open={rateFilterOpen === 'clicks'}
              onOpenToggle={() => setRateFilterOpen((o) => (o === 'clicks' ? null : 'clicks'))}
            />

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
              ...(tab !== 'all'
                ? [
                    {
                      key: `status:${tab}`,
                      label: `Status: ${STATUS_LABEL[tab]}`,
                      onRemove: () => {
                        setTab('all');
                        resetPageAndSel();
                      },
                      style:
                        tab === 'active'
                          ? { background: 'var(--success-bg)', color: 'var(--success-strong)' }
                          : tab === 'unsubscribed'
                            ? {
                                background: 'var(--warning-bg)',
                                color: 'var(--warning-strong)',
                              }
                            : tab === 'bounced'
                              ? { background: 'var(--danger-bg)', color: 'var(--danger)' }
                              : undefined,
                    },
                  ]
                : []),
              ...[...channelFilter].map((ch) => {
                const m = CHANNEL[ch];
                return {
                  key: `ch:${ch}`,
                  label: m.label,
                  onRemove: () => toggleChannel(ch),
                  style: { background: m.tint, color: m.color },
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
              ...[...opensSel].map((b) => ({
                key: `opens:${b}`,
                label: `Opens: ${b}`,
                onRemove: () => toggleRateBucket('opens', b),
              })),
              ...[...clicksSel].map((b) => ({
                key: `clicks:${b}`,
                label: `Clicks: ${b}`,
                onRemove: () => toggleRateBucket('clicks', b),
              })),
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
            <div className={`athead ${styles.grid}`}>
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
                >
                  Subscriber <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'opens' ? 'is-active' : undefined}
                  onClick={() => toggleSort('opens')}
                >
                  Avg. open <span className="tnum">{sortArrow('opens')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'clicks' ? 'is-active' : undefined}
                  onClick={() => toggleSort('clicks')}
                >
                  Avg. click <span className="tnum">{sortArrow('clicks')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'tags' ? 'is-active' : undefined}
                  onClick={() => toggleSort('tags')}
                >
                  Tags <span className="tnum">{sortArrow('tags')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'status' ? 'is-active' : undefined}
                  onClick={() => toggleSort('status')}
                >
                  Status <span className="tnum">{sortArrow('status')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'subscribed' ? 'is-active' : undefined}
                  onClick={() => toggleSort('subscribed')}
                >
                  Subscribed <span className="tnum">{sortArrow('subscribed')}</span>
                </button>
              </div>
              <div className={styles.colCenter}>
                <button
                  type="button"
                  className={sort.key === 'last' ? 'is-active' : undefined}
                  onClick={() => toggleSort('last')}
                >
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
                  <div className={`tnum ${styles.rate}`}>{s.opens}</div>
                  <div className={`tnum ${styles.rate}`}>{s.clicks}</div>
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
                    <span className={`astatus astatus--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                  </div>
                  <div className={styles.last}>{ago(s.createdAt)}</div>
                  <div className={styles.last}>{ago(s.updatedAt)}</div>
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
                <span className={`astatus astatus--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                <span className={`${styles.last} ${styles.clast}`}>{ago(s.updatedAt)}</span>
              </div>
            ))
          ))}

        {/* footer / pagination */}
        <div className={`atable__foot ${styles.foot}`}>
          <span className={filtered.length === 0 ? undefined : 'tnum'}>
            {filtered.length === 0
              ? 'No subscribers match your filters'
              : `${startIdx}–${endIdx} of ${filtered.length} subscribers`}
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
            setSubEditor({ mode: 'edit', sub });
          }}
          onDelete={() => setConfirmDelete([openSub.id])}
        />
      )}

      {subEditor && (
        <SubscriberEditorModal
          mode={subEditor.mode}
          initialEmail={subEditor.mode === 'edit' ? subEditor.sub.email : ''}
          initialPhone={subEditor.mode === 'edit' ? subEditor.sub.phone : ''}
          initialName={subEditor.mode === 'edit' ? subEditor.sub.name : ''}
          initialStatus={subEditor.mode === 'edit' ? subEditor.sub.status : 'active'}
          initialListIds={subEditor.mode === 'edit' ? subEditor.sub.listIds : []}
          initialTags={subEditor.mode === 'edit' ? effTags(subEditor.sub) : []}
          lists={allLists}
          customFieldKeys={customFieldKeys}
          onImport={async ({ rows, listIds, newFields }) => {
            if (!live) {
              showToast(`${rows.length.toLocaleString('en-US')} subscribers imported`);
              return { created: rows.length, updated: 0, failed: 0 };
            }
            // Columns mapped to a brand-new field need the definition to exist
            // before the values land, or they stay loose attribute keys. An
            // already-present key is a benign conflict, so failures are ignored.
            for (const key of newFields) {
              await api.post('custom-fields', { key, type: 'text' }).catch(() => undefined);
            }
            const res = await api.post<{
              created: number;
              updated: number;
              failed: number;
              errors: Array<{ index: number; email: string; error: string }>;
            }>('subscribers/import', { rows, ...(listIds.length ? { listIds } : {}) });
            if (newFields.length)
              setCustomFieldKeys((prev) => [...new Set([...prev, ...newFields])]);
            // Refresh the table so the new arrivals (and merges) show at once.
            const fresh = await api.get<{ data: ApiSubscriber[] }>('subscribers?limit=200');
            setRichSubscribers(fresh.data.map(toRichSubscriber));
            return { created: res.created, updated: res.updated, failed: res.failed };
          }}
          onClose={() => setSubEditor(null)}
          onSave={async (values) => {
            const editor = subEditor;
            if (!live) {
              if (editor.mode === 'edit') saveTags(editor.sub.id, values.tags);
              setSubEditor(null);
              showToast(
                editor.mode === 'create'
                  ? `${values.email} added`
                  : `${values.name || values.email} updated`,
              );
              return;
            }
            try {
              if (editor.mode === 'create') {
                const created = await api.post<ApiSubscriber>('subscribers', {
                  email: values.email,
                  phone: values.phone || undefined,
                  name: values.name || undefined,
                  status: values.status,
                  attributes: { tags: values.tags },
                });
                await applyListMembership(created.id, [], values.listIds);
                const withList = await api.get<ApiSubscriber>(`subscribers/${created.id}`);
                setRichSubscribers((prev) => [toRichSubscriber(withList), ...prev]);
                showToast(`${values.email} added`);
              } else {
                const updated = await api.patch<ApiSubscriber>(`subscribers/${editor.sub.id}`, {
                  name: values.name || null,
                  // Empty clears the number; a value updates it.
                  phone: values.phone || null,
                  status: values.status,
                  attributes: {
                    tags: values.tags,
                    ...(editor.sub.location !== '—' ? { location: editor.sub.location } : {}),
                  },
                });
                await applyListMembership(editor.sub.id, editor.sub.listIds, values.listIds);
                const fresh = await api.get<ApiSubscriber>(`subscribers/${editor.sub.id}`);
                setRichSubscribers((prev) =>
                  prev.map((s) => (s.id === editor.sub.id ? toRichSubscriber(fresh) : s)),
                );
                void updated;
                showToast(`${values.name || values.email} updated`);
              }
              setSubEditor(null);
            } catch (e) {
              showToast(e instanceof ApiError ? e.message : 'Could not save subscriber');
            }
          }}
        />
      )}

      {segModal.open && (
        <SegmentModal
          key={segModal.edit?.id ?? 'new'}
          edit={segModal.edit}
          onClose={() => setSegModal({ open: false, edit: null })}
          onSave={saveSegment}
          onDelete={(id) => setConfirmSegment({ id, name: segById.get(id)?.name ?? 'Segment' })}
          lists={allLists}
          tags={allTags}
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

  type ChanRow = { ch: ChannelType; on: boolean; meta: string; open: string; click: string };

  // "Last active" is the most recent real message timestamp; falls back to the
  // fixture value only in the marketing preview.
  const lastActive = act
    ? act.lastActiveAt
      ? agoNow(act.lastActiveAt)
      : 'Never'
    : live
      ? '—'
      : ago(sub.updatedAt);

  let channelRows: ChanRow[];

  if (act) {
    const byChannel = new Map(act.channels.map((c) => [c.channel, c]));
    channelRows = CHANNEL_ORDER.map((ch) => {
      const s = byChannel.get(ch);
      const sent = s?.sent ?? 0;
      const delivered = s?.delivered ?? 0;
      const read = s?.read ?? 0;
      const clicked = s?.clicked ?? 0;
      // Email and WhatsApp track engagement, so a real 0% is shown; SMS and
      // voice have no open/click signal at all, so they stay "—".
      const tracked = ch === 'email' || ch === 'whatsapp';
      const pctOf = (v: number) =>
        tracked && delivered > 0 ? `${Math.round((v / delivered) * 100)}%` : '—';
      return {
        ch,
        on: sent > 0,
        meta: sent > 0 ? `${sent.toLocaleString('en-US')} sent` : 'No messages yet',
        open: pctOf(read),
        click: pctOf(clicked),
      };
    });
  } else if (live) {
    // Live but still loading — show empty channels rather than fake numbers.
    channelRows = CHANNEL_ORDER.map((ch) => ({
      ch,
      on: false,
      meta: 'No messages yet',
      open: '—',
      click: '—',
    }));
  } else {
    // Fixture/marketing preview keeps its illustrative values.
    channelRows = [
      { ch: 'email', on: reach.email, meta: '24 sent', open: sub.opens, click: sub.clicks },
      {
        ch: 'sms',
        on: reach.sms,
        meta: reach.sms ? '6 sent' : 'Not opted in',
        open: reach.sms ? '58%' : '—',
        click: reach.sms ? '21%' : '—',
      },
      {
        ch: 'whatsapp',
        on: reach.whatsapp,
        meta: reach.whatsapp ? '3 sent' : 'Not opted in',
        open: reach.whatsapp ? '92%' : '—',
        click: reach.whatsapp ? '34%' : '—',
      },
      {
        ch: 'voice',
        on: reach.voice,
        meta: reach.voice ? '2 calls' : 'Not opted in',
        open: reach.voice ? '75%' : '—',
        click: '—',
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

          {/* stat cards */}
          <div className={`adrawer__kpis ${styles.sbdStats}`}>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Avg. Opens</div>
              <div className="tnum adrawer__kpi-v">{sub.opens}</div>
            </div>
            <div className="adrawer__kpi">
              <div className="adrawer__kpi-k">Avg. Clicks</div>
              <div className="tnum adrawer__kpi-v">{sub.clicks}</div>
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
              {channelRows.map(({ ch, on, meta, open, click }) => {
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
                      <div className={styles.sbdChanMeta}>{meta}</div>
                    </div>
                    <div className={styles.sbdChanMetrics}>
                      <div>
                        <span className={`tnum ${styles.sbdChanNum}`}>{open}</span>
                        <span className={styles.sbdChanSub}>open</span>
                      </div>
                      <div>
                        <span className={`tnum ${styles.sbdChanNum}`}>{click}</span>
                        <span className={styles.sbdChanSub}>click</span>
                      </div>
                    </div>
                  </div>
                );
              })}
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
  onClose,
  onSave,
  onDelete,
  lists,
  tags,
  live,
}: {
  edit: SavedSegment | null;
  onClose: () => void;
  onSave: (seg: SavedSegment) => void;
  onDelete: (id: string) => void;
  lists: { id: string; name: string }[];
  tags: string[];
  live: boolean;
}) {
  const [name, setName] = useState(edit?.name ?? '');
  const [matchType, setMatchType] = useState<'all' | 'any'>(edit?.matchType ?? 'all');
  const [rows, setRows] = useState<SegRule[]>(
    edit?.rows ?? [{ field: 'Status', op: 'eq', val: 'active' }],
  );
  const [count, setCount] = useState<number | null>(null);

  /** Values offered for a field — real lists and tags, not a fixed vocabulary. */
  const valuesFor = (field: SegField): { value: string; label: string }[] => {
    if (field === 'Status') return STATUS_VALUES.map((v) => ({ value: v, label: v }));
    if (field === 'List') return lists.map((l) => ({ value: l.id, label: l.name }));
    if (field === 'Tag') return tags.map((t) => ({ value: t, label: t }));
    return [];
  };

  const setField = (i: number, field: SegField) => {
    const op = SEG_OPS[field][0]!.op;
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
          rules: toApiRules(rows),
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
  }, [rows, matchType, live]);

  const submit = () => {
    onSave({
      // The service mints ids; this placeholder is only used to decide
      // create-vs-update and is replaced by the saved row.
      id: edit?.id ?? 'new',
      name: name.trim() || 'Untitled segment',
      matchType,
      rows,
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
              const freeText = row.field === 'Email' || row.field === 'Name';
              return (
                <div key={i} className={styles.segmRow}>
                  <select
                    className={styles.segmSel}
                    value={row.field}
                    onChange={(e) => setField(i, e.target.value as SegField)}
                    aria-label="Field"
                  >
                    {SEG_FIELD_LIST.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <select
                    className={styles.segmSel}
                    value={row.op}
                    onChange={(e) => setOp(i, e.target.value as SegOp)}
                    aria-label="Operator"
                  >
                    {SEG_OPS[row.field].map((o) => (
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
                      placeholder={row.field === 'Email' ? 'example.com' : 'Ada'}
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
