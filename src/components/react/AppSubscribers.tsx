import { useEffect, useMemo, useState } from 'react';
import Icon from './Icon';
import type { IconName } from '@/lib/icons';
import type { ChannelType, SubscriberStatus } from '@/types/app';
import {
  richSubscribers,
  BUILTIN_SEGMENTS,
  SEG_FIELDS,
  SEG_FIELD_LIST,
  type RichSubscriber,
  type SavedSegment,
  type SegField,
  type SegRule,
} from '@/lib/app/subscribers-data';
import { lists as allLists } from '@/lib/app/mock-data';
import SubscriberEditorModal from './SubscriberEditorModal';

/* Fixed reference "now" — deterministic across SSR + hydration (no Date.now()). */
const NOW = new Date('2026-07-17T18:00:00Z').getTime();
function ago(iso: string): string {
  const mins = Math.round((NOW - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? '1d ago' : days < 7 ? `${days}d ago` : `${Math.round(days / 7)}w ago`;
}
function recHrs(iso: string): number {
  return (NOW - new Date(iso).getTime()) / 3_600_000;
}

const STATUS_LABEL: Record<SubscriberStatus, string> = {
  active: 'Active',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
};
const STATUS_TABS: ('all' | SubscriberStatus)[] = ['all', 'active', 'unsubscribed', 'bounced'];

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
const CHANNELS: ChannelType[] = ['email', 'sms', 'whatsapp', 'voice'];

/* Deterministic tag styling (known map + hashed palette for custom tags). */
const TAG_MAP: Record<string, [string, string]> = {
  vip: ['var(--accent)', 'var(--accent-tint)'],
  customer: ['#15803d', '#e7f6ec'],
  lead: ['#b45309', '#fef3c7'],
  trial: ['#78756c', '#f1f0eb'],
  'churn risk': ['#b45309', '#fef3c7'],
  bounced: ['#dc2626', '#fee2e2'],
};
const TAG_PALETTE: [string, string][] = [
  ['#4f46e5', 'var(--accent-tint)'],
  ['#0d9488', '#d5f2ee'],
  ['#7c3aed', '#efe7fd'],
  ['#b45309', '#fef3c7'],
  ['#2563eb', '#e0ecff'],
];
function tagStyle(name: string): { color: string; background: string } {
  const known = TAG_MAP[name.toLowerCase()];
  if (known) return { color: known[0], background: known[1] };
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [color, background] = TAG_PALETTE[h % TAG_PALETTE.length];
  return { color, background };
}

/* Reachable-channel logic (drives channel filter + drawer engagement). */
function reachOf(s: RichSubscriber) {
  const eng = s.status === 'active';
  const tail = s.name
    .replace(/[^a-z]/gi, '')
    .slice(-2)
    .toLowerCase();
  const sms = eng && /[aeiou]/.test(tail);
  return { email: true, sms, whatsapp: eng && !sms, voice: eng && sms } as Record<
    ChannelType,
    boolean
  >;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

const PAGE_SIZE = 8;
type SortKey = 'name' | 'lists' | 'tags' | 'status' | 'last';
type ViewMode = 'table' | 'cards' | 'compact';

export default function AppSubscribers() {
  const [view, setView] = useState<ViewMode>('table');
  const [tab, setTab] = useState<'all' | SubscriberStatus>('all');
  const [query, setQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<Set<ChannelType>>(new Set());
  const [channelOpen, setChannelOpen] = useState(false);
  const [segSel, setSegSel] = useState<Set<string>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});

  const [segments, setSegments] = useState<SavedSegment[]>(BUILTIN_SEGMENTS);
  const [segModal, setSegModal] = useState<{ open: boolean; edit: SavedSegment | null }>({
    open: false,
    edit: null,
  });
  const [subEditor, setSubEditor] = useState<
    { mode: 'create' } | { mode: 'edit'; sub: RichSubscriber } | null
  >(null);

  const listNames = useMemo(() => allLists.map((l) => l.name), []);

  /* Load persisted user segments after mount (keeps SSR/first render deterministic). */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('md_userSegs');
      if (raw) {
        const custom = JSON.parse(raw) as SavedSegment[];
        if (Array.isArray(custom) && custom.length) {
          setSegments([...BUILTIN_SEGMENTS, ...custom.map((c) => ({ ...c, custom: true }))]);
        }
      }
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  const persistSegs = (next: SavedSegment[]) => {
    try {
      window.localStorage.setItem('md_userSegs', JSON.stringify(next.filter((s) => s.custom)));
    } catch {
      /* ignore */
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  const effTags = (s: RichSubscriber): string[] => tagStore[s.id] ?? s.tags;

  /* Segment matcher over the current effective tags. */
  const testRule = (s: RichSubscriber, rule: SegRule): boolean => {
    const { field, op, val } = rule;
    if (field === 'Status') {
      const map: Record<string, SubscriberStatus> = {
        Active: 'active',
        Unsubscribed: 'unsubscribed',
        Bounced: 'bounced',
      };
      const is = s.status === map[val];
      return op === 'is' ? is : !is;
    }
    if (field === 'Tag') {
      const has = effTags(s).some((t) => t.toLowerCase() === val.toLowerCase());
      return op === 'is' ? has : !has;
    }
    if (field === 'List') {
      const has = s.lists.includes(val);
      return op === 'is' ? has : !has;
    }
    if (field === 'Last activity') {
      const hrs: Record<string, number> = { '24 hours': 24, '48 hours': 48, '7 days': 168 };
      const within = recHrs(s.updatedAt) <= (hrs[val] ?? 0);
      return op === 'within' ? within : !within;
    }
    // Open rate
    const n = parseInt(s.opens, 10);
    if (Number.isNaN(n)) return false;
    const thr = parseInt(val, 10);
    return op === 'above' ? n >= thr : n < thr;
  };
  const evalSeg = (
    seg: { rows: SegRule[]; matchType: 'all' | 'any' },
    s: RichSubscriber,
  ): boolean =>
    seg.matchType === 'any'
      ? seg.rows.some((r) => testRule(s, r))
      : seg.rows.every((r) => testRule(s, r));

  const segById = useMemo(() => new Map(segments.map((s) => [s.id, s])), [segments]);

  const segCount = (seg: SavedSegment): number =>
    richSubscribers.filter((s) => evalSeg(seg, s)).length;
  const countMatch = (rows: SegRule[], matchType: 'all' | 'any'): number =>
    richSubscribers.filter((s) => evalSeg({ rows, matchType }, s)).length;

  /* Pipeline: segment → status → search+channel → tag filter → sort. */
  const segFiltered = useMemo(() => {
    if (segSel.size === 0) return richSubscribers;
    const active = [...segSel].map((id) => segById.get(id)).filter(Boolean) as SavedSegment[];
    return richSubscribers.filter((s) => active.some((seg) => evalSeg(seg, s)));
  }, [segSel, segById, tagStore]);

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
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          effTags(s).some((t) => t.toLowerCase().includes(q));
        if (!hit) return false;
      }
      if (channelFilter.size > 0) {
        const r = reachOf(s);
        if (![...channelFilter].some((ch) => r[ch])) return false;
      }
      if (tagFilter && !effTags(s).some((t) => t.toLowerCase() === tagFilter.toLowerCase()))
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
      } else if (key === 'lists') {
        av = a.lists.join(', ').toLowerCase();
        bv = b.lists.join(', ').toLowerCase();
      } else if (key === 'tags') {
        av = effTags(a).length;
        bv = effTags(b).length;
      } else if (key === 'status') {
        av = a.status;
        bv = b.status;
      } else {
        av = new Date(a.updatedAt).getTime();
        bv = new Date(b.updatedAt).getTime();
      }
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
    return list;
  }, [segFiltered, tab, query, channelFilter, tagFilter, sort, tagStore]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

  const filterByTag = (tag: string) => {
    setTagFilter(tag);
    setOpenId(null);
    resetPageAndSel();
    showToast(`Filtered by “${tag}”`);
  };

  const clearAll = () => {
    setSegSel(new Set());
    setTab('all');
    setTagFilter(null);
    setChannelFilter(new Set());
    setQuery('');
    resetPageAndSel();
  };

  const hasActiveFilters =
    segSel.size > 0 || tab !== 'all' || tagFilter !== null || channelFilter.size > 0;

  /* Esc closes drawer/modal. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (segModal.open) setSegModal({ open: false, edit: null });
      else if (openId) setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId, segModal.open]);

  const saveTags = (id: string, tags: string[]) => {
    setTagStore((prev) => ({ ...prev, [id]: tags }));
    showToast('Tags saved');
  };

  const saveSegment = (seg: SavedSegment) => {
    setSegments((prev) => {
      const exists = prev.some((s) => s.id === seg.id);
      const next = exists ? prev.map((s) => (s.id === seg.id ? seg : s)) : [...prev, seg];
      persistSegs(next);
      return next;
    });
    setSegSel((prev) => new Set(prev).add(seg.id));
    setSegModal({ open: false, edit: null });
    resetPageAndSel();
    showToast(`Segment “${seg.name}” ${segModal.edit ? 'updated' : 'created'}`);
  };
  const deleteSegment = (id: string) => {
    const name = segById.get(id)?.name ?? 'Segment';
    setSegments((prev) => {
      const next = prev.filter((s) => s.id !== id);
      persistSegs(next);
      return next;
    });
    setSegSel((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setSegModal({ open: false, edit: null });
    showToast(`Segment “${name}” deleted`);
  };

  const openSub = openId ? (richSubscribers.find((s) => s.id === openId) ?? null) : null;

  const startIdx = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endIdx = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="screen sb">
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Subscribers</h1>
          <p className="screen__sub">Everyone across your lists and segments.</p>
        </div>
        <div className="sb__actions">
          <button
            type="button"
            className="sbtn"
            onClick={() => setSegModal({ open: true, edit: null })}
          >
            <Icon name="filter" size={15} />
            Create segment
          </button>
          <button type="button" className="sbtn" onClick={() => showToast('Preparing export…')}>
            <Icon name="download" size={15} />
            Export
          </button>
          <button
            type="button"
            className="pbtn"
            onClick={() => setSubEditor({ mode: 'create' })}
          >
            <Icon name="plus" size={15} stroke={2.2} />
            Add subscriber
          </button>
        </div>
      </div>

      {/* saved segments chip row */}
      <div className="sb__segrow" role="group" aria-label="Saved segments">
        <button
          type="button"
          className={`sb__seg${segSel.size === 0 ? ' is-on' : ''}`}
          onClick={() => {
            setSegSel(new Set());
            resetPageAndSel();
          }}
          aria-pressed={segSel.size === 0}
        >
          All subscribers
          <span className="sb__segn tnum">{richSubscribers.length}</span>
        </button>
        {segments.map((seg) => {
          const on = segSel.has(seg.id);
          return (
            <span key={seg.id} className={`sb__segwrap${on ? ' is-on' : ''}`}>
              <button
                type="button"
                className={`sb__seg${on ? ' is-on' : ''}`}
                onClick={() => toggleSeg(seg.id)}
                aria-pressed={on}
              >
                {seg.name}
                <span className="sb__segn tnum">{segCount(seg)}</span>
              </button>
              {seg.custom && (
                <button
                  type="button"
                  className="sb__segedit"
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
          className="sb__segnew"
          onClick={() => setSegModal({ open: true, edit: null })}
        >
          <Icon name="plus" size={13} stroke={2.2} />
          New segment
        </button>
      </div>

      <div className="atable sb__card">
        {/* status tabs */}
        <div className="sb__tabs atabs" role="tablist" aria-label="Subscriber status">
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

        {/* toolbar */}
        <div className="sb__toolbar">
          <label className="sb__search">
            <Icon name="search" size={15} className="sb__searchic" />
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

          <div className="sb__filterwrap">
            <button
              type="button"
              className={`sb__filter${channelFilter.size ? ' is-on' : ''}`}
              aria-expanded={channelOpen}
              aria-haspopup="true"
              onClick={() => setChannelOpen((v) => !v)}
            >
              <Icon name="filter" size={14} />
              Channel
              {channelFilter.size > 0 && (
                <span className="sb__filtercount tnum">{channelFilter.size}</span>
              )}
              <Icon name="chevron-down" size={12} className="sb__filtercaret" />
            </button>
            {channelOpen && (
              <>
                <button
                  type="button"
                  className="sb__scrim"
                  aria-label="Close"
                  onClick={() => setChannelOpen(false)}
                />
                <div className="sb__pop" role="menu">
                  <div className="sb__poptitle">Subscribed to</div>
                  {CHANNELS.map((ch) => {
                    const m = CHANNEL[ch];
                    const on = channelFilter.has(ch);
                    return (
                      <button
                        key={ch}
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={on}
                        className="sb__popopt"
                        onClick={() => toggleChannel(ch)}
                      >
                        <span className={`sb__box${on ? ' is-on' : ''}`}>
                          {on && <Icon name="check" size={11} stroke={3} />}
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
                      className="sb__popclear"
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

          <div className="sb__spacer" />

          <div className="aseg sb__viewseg" role="group" aria-label="View mode">
            {(['table', 'cards', 'compact'] as ViewMode[]).map((v) => (
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

        {/* active filters */}
        {hasActiveFilters && (
          <div className="sb__active">
            <span className="sb__activelbl">ACTIVE</span>
            {[...segSel].map((id) => {
              const seg = segById.get(id);
              if (!seg) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className="sb__chip sb__chip--seg"
                  onClick={() => toggleSeg(id)}
                >
                  Segment: {seg.name}
                  <span className="sb__chipx">
                    <Icon name="x" size={11} stroke={2.4} />
                  </span>
                </button>
              );
            })}
            {tab !== 'all' && (
              <button
                type="button"
                className={`sb__chip sb__chip--st-${tab}`}
                onClick={() => {
                  setTab('all');
                  resetPageAndSel();
                }}
              >
                Status: {STATUS_LABEL[tab]}
                <span className="sb__chipx">
                  <Icon name="x" size={11} stroke={2.4} />
                </span>
              </button>
            )}
            {[...channelFilter].map((ch) => {
              const m = CHANNEL[ch];
              return (
                <button
                  key={ch}
                  type="button"
                  className="sb__chip"
                  style={{ background: m.tint, color: m.color }}
                  onClick={() => toggleChannel(ch)}
                >
                  {m.label}
                  <span className="sb__chipx">
                    <Icon name="x" size={11} stroke={2.4} />
                  </span>
                </button>
              );
            })}
            {tagFilter && (
              <button
                type="button"
                className="sb__chip"
                style={tagStyle(tagFilter)}
                onClick={() => {
                  setTagFilter(null);
                  resetPageAndSel();
                }}
              >
                Tag: {tagFilter}
                <span className="sb__chipx">
                  <Icon name="x" size={11} stroke={2.4} />
                </span>
              </button>
            )}
            <button type="button" className="sb__clearall" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="sb__bulk">
            <span className="sb__bulkcount tnum">{selected.size} selected</span>
            <span className="sb__bulkdiv" />
            <button type="button" className="sb__bulkbtn" onClick={() => bulk('Tagged')}>
              <Icon name="star" size={13} />
              Tag
            </button>
            <button type="button" className="sb__bulkbtn" onClick={() => bulk('Added')}>
              <Icon name="filter" size={13} />
              Add to segment
            </button>
            <button type="button" className="sb__bulkbtn" onClick={() => bulk('Exporting')}>
              <Icon name="download" size={13} />
              Export
            </button>
            <button
              type="button"
              className="sb__bulkbtn sb__bulkbtn--danger"
              onClick={() => bulk('Removed')}
            >
              <Icon name="trash" size={13} />
              Remove
            </button>
            <button type="button" className="sb__bulkclear" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        {/* TABLE VIEW */}
        {view === 'table' && (
          <>
            <div className="athead sb__grid">
              <div className="sb__check">
                <button
                  type="button"
                  className={`sb__box${pageAllChecked ? ' is-on' : ''}`}
                  onClick={toggleAllPage}
                  aria-label="Select all on page"
                  aria-pressed={pageAllChecked}
                >
                  {pageAllChecked && <Icon name="check" size={11} stroke={3} />}
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('name')}>
                  Subscriber <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('lists')}>
                  Lists <span className="tnum">{sortArrow('lists')}</span>
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('tags')}>
                  Tags <span className="tnum">{sortArrow('tags')}</span>
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('status')}>
                  Status <span className="tnum">{sortArrow('status')}</span>
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('last')}>
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
                  className={`atrow sb__grid${selected.has(s.id) ? ' is-selected' : ''}`}
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
                  <div className="sb__check" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className={`sb__box${selected.has(s.id) ? ' is-on' : ''}`}
                      onClick={() => toggleSelect(s.id)}
                      aria-label={`Select ${s.name}`}
                      aria-pressed={selected.has(s.id)}
                    >
                      {selected.has(s.id) && <Icon name="check" size={11} stroke={3} />}
                    </button>
                  </div>
                  <div className="sb__idcell">
                    <Avatar sub={s} size={32} />
                    <div className="sb__idtext">
                      <div className="sb__name">{s.name}</div>
                      <div className="sb__email">{s.email}</div>
                    </div>
                  </div>
                  <div className="sb__lists">{s.lists.join(', ')}</div>
                  <div className="sb__tagcell">
                    {effTags(s).length === 0 ? (
                      <span className="sb__dash">—</span>
                    ) : (
                      effTags(s).map((t) => (
                        <span key={t} className="sb__tag" style={tagStyle(t)}>
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                  <div>
                    <span className={`astatus astatus--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                  </div>
                  <div className="sb__last">{ago(s.updatedAt)}</div>
                </div>
              ))
            )}
          </>
        )}

        {/* CARDS VIEW */}
        {view === 'cards' &&
          (pageRows.length === 0 ? (
            <div className="atable__empty">No subscribers match your filters.</div>
          ) : (
            <div className="sb__cards">
              {pageRows.map((s) => (
                <div
                  key={s.id}
                  className={`sb__cardt${selected.has(s.id) ? ' is-selected' : ''}`}
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
                  <button
                    type="button"
                    className={`sb__box sb__cardbox${selected.has(s.id) ? ' is-on' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(s.id);
                    }}
                    aria-label={`Select ${s.name}`}
                    aria-pressed={selected.has(s.id)}
                  >
                    {selected.has(s.id) && <Icon name="check" size={11} stroke={3} />}
                  </button>
                  <Avatar sub={s} size={40} />
                  <div className="sb__cardname">{s.name}</div>
                  <div className="sb__email">{s.email}</div>
                  <div className="sb__cardtags">
                    {effTags(s).map((t) => (
                      <span key={t} className="sb__tag" style={tagStyle(t)}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="sb__cardfoot">
                    <span className={`astatus astatus--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                    <span className="sb__last">{ago(s.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}

        {/* COMPACT VIEW */}
        {view === 'compact' &&
          (pageRows.length === 0 ? (
            <div className="atable__empty">No subscribers match your filters.</div>
          ) : (
            pageRows.map((s) => (
              <div
                key={s.id}
                className={`sb__compact${selected.has(s.id) ? ' is-selected' : ''}`}
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
                <span className="sb__cname">{s.name}</span>
                <span className="sb__cemail">{s.email}</span>
                <span className={`astatus astatus--${s.status}`}>{STATUS_LABEL[s.status]}</span>
                <span className="sb__last sb__clast">{ago(s.updatedAt)}</span>
              </div>
            ))
          ))}

        {/* footer / pagination */}
        <div className="atable__foot sb__foot">
          <span className="tnum">
            {filtered.length === 0
              ? 'No subscribers match your filters'
              : `${startIdx}–${endIdx} of ${filtered.length} subscribers`}
          </span>
          {pageCount > 1 && (
            <div className="sb__pager">
              <button
                type="button"
                className="sb__pg"
                disabled={safePage === 1}
                onClick={() => {
                  setPage((p) => Math.max(1, p - 1));
                  setSelected(new Set());
                }}
                aria-label="Previous page"
              >
                <Icon name="chevron-right" size={15} className="sb__pgflip" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`sb__pgn tnum${n === safePage ? ' is-on' : ''}`}
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
                className="sb__pg"
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
          onClose={() => setOpenId(null)}
          onSaveTags={saveTags}
          onFilterTag={filterByTag}
          onToast={showToast}
          onEdit={() => {
            const sub = openSub;
            setOpenId(null);
            setSubEditor({ mode: 'edit', sub });
          }}
        />
      )}

      {subEditor && (
        <SubscriberEditorModal
          mode={subEditor.mode}
          initialEmail={subEditor.mode === 'edit' ? subEditor.sub.email : ''}
          initialName={subEditor.mode === 'edit' ? subEditor.sub.name : ''}
          initialStatus={subEditor.mode === 'edit' ? subEditor.sub.status : 'active'}
          initialList={subEditor.mode === 'edit' ? subEditor.sub.lists[0] : undefined}
          initialTags={subEditor.mode === 'edit' ? effTags(subEditor.sub) : []}
          lists={listNames}
          onClose={() => setSubEditor(null)}
          onSave={(values) => {
            const created = subEditor.mode === 'create';
            if (subEditor.mode === 'edit') saveTags(subEditor.sub.id, values.tags);
            setSubEditor(null);
            showToast(
              created
                ? `${values.email} added`
                : `${values.name || values.email} updated`,
            );
          }}
        />
      )}

      {segModal.open && (
        <SegmentModal
          key={segModal.edit?.id ?? 'new'}
          edit={segModal.edit}
          onClose={() => setSegModal({ open: false, edit: null })}
          onSave={saveSegment}
          onDelete={deleteSegment}
          countMatch={countMatch}
        />
      )}

      {toast && (
        <div className="sb__toast" role="status">
          <span className="sb__toastic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{`
        .sb { animation: fade .3s ease; }
        .sb__actions { display: flex; gap: 10px; flex: none; flex-wrap: wrap; }

        .sb__segrow { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; overflow-x: auto; padding-bottom: 2px; }
        .sb__segwrap { display: inline-flex; align-items: center; gap: 4px; flex: none; }
        .sb__seg { display: inline-flex; align-items: center; gap: 7px; padding: 7px 12px; border-radius: 20px; font-size: 12.5px; font-weight: 600; color: var(--text3); background: var(--surface); border: 1px solid var(--border2); white-space: nowrap; flex: none; transition: background .12s var(--ease-out), border-color .12s var(--ease-out), color .12s var(--ease-out); }
        .sb__seg:hover { background: var(--surface2); }
        .sb__seg.is-on { background: var(--accent-tint); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
        .sb__segn { font-size: 10.5px; font-weight: 700; padding: 1px 6px; border-radius: 20px; background: var(--surface2); color: var(--muted); }
        .sb__seg.is-on .sb__segn { background: color-mix(in srgb, var(--accent) 18%, transparent); color: var(--accent); }
        .sb__segedit { display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; flex: none; border-radius: 50%; color: var(--muted); background: var(--surface2); border: 1px solid var(--border2); }
        .sb__segedit:hover { color: var(--accent); border-color: var(--accent); background: var(--accent-tint); }
        .sb__segnew { display: inline-flex; align-items: center; gap: 5px; padding: 7px 12px; border-radius: 20px; font-size: 12.5px; font-weight: 600; color: var(--muted); background: none; border: 1px dashed var(--border2); white-space: nowrap; flex: none; }
        .sb__segnew:hover { color: var(--accent); border-color: var(--accent); }

        .sb__card { overflow: visible; }
        .sb__tabs { gap: 20px; padding: 0 19px; overflow-x: auto; }
        .sb__tabs .atab { padding: 14px 0 13px; white-space: nowrap; }

        .sb__toolbar { display: flex; align-items: center; gap: 8px 10px; padding: 14px 19px; border-bottom: 1px solid var(--divider); flex-wrap: wrap; }
        .sb__search { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0 11px; width: 250px; max-width: 100%; }
        .sb__searchic { color: var(--muted); }
        .sb__search input { border: none; background: none; padding: 9px 0; font-size: 13px; color: var(--text); outline: none; width: 100%; }
        .sb__filterwrap { position: relative; }
        .sb__filter { display: flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border2); padding: 8px 11px; border-radius: 9px; font-size: 13px; font-weight: 500; color: var(--text2); }
        .sb__filter.is-on { background: var(--accent-tint); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
        .sb__filtercount { background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; padding: 0 3px; }
        .sb__filtercaret { opacity: .55; }
        .sb__scrim { position: fixed; inset: 0; z-index: 39; border: 0; background: none; }
        .sb__pop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 210px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); padding: 6px; animation: pop .14s ease; }
        .sb__poptitle { font-size: 11px; font-weight: 600; letter-spacing: .3px; text-transform: uppercase; color: var(--muted); padding: 6px 9px 4px; }
        .sb__popopt { display: flex; align-items: center; gap: 9px; padding: 7px 9px; border-radius: 8px; width: 100%; }
        .sb__popopt:hover { background: var(--surface2); }
        .sb__popclear { display: block; width: 100%; text-align: left; padding: 8px 9px; margin-top: 2px; border-top: 1px solid var(--divider); font-size: 12.5px; color: var(--muted); }
        .sb__spacer { flex: 1 1 auto; }

        .sb__box { width: 17px; height: 17px; flex: none; border-radius: 5px; border: 1.5px solid var(--border2); background: var(--surface); display: inline-flex; align-items: center; justify-content: center; color: #fff; transition: all .12s; }
        .sb__box.is-on { background: var(--accent); border-color: var(--accent); }

        .sb__active { display: flex; align-items: center; gap: 8px; padding: 10px 19px; border-bottom: 1px solid var(--divider); overflow-x: auto; animation: fade .18s ease; }
        .sb__activelbl { font-size: 11px; font-weight: 600; letter-spacing: .3px; color: var(--muted); flex: none; }
        .sb__chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px 5px 11px; border-radius: 20px; font-size: 12.5px; font-weight: 600; white-space: nowrap; flex: none; background: var(--surface2); color: var(--text3); }
        .sb__chip--seg { background: var(--accent-tint); color: var(--accent); }
        .sb__chip--st-active { background: var(--success-bg); color: var(--success-strong); }
        .sb__chip--st-unsubscribed { background: var(--surface2); color: var(--text3); }
        .sb__chip--st-bounced { background: var(--danger-bg); color: var(--danger); }
        .sb__chipx { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; background: rgba(0,0,0,.08); opacity: .75; }
        .sb__clearall { flex: none; margin-left: 4px; font-size: 12.5px; font-weight: 600; color: var(--muted); padding: 5px 8px; }
        .sb__clearall:hover { color: var(--text2); }

        .sb__bulk { display: flex; align-items: center; gap: 10px; padding: 10px 19px; background: var(--accent-tint); border-bottom: 1px solid var(--divider); animation: fade .18s ease; flex-wrap: wrap; }
        .sb__bulkcount { font-size: 13px; font-weight: 600; color: var(--accent); }
        .sb__bulkdiv { width: 1px; height: 16px; background: color-mix(in srgb, var(--accent) 30%, transparent); }
        .sb__bulkbtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border2); }
        .sb__bulkbtn:hover { background: var(--surface2); }
        .sb__bulkbtn--danger { color: var(--danger); border-color: #f3c9c9; }
        .sb__bulkclear { margin-left: auto; font-size: 12.5px; font-weight: 600; color: var(--muted); }

        .sb__grid { grid-template-columns: 36px 2fr 1.4fr 1.3fr .9fr .9fr; column-gap: 12px; }
        .athead.sb__grid { padding-left: 19px; padding-right: 19px; }
        .athead.sb__grid > div { padding: 12px 0; }
        .sb__check { display: flex; align-items: center; justify-content: center; }
        .sb__idcell { display: flex; align-items: center; gap: 11px; min-width: 0; }
        .sb__idtext { min-width: 0; }
        .sb__name { font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb__email { font-size: 11.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb__lists { color: var(--text3); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb__tagcell { display: flex; flex-wrap: wrap; gap: 4px; }
        .sb__tag { padding: 2px 8px; border-radius: 20px; font-size: 10.5px; font-weight: 600; white-space: nowrap; }
        .sb__dash { color: var(--muted); }
        .sb__last { color: var(--muted); font-size: 12px; }

        .sb__cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(248px, 1fr)); gap: 14px; padding: 18px 19px; }
        .sb__cardt { position: relative; border: 1px solid var(--border); border-radius: 14px; padding: 16px; background: var(--surface); cursor: pointer; transition: border-color .12s, box-shadow .12s, transform .12s; }
        .sb__cardt:hover { border-color: var(--border2); box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .sb__cardt.is-selected { border-color: var(--accent); background: var(--accent-tint); }
        .sb__cardbox { position: absolute; top: 14px; right: 14px; }
        .sb__cardname { font-size: 13.5px; font-weight: 600; margin-top: 10px; }
        .sb__cardtags { display: flex; flex-wrap: wrap; gap: 4px; min-height: 18px; margin: 10px 0; }
        .sb__cardfoot { display: flex; align-items: center; justify-content: space-between; gap: 8px; border-top: 1px solid var(--divider); padding-top: 10px; }

        .sb__compact { display: flex; align-items: center; gap: 12px; padding: 9px 19px; border-bottom: 1px solid var(--divider); cursor: pointer; font-size: 13px; transition: background .12s; }
        .sb__compact:last-of-type { border-bottom: none; }
        .sb__compact:hover { background: var(--surface2); }
        .sb__compact.is-selected { background: var(--accent-tint); }
        .sb__cname { font-weight: 500; width: 150px; flex: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb__cemail { flex: 1; min-width: 0; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sb__clast { width: 64px; text-align: right; flex: none; }

        .sb__foot { flex-wrap: wrap; gap: 10px; }
        .sb__pager { display: flex; align-items: center; gap: 4px; }
        .sb__pg { width: 30px; height: 30px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; color: var(--text3); border: 1px solid var(--border2); background: var(--surface); }
        .sb__pg:disabled { opacity: .4; pointer-events: none; }
        .sb__pgflip { transform: rotate(180deg); }
        .sb__pgn { min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text3); border: 1px solid var(--border2); background: var(--surface); }
        .sb__pgn.is-on { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 700; }

        .sb__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: var(--bg); padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
        .sb__toastic { width: 22px; height: 22px; flex: none; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; }

        @media (max-width: 1080px) {
          .sb__grid { grid-template-columns: 36px 2fr 1.3fr .9fr .9fr; column-gap: 12px; }
          .sb__grid > :nth-child(3) { display: none; }
        }
        @media (max-width: 720px) {
          .sb__grid { grid-template-columns: 32px 1.6fr .9fr .8fr; column-gap: 10px; }
          .sb__grid > :nth-child(4) { display: none; }
          .sb__cemail { display: none; }
        }
      `}</style>
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
function SubscriberDrawer({
  sub,
  tags,
  reach,
  onClose,
  onSaveTags,
  onFilterTag,
  onToast,
  onEdit,
}: {
  sub: RichSubscriber;
  tags: string[];
  reach: Record<ChannelType, boolean>;
  onClose: () => void;
  onSaveTags: (id: string, tags: string[]) => void;
  onFilterTag: (tag: string) => void;
  onEdit: () => void;
  onToast: (m: string) => void;
}) {
  const [draft, setDraft] = useState<string[]>(tags);
  const [saved, setSaved] = useState<string[]>(tags);
  const [input, setInput] = useState('');
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const addTag = () => {
    const v = input.trim();
    if (!v) return;
    if (!draft.some((t) => t.toLowerCase() === v.toLowerCase())) setDraft((d) => [...d, v]);
    setInput('');
  };
  const removeTag = (t: string) => setDraft((d) => d.filter((x) => x !== t));

  const statusLabel = STATUS_LABEL[sub.status];

  const channelRows: { ch: ChannelType; meta: string; open: string; click: string }[] = [
    { ch: 'email', meta: '24 sent', open: sub.opens, click: sub.clicks },
    {
      ch: 'sms',
      meta: reach.sms ? '6 sent' : 'Not opted in',
      open: reach.sms ? '58%' : '—',
      click: reach.sms ? '21%' : '—',
    },
    {
      ch: 'whatsapp',
      meta: reach.whatsapp ? '3 sent' : 'Not opted in',
      open: reach.whatsapp ? '92%' : '—',
      click: reach.whatsapp ? '34%' : '—',
    },
    {
      ch: 'voice',
      meta: reach.voice ? '2 calls' : 'Not opted in',
      open: reach.voice ? '75%' : '—',
      click: '—',
    },
  ];

  type Ev = { icon: IconName; bg: string; color: string; title: string; when: string };
  const activity: Ev[] = [];
  if (sub.status === 'active') {
    activity.push({
      icon: 'eye',
      bg: 'var(--accent-tint)',
      color: 'var(--accent)',
      title: 'Opened “Summer Sale”',
      when: ago(sub.updatedAt),
    });
    activity.push({
      icon: 'target',
      bg: 'var(--success-bg)',
      color: 'var(--success-strong)',
      title: 'Clicked a link in “Spring Preview”',
      when: '3d ago',
    });
    activity.push({
      icon: 'inbox',
      bg: 'var(--surface2)',
      color: 'var(--text4)',
      title: 'Received “Welcome Series”',
      when: sub.joined,
    });
  } else if (sub.status === 'bounced') {
    activity.push({
      icon: 'x',
      bg: 'var(--danger-bg)',
      color: 'var(--danger)',
      title: 'Email bounced (hard)',
      when: ago(sub.updatedAt),
    });
  } else {
    activity.push({
      icon: 'x',
      bg: 'var(--warning-bg)',
      color: 'var(--warning)',
      title: 'Unsubscribed from all lists',
      when: ago(sub.updatedAt),
    });
  }
  activity.push({
    icon: 'plus',
    bg: 'var(--surface2)',
    color: 'var(--text4)',
    title: `Joined ${sub.lists[0] ?? 'a list'}`,
    when: sub.joined,
  });

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
          <div className="sbd__id">
            <Avatar sub={sub} size={56} />
            <div className="sbd__idtext">
              <div className="sbd__name">{sub.name}</div>
              <div className="sbd__email">{sub.email}</div>
              <span className={`astatus astatus--${sub.status} sbd__idstatus`}>{statusLabel}</span>
            </div>
          </div>

          {/* stat cards */}
          <div className="sbd__stats">
            <div className="sbd__stat">
              <div className="sbd__stat-lbl">Open rate</div>
              <div className="tnum sbd__stat-val">{sub.opens}</div>
            </div>
            <div className="sbd__stat">
              <div className="sbd__stat-lbl">Click rate</div>
              <div className="tnum sbd__stat-val">{sub.clicks}</div>
            </div>
          </div>

          {/* editable tags */}
          <div className="sbd__section">
            <div className="sbd__seclabel">
              <span className="adrawer__eyebrow">Tags</span>
              <button
                type="button"
                className="sbd__savetags"
                data-dirty={dirty}
                disabled={!dirty}
                onClick={() => {
                  onSaveTags(sub.id, draft);
                  setSaved(draft);
                }}
              >
                Save tags
              </button>
            </div>
            <div className="sbd__tags">
              {draft.map((t) => (
                <span key={t} className="sbd__tag" style={tagStyle(t)}>
                  <button
                    type="button"
                    className="sbd__taglbl"
                    title={`Filter by “${t}”`}
                    onClick={() => onFilterTag(t)}
                  >
                    {t}
                  </button>
                  <button
                    type="button"
                    className="sbd__tagx"
                    aria-label={`Remove ${t}`}
                    onClick={() => removeTag(t)}
                  >
                    <Icon name="x" size={10} stroke={2.6} />
                  </button>
                </span>
              ))}
              <input
                className="sbd__tagin"
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
          <div className="sbd__section">
            <span className="adrawer__eyebrow sbd__eyebrow">Details</span>
            <div className="adetail">
              <span className="adetail__k">Lists</span>
              <span className="adetail__v">{sub.lists.join(', ')}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Location</span>
              <span className="adetail__v">{sub.location}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Subscribed</span>
              <span className="adetail__v">{sub.joined}</span>
            </div>
            <div className="adetail">
              <span className="adetail__k">Last active</span>
              <span className="adetail__v">{ago(sub.updatedAt)}</span>
            </div>
          </div>

          {/* channel engagement */}
          <div className="sbd__section">
            <span className="adrawer__eyebrow sbd__eyebrow">Channel engagement</span>
            <div className="sbd__chans">
              {channelRows.map(({ ch, meta, open, click }) => {
                const m = CHANNEL[ch];
                const on = reach[ch];
                return (
                  <div key={ch} className="sbd__chan">
                    <span
                      className="sbd__chan-ic"
                      style={{
                        background: on ? m.tint : 'var(--surface2)',
                        color: on ? m.color : 'var(--muted)',
                      }}
                    >
                      <Icon name={m.icon} size={14} />
                    </span>
                    <div className="sbd__chan-main">
                      <div className="sbd__chan-top">
                        <span className="sbd__chan-name">{m.label}</span>
                        <span className={`sbd__chan-pill${on ? '' : ' is-off'}`}>
                          {on ? 'Active' : 'Off'}
                        </span>
                      </div>
                      <div className="sbd__chan-meta">{meta}</div>
                    </div>
                    <div className="sbd__chan-metrics">
                      <div>
                        <span className="tnum sbd__chan-num">{open}</span>
                        <span className="sbd__chan-sub">open</span>
                      </div>
                      <div>
                        <span className="tnum sbd__chan-num">{click}</span>
                        <span className="sbd__chan-sub">click</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* recent activity */}
          <div className="sbd__section">
            <span className="adrawer__eyebrow sbd__eyebrow">Recent activity</span>
            <div className="sbd__timeline">
              {activity.map((ev, i) => (
                <div key={i} className="sbd__ev">
                  <span className="sbd__ev-ic" style={{ background: ev.bg, color: ev.color }}>
                    <Icon name={ev.icon} size={14} />
                  </span>
                  <div>
                    <div className="sbd__ev-title">{ev.title}</div>
                    <div className="sbd__ev-when">{ev.when}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="adrawer__foot">
          <button
            type="button"
            className="sbtn"
            style={{ flex: 1 }}
            onClick={() => onToast('Opening campaign wizard…')}
          >
            <Icon name="send" size={15} />
            Send email
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={onEdit}
          >
            <Icon name="edit" size={15} />
            Edit
          </button>
        </div>

        <style>{`
          .sbd__id { display: flex; align-items: center; gap: 14px; margin-bottom: 22px; }
          .sbd__idtext { min-width: 0; }
          .sbd__name { font-size: 17px; font-weight: 600; letter-spacing: -.3px; }
          .sbd__email { font-size: 12.5px; color: var(--muted); margin: 2px 0 6px; }
          .sbd__idstatus { display: inline-block; }
          .sbd__stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 22px; }
          .sbd__stat { border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
          .sbd__stat-lbl { font-size: 11px; color: var(--muted); }
          .sbd__stat-val { font-size: 20px; font-weight: 600; margin-top: 4px; }
          .sbd__section { margin-bottom: 22px; }
          .sbd__eyebrow { display: block; margin-bottom: 10px; }
          .sbd__seclabel { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
          .sbd__savetags { font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 7px; background: var(--surface2); color: var(--muted); }
          .sbd__savetags[data-dirty="true"] { background: var(--accent); color: #fff; }
          .sbd__savetags:disabled { cursor: default; }
          .sbd__tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
          .sbd__tag { display: inline-flex; align-items: center; gap: 2px; padding: 3px 4px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
          .sbd__taglbl { color: inherit; font: inherit; }
          .sbd__tagx { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; color: inherit; opacity: .7; }
          .sbd__tagx:hover { opacity: 1; }
          .sbd__tagin { border: 1px dashed var(--border2); background: none; border-radius: 20px; padding: 4px 10px; font-size: 11px; color: var(--text2); outline: none; width: 92px; }
          .sbd__tagin:focus { border-color: var(--accent); }
          .adetail:first-of-type { border-top: 1px solid var(--divider); }

          .sbd__chans { display: flex; flex-direction: column; gap: 8px; }
          .sbd__chan { display: flex; align-items: center; gap: 11px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 11px; }
          .sbd__chan-ic { width: 28px; height: 28px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
          .sbd__chan-main { flex: 1; min-width: 0; }
          .sbd__chan-top { display: flex; align-items: center; gap: 7px; }
          .sbd__chan-name { font-size: 13px; font-weight: 600; }
          .sbd__chan-pill { font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 20px; background: var(--success-bg); color: var(--success-strong); }
          .sbd__chan-pill.is-off { background: var(--surface2); color: var(--muted); }
          .sbd__chan-meta { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
          .sbd__chan-metrics { display: flex; gap: 14px; text-align: right; }
          .sbd__chan-num { font-size: 13px; font-weight: 600; display: block; }
          .sbd__chan-sub { font-size: 10px; color: var(--muted); }

          .sbd__timeline { position: relative; }
          .sbd__ev { display: flex; gap: 11px; padding-bottom: 15px; }
          .sbd__ev:last-child { padding-bottom: 0; }
          .sbd__ev-ic { width: 28px; height: 28px; flex: none; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
          .sbd__ev-title { font-size: 13px; font-weight: 500; color: var(--text2); }
          .sbd__ev-when { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
        `}</style>
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
  countMatch,
}: {
  edit: SavedSegment | null;
  onClose: () => void;
  onSave: (seg: SavedSegment) => void;
  onDelete: (id: string) => void;
  countMatch: (rows: SegRule[], matchType: 'all' | 'any') => number;
}) {
  const [name, setName] = useState(edit?.name ?? '');
  const [matchType, setMatchType] = useState<'all' | 'any'>(edit?.matchType ?? 'all');
  const [rows, setRows] = useState<SegRule[]>(
    edit?.rows ?? [{ field: 'Status', op: 'is', val: 'Active' }],
  );

  const setField = (i: number, field: SegField) => {
    const spec = SEG_FIELDS[field];
    setRows((r) =>
      r.map((row, idx) => (idx === i ? { field, op: spec.ops[0], val: spec.vals[0] } : row)),
    );
  };
  const setOp = (i: number, op: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, op } : row)));
  const setVal = (i: number, val: string) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, val } : row)));
  const addRow = () => setRows((r) => [...r, { field: 'Tag', op: 'is', val: 'VIP' }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));

  const count = countMatch(rows, matchType);

  const submit = () => {
    onSave({
      id: edit?.id ?? `u${Date.now()}`,
      name: name.trim() || 'Untitled segment',
      matchType,
      rows,
      custom: true,
    });
  };

  return (
    <div className="segm-overlay" onClick={onClose}>
      <div
        className="segm"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={edit ? 'Edit segment' : 'Create segment'}
      >
        <div className="segm__head">
          <div>
            <div className="segm__title">{edit ? 'Edit segment' : 'Create segment'}</div>
            <div className="segm__sub">Filter subscribers by rules that update automatically.</div>
          </div>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="segm__body">
          <label className="segm__label" htmlFor="segname">
            Segment name
          </label>
          <input
            id="segname"
            className="segm__input"
            placeholder="e.g. Engaged VIPs"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="segm__matchline">
            Match
            <span className="aseg segm__matchseg">
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

          <div className="segm__rows">
            {rows.map((row, i) => {
              const spec = SEG_FIELDS[row.field];
              return (
                <div key={i} className="segm__row">
                  <select
                    className="segm__sel"
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
                    className="segm__sel"
                    value={row.op}
                    onChange={(e) => setOp(i, e.target.value)}
                    aria-label="Operator"
                  >
                    {spec.ops.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                  <select
                    className="segm__sel"
                    value={row.val}
                    onChange={(e) => setVal(i, e.target.value)}
                    aria-label="Value"
                  >
                    {spec.vals.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="segm__rm"
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

          <button type="button" className="segm__add" onClick={addRow}>
            <Icon name="plus" size={14} stroke={2.2} />
            Add condition
          </button>

          <div className="segm__summary">
            <Icon name="filter" size={15} />
            <span className="tnum">
              ≈ {count.toLocaleString('en-US')} subscriber{count === 1 ? '' : 's'} match
            </span>
          </div>
        </div>

        <div className="segm__foot">
          {edit && (
            <button type="button" className="segm__del" onClick={() => onDelete(edit.id)}>
              Delete
            </button>
          )}
          <button type="button" className="sbtn segm__cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="pbtn" onClick={submit}>
            {edit ? 'Save changes' : 'Save segment'}
          </button>
        </div>

        <style>{`
          .segm-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(28,25,23,.4); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 32px; animation: ovfade .2s ease; }
          .segm { width: 620px; max-width: 100%; max-height: 90vh; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 24px 60px rgba(28,25,23,.28); animation: pop .18s ease; overflow: hidden; }
          .segm__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 22px; border-bottom: 1px solid var(--divider); }
          .segm__title { font-size: 16px; font-weight: 600; }
          .segm__sub { font-size: 12.5px; color: var(--text4); margin-top: 3px; }
          .segm__body { padding: 22px; overflow-y: auto; }
          .segm__label { display: block; font-size: 12.5px; font-weight: 600; margin-bottom: 7px; }
          .segm__input { width: 100%; border: 1px solid var(--border2); border-radius: 10px; padding: 10px 12px; font-size: 13.5px; background: var(--surface); color: var(--text); margin-bottom: 20px; outline: none; }
          .segm__input:focus { border-color: var(--accent); }
          .segm__matchline { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; font-size: 12.5px; color: var(--text3); margin-bottom: 14px; }
          .segm__matchseg .aseg__opt { text-transform: capitalize; padding: 5px 11px; font-size: 12px; }
          .segm__rows { display: flex; flex-direction: column; gap: 9px; }
          .segm__row { display: grid; grid-template-columns: 1.1fr .9fr 1.1fr 34px; gap: 8px; align-items: center; }
          .segm__sel { border: 1px solid var(--border2); border-radius: 9px; padding: 8px 11px; font-size: 12.5px; background: var(--surface); color: var(--text2); outline: none; width: 100%; }
          .segm__sel:focus { border-color: var(--accent); }
          .segm__rm { width: 34px; height: 34px; border-radius: 9px; display: inline-flex; align-items: center; justify-content: center; color: var(--muted); border: 1px solid var(--border2); background: var(--surface); }
          .segm__rm:hover:not(:disabled) { color: var(--danger); border-color: #f3c9c9; }
          .segm__rm:disabled { opacity: .35; pointer-events: none; }
          .segm__add { display: inline-flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 12.5px; font-weight: 600; color: var(--accent); }
          .segm__summary { display: flex; align-items: center; gap: 9px; margin-top: 18px; padding: 12px 15px; border-radius: 12px; background: var(--accent-tint); color: var(--accent); font-size: 13px; font-weight: 600; }
          .segm__foot { display: flex; align-items: center; gap: 10px; padding: 16px 22px; border-top: 1px solid var(--divider); background: var(--surface2); }
          .segm__del { font-size: 13px; font-weight: 600; color: var(--danger); margin-right: auto; padding: 8px 12px; border-radius: 9px; }
          .segm__del:hover { background: var(--danger-bg); }
          .segm__cancel { margin-left: auto; }
          @media (max-width: 560px) {
            .segm__row { grid-template-columns: 1fr 1fr; }
            .segm__row .segm__rm { grid-column: 2; justify-self: end; }
          }
        `}</style>
      </div>
    </div>
  );
}
