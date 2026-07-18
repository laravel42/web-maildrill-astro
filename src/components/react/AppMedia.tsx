import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { mediaFiles, folderOf, FOLDER_ORDER } from '@/lib/app/media-data';
import type { MediaFile, MediaFileType, MediaFolder } from '@/lib/app/media-data';
import Icon from './Icon';

// ---- helpers (deterministic; no Date.now / no randomness) -------------------
function agoMin(s: string): number {
  const m = s.match(/(\d+)\s*([smhdw])/);
  if (!m) return 0;
  const n = parseInt(m[1], 10);
  const mult = m[2] === 's' ? 1 / 60 : m[2] === 'm' ? 1 : m[2] === 'h' ? 60 : m[2] === 'd' ? 1440 : 10080;
  return n * mult;
}
function sizeBytes(s: string): number {
  const m = s.match(/([\d.]+)\s*(KB|MB|GB|B)/i);
  if (!m) return 0;
  const u = m[2].toUpperCase();
  const mult = u === 'GB' ? 1e9 : u === 'MB' ? 1e6 : u === 'KB' ? 1e3 : 1;
  return parseFloat(m[1]) * mult;
}
function dimFirst(s: string): number {
  const m = s.match(/\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

const TAG_PALETTE = [
  { bg: 'var(--accent-tint)', c: '#4f46e5' },
  { bg: '#e0f5fa', c: '#0891b2' },
  { bg: '#e7f6ec', c: '#16a34a' },
  { bg: '#fef3e2', c: '#d97706' },
  { bg: '#fde8ef', c: '#be185d' },
  { bg: '#ede9fe', c: '#7c3aed' },
];
function tagStyle(tag: string): { bg: string; c: string } {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

const TYPE_ORDER: MediaFileType[] = ['JPEG', 'PNG', 'SVG', 'PDF', 'XLSX', 'DOCX'];
const POPOVER_TYPES: MediaFileType[] = ['JPEG', 'PNG', 'SVG'];
const VIEWS = [
  { key: 'grid', label: 'Grid' },
  { key: 'list', label: 'List' },
  { key: 'compact', label: 'Compact' },
] as const;
type ViewKey = (typeof VIEWS)[number]['key'];

type SortKey = 'name' | 'type' | 'dim' | 'size' | 'uploaded';
const ASC_FIRST: Record<SortKey, boolean> = { name: true, type: true, dim: false, size: false, uploaded: false };
const PAGE_SIZE = 10;

function Box({ on, size = 17 }: { on: boolean; size?: number }) {
  return (
    <span className={`ml__box${on ? ' is-on' : ''}`} style={{ width: size, height: size }}>
      {on && <Icon name="check" size={Math.round(size * 0.62)} stroke={3} />}
    </span>
  );
}

export default function AppMedia() {
  const [view, setView] = useState<ViewKey>('list');
  const [folder, setFolder] = useState<MediaFolder>('All files');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [popTypes, setPopTypes] = useState<Set<MediaFileType>>(new Set());
  const [colOpen, setColOpen] = useState(false);
  const [colTypes, setColTypes] = useState<Set<MediaFileType>>(new Set());
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'uploaded', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});
  const [prog, setProg] = useState(72);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };
  const resetPage = () => setPage(1);

  // folder counts over the full set
  const folderCounts = useMemo(() => {
    const c: Record<string, number> = { 'All files': mediaFiles.length };
    for (const m of mediaFiles) {
      const f = folderOf(m.type);
      c[f] = (c[f] ?? 0) + 1;
    }
    return c;
  }, []);
  const folders = useMemo(() => FOLDER_ORDER.filter((f) => f === 'All files' || (folderCounts[f] ?? 0) > 0), [folderCounts]);
  const presentTypes = useMemo(() => TYPE_ORDER.filter((t) => mediaFiles.some((m) => m.type === t)), []);

  const effTags = (m: MediaFile): string[] => tagStore[m.id] ?? [m.type];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const tf = tagFilter?.toLowerCase();
    let list = mediaFiles.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (folder !== 'All files' && folderOf(m.type) !== folder) return false;
      if (popTypes.size && !popTypes.has(m.type)) return false;
      if (colTypes.size && !colTypes.has(m.type)) return false;
      if (tf && !effTags(m).some((t) => t.toLowerCase() === tf)) return false;
      return true;
    });
    const { key, dir } = sort;
    list = [...list].sort((a, b) => {
      let r: number;
      if (key === 'name') r = a.name.localeCompare(b.name);
      else if (key === 'type') r = a.type.localeCompare(b.type);
      else if (key === 'dim') r = dimFirst(a.dim) - dimFirst(b.dim);
      else if (key === 'size') r = sizeBytes(a.size) - sizeBytes(b.size);
      else r = -agoMin(a.uploaded) - -agoMin(b.uploaded);
      return r * dir;
    });
    return list;
  }, [query, folder, popTypes, colTypes, tagFilter, sort, tagStore]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const startIdx = (curPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);
  const start = total === 0 ? 0 : startIdx + 1;
  const end = Math.min(startIdx + PAGE_SIZE, total);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: (ASC_FIRST[key] ? 1 : -1) as 1 | -1 }));
  const sortArrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? '↑' : '↓') : '');

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));
  const toggleAll = () =>
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        pageRows.forEach((r) => next.delete(r.id));
        return next;
      }
      return new Set([...prev, ...pageRows.map((r) => r.id)]);
    });

  const bulk = (verb: string) => {
    showToast(`${verb} ${selected.size} file${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  const toggleFrom = (set: Set<MediaFileType>, setter: (s: Set<MediaFileType>) => void, t: MediaFileType) => {
    const next = new Set(set);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setter(next);
    resetPage();
  };

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...[...popTypes].map((t) => ({ key: `pop:${t}`, label: `Type: ${t}`, remove: () => toggleFrom(popTypes, setPopTypes, t) })),
    ...[...colTypes].map((t) => ({ key: `col:${t}`, label: `Type: ${t}`, remove: () => toggleFrom(colTypes, setColTypes, t) })),
    ...(tagFilter ? [{ key: 'tag', label: `Tag: ${tagFilter}`, remove: () => { setTagFilter(null); resetPage(); } }] : []),
  ];
  const clearChips = () => {
    setPopTypes(new Set());
    setColTypes(new Set());
    setTagFilter(null);
    resetPage();
  };

  const openFile = openId ? mediaFiles.find((m) => m.id === openId) ?? null : null;

  // Escape closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (uploadOpen) setUploadOpen(false);
      else if (openId) setOpenId(null);
      else if (filterOpen) setFilterOpen(false);
      else if (colOpen) setColOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploadOpen, openId, filterOpen, colOpen]);

  // mock upload progress (client-only, after the modal is opened)
  useEffect(() => {
    if (!uploadOpen) return;
    setProg(24);
    const id = window.setInterval(() => {
      setProg((p) => {
        if (p >= 72) {
          window.clearInterval(id);
          return 72;
        }
        return Math.min(72, p + 6);
      });
    }, 130);
    return () => window.clearInterval(id);
  }, [uploadOpen]);

  const onRowActivate = (id: string) => (e: ReactKeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpenId(id);
    }
  };

  return (
    <div className="screen ml">
      {/* header */}
      <div className="screen__head">
        <div>
          <h1 className="screen__h1">Media Library</h1>
          <p className="screen__sub">Upload and manage your images and files.</p>
        </div>
        <button type="button" className="pbtn" onClick={() => setUploadOpen(true)}>
          <Icon name="upload" size={15} stroke={2.2} />
          Upload file
        </button>
      </div>

      {/* toolbar */}
      <div className="ml__toolbar">
        <label className="ml__search">
          <Icon name="search" size={15} className="ml__searchic" />
          <input
            type="search"
            placeholder="Search files…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              resetPage();
            }}
            aria-label="Search files"
          />
        </label>

        {/* Filters popover */}
        <div className="ml__pop-wrap">
          <button
            type="button"
            className={`sbtn ml__filterbtn${popTypes.size ? ' is-on' : ''}`}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setFilterOpen((v) => !v);
              setColOpen(false);
            }}
          >
            <Icon name="filter" size={14} />
            Filters
            {popTypes.size > 0 && <span className="ml__dot" aria-hidden="true" />}
          </button>
          {filterOpen && (
            <>
              <button type="button" className="ml__scrim" aria-label="Close filters" onClick={() => setFilterOpen(false)} />
              <div className="ml__filterpop" role="dialog" aria-label="Filter files">
                <p className="adrawer__eyebrow ml__pop-eyebrow">File type</p>
                <div className="ml__chiprow">
                  {POPOVER_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`ml__typechip${popTypes.has(t) ? ' is-on' : ''}`}
                      aria-pressed={popTypes.has(t)}
                      onClick={() => toggleFrom(popTypes, setPopTypes, t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className="ml__pop-div" />
                <button
                  type="button"
                  className="ml__pop-clear"
                  onClick={() => {
                    setPopTypes(new Set());
                    resetPage();
                  }}
                >
                  <Icon name="trash" size={13} />
                  Clear filters
                </button>
              </div>
            </>
          )}
        </div>

        {/* Type column dropdown */}
        <div className="ml__pop-wrap">
          <button
            type="button"
            className={`ml__coltoggle${colTypes.size ? ' is-on' : ''}`}
            aria-expanded={colOpen}
            onClick={() => {
              setColOpen((v) => !v);
              setFilterOpen(false);
            }}
          >
            Type
            {colTypes.size > 0 && <span className="ml__colcount tnum">{colTypes.size}</span>}
            <Icon name="chevron-down" size={12} className={`ml__caret${colOpen ? ' is-open' : ''}`} />
          </button>
          {colOpen && (
            <>
              <button type="button" className="ml__scrim" aria-label="Close type filter" onClick={() => setColOpen(false)} />
              <div className="ml__coldrop" role="menu">
                {presentTypes.map((t) => (
                  <label key={t} className="ml__colopt">
                    <input type="checkbox" checked={colTypes.has(t)} onChange={() => toggleFrom(colTypes, setColTypes, t)} />
                    {t}
                  </label>
                ))}
                {colTypes.size > 0 && (
                  <button
                    type="button"
                    className="ml__pop-clear ml__coldrop-clear"
                    onClick={() => {
                      setColTypes(new Set());
                      resetPage();
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* active chips */}
        {chips.length > 0 && (
          <div className="ml__chips">
            {chips.map((c) => (
              <span key={c.key} className="ml__chip">
                {c.label}
                <button type="button" className="ml__chip-x" aria-label={`Remove ${c.label}`} onClick={c.remove}>
                  <Icon name="x" size={11} stroke={2.6} />
                </button>
              </span>
            ))}
            <button type="button" className="ml__chips-clear" onClick={clearChips}>
              Clear all
            </button>
          </div>
        )}

        <div className="ml__spacer" />

        {/* view switch */}
        <div className="aseg" role="tablist" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="tab"
              aria-selected={view === v.key}
              className={`aseg__opt${view === v.key ? ' is-active' : ''}`}
              onClick={() => setView(v.key)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* card container */}
      <div className="acrd ml__card">
        {/* folder tabs */}
        <div className="ml__folders atabs" role="tablist" aria-label="Folders">
          {folders.map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={folder === f}
              className={`atab${folder === f ? ' is-active' : ''}`}
              onClick={() => {
                setFolder(f);
                setSelected(new Set());
                resetPage();
              }}
            >
              {f}
              <span className="atab__count tnum">{folderCounts[f] ?? 0}</span>
            </button>
          ))}
        </div>

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className="ml__bulk">
            <span className="ml__bulkcount tnum">{selected.size} selected</span>
            <span className="ml__bulkdiv" />
            <button type="button" className="ml__bulkbtn" onClick={() => bulk('Downloading')}>
              <Icon name="download" size={13} />
              Download
            </button>
            <button type="button" className="ml__bulkbtn" onClick={() => bulk('Moved')}>
              <Icon name="layers" size={13} />
              Move to folder
            </button>
            <button type="button" className="ml__bulkbtn ml__bulkbtn--danger" onClick={() => bulk('Deleted')}>
              <Icon name="trash" size={13} />
              Delete
            </button>
            <button type="button" className="ml__bulkclear" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </div>
        )}

        {/* views */}
        {total === 0 ? (
          <div className="atable__empty">No files match your search.</div>
        ) : view === 'grid' ? (
          <div className="ml__grid">
            {pageRows.map((m) => (
              <div
                key={m.id}
                className={`acrd acrd--hover ml__gcard${selected.has(m.id) ? ' is-sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <button
                  type="button"
                  className="ml__gcheck"
                  aria-label={`Select ${m.name}`}
                  aria-pressed={selected.has(m.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(m.id);
                  }}
                >
                  <Box on={selected.has(m.id)} size={19} />
                </button>
                <div className="ml__thumb ml__thumb--grid" style={{ background: m.thumb, color: m.fg }}>
                  {m.label && <span className="ml__thumb-label">{m.label}</span>}
                </div>
                <div className="ml__gcap">
                  <div className="ml__fname" title={m.name}>{m.name}</div>
                  <div className="ml__gdim tnum">{m.dim}</div>
                </div>
              </div>
            ))}
          </div>
        ) : view === 'compact' ? (
          <div className="ml__compact">
            {pageRows.map((m) => (
              <div
                key={m.id}
                className="ml__ccell"
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <div
                  className="ml__thumb ml__thumb--compact"
                  style={{ background: m.thumb, color: m.fg, borderColor: selected.has(m.id) ? '#4f46e5' : 'var(--border)' }}
                >
                  {m.label && <span className="ml__thumb-label ml__thumb-label--sm">{m.label}</span>}
                  <button
                    type="button"
                    className="ml__ccheck"
                    aria-label={`Select ${m.name}`}
                    aria-pressed={selected.has(m.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(m.id);
                    }}
                  >
                    <Box on={selected.has(m.id)} size={18} />
                  </button>
                </div>
                <div className="ml__cname" title={m.name}>{m.name}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="ml__list">
            <div className="ml__lhead ml__lgrid">
              <div className="ml__check" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="ml__checkbtn" aria-label="Select all on page" aria-pressed={allChecked} onClick={toggleAll}>
                  <Box on={allChecked} />
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('name')}>Name <span className="tnum">{sortArrow('name')}</span></button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('type')}>Type <span className="tnum">{sortArrow('type')}</span></button>
              </div>
              <div className="ml__r">
                <button type="button" onClick={() => toggleSort('dim')}>Dimensions <span className="tnum">{sortArrow('dim')}</span></button>
              </div>
              <div className="ml__r">
                <button type="button" onClick={() => toggleSort('size')}>Size <span className="tnum">{sortArrow('size')}</span></button>
              </div>
              <div className="ml__r">
                <button type="button" onClick={() => toggleSort('uploaded')}>Uploaded <span className="tnum">{sortArrow('uploaded')}</span></button>
              </div>
              <div />
            </div>

            {pageRows.map((m) => (
              <div
                key={m.id}
                className={`ml__lrow ml__lgrid${selected.has(m.id) ? ' is-sel' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <div className="ml__check" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="ml__checkbtn" aria-label={`Select ${m.name}`} aria-pressed={selected.has(m.id)} onClick={() => toggleSelect(m.id)}>
                    <Box on={selected.has(m.id)} />
                  </button>
                </div>
                <div className="ml__lname-cell">
                  <span className="ml__lthumb" style={{ background: m.thumb, color: m.fg }} aria-hidden="true">{m.label}</span>
                  <span className="ml__fname" title={m.name}>{m.name}</span>
                </div>
                <div><span className="ml__typepill">{m.type}</span></div>
                <div className="ml__r tnum ml__muted4">{m.dim}</div>
                <div className="ml__r tnum ml__muted4">{m.size}</div>
                <div className="ml__r tnum ml__muted">{m.uploaded}</div>
                <div className="ml__check" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="kbtn" aria-label={`Actions for ${m.name}`} onClick={() => showToast('Row menu')}>
                    <Icon name="more" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* footer / pager */}
        <div className="ml__foot">
          <span className="tnum ml__count">
            {total === 0 ? 'No files match your search' : `${start}–${end} of ${total} file${total === 1 ? '' : 's'}`}
          </span>
          {pageCount > 1 && (
            <div className="ml__pager">
              <button type="button" className="ml__pgarrow" disabled={curPage === 1} aria-label="Previous page" onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <Icon name="chevron-right" size={15} className="ml__flip" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`ml__pgnum tnum${n === curPage ? ' is-active' : ''}`}
                  aria-current={n === curPage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button type="button" className="ml__pgarrow" disabled={curPage === pageCount} aria-label="Next page" onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
                <Icon name="chevron-right" size={15} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* preview drawer */}
      {openFile && (
        <MediaDrawer
          key={openFile.id}
          file={openFile}
          initialTags={tagStore[openFile.id] ?? [openFile.type]}
          onClose={() => setOpenId(null)}
          onToast={showToast}
          onSaveTags={(id, tags) => {
            setTagStore((prev) => ({ ...prev, [id]: tags }));
            showToast('Tags saved');
          }}
          onFilterTag={(tag) => {
            setTagFilter(tag);
            resetPage();
            setOpenId(null);
            showToast(`Filtered by "${tag}"`);
          }}
        />
      )}

      {/* upload modal */}
      {uploadOpen && (
        <div className="ml__modal-ov" onClick={() => setUploadOpen(false)}>
          <div className="ml__modal" role="dialog" aria-modal="true" aria-label="Upload media" onClick={(e) => e.stopPropagation()}>
            <div className="ml__modal-head">
              <span className="ml__modal-title">Upload media</span>
              <button type="button" className="iconbtn" aria-label="Close" onClick={() => setUploadOpen(false)}>
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="ml__modal-body">
              <button type="button" className="ml__drop" onClick={() => showToast('File picker is a mock in this demo')}>
                <span className="ml__drop-ic">
                  <Icon name="media" size={22} />
                </span>
                <span className="ml__drop-title">Drop images here to upload</span>
                <span className="ml__drop-sub">
                  or <span className="ml__drop-browse">browse</span> · PNG, JPG, SVG up to 5 MB
                </span>
              </button>

              <p className="adrawer__eyebrow ml__queue-eyebrow">Upload queue</p>

              <div className="ml__qitem">
                <span className="ml__qthumb" style={{ background: 'linear-gradient(135deg,#93c5fd,#3b82f6)' }} aria-hidden="true" />
                <div className="ml__qmain">
                  <div className="ml__qtop">
                    <span className="ml__qname">hero-banner.jpg</span>
                    <span className="ml__qpct tnum">{prog}%</span>
                  </div>
                  <div className="abar ml__qbar">
                    <div className="abar__fill" style={{ width: `${prog}%`, background: '#4f46e5' }} />
                  </div>
                </div>
              </div>

              <div className="ml__qitem ml__qitem--last">
                <span className="ml__qthumb" style={{ background: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)' }} aria-hidden="true" />
                <div className="ml__qmain">
                  <div className="ml__qtop">
                    <span className="ml__qname">product-shot.png</span>
                    <span className="ml__qdone">
                      <Icon name="check" size={13} stroke={3} />
                      Done
                    </span>
                  </div>
                  <div className="abar ml__qbar">
                    <div className="abar__fill" style={{ width: '100%', background: '#22c55e' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="ml__modal-foot">
              <button type="button" className="sbtn" onClick={() => setUploadOpen(false)}>Cancel</button>
              <button
                type="button"
                className="pbtn"
                onClick={() => {
                  setUploadOpen(false);
                  showToast('2 files uploaded');
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="ml__toast" role="status">
          <span className="ml__toast-ic">
            <Icon name="check" size={13} stroke={3} />
          </span>
          {toast}
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
}

function MediaDrawer({
  file,
  initialTags,
  onClose,
  onToast,
  onSaveTags,
  onFilterTag,
}: {
  file: MediaFile;
  initialTags: string[];
  onClose: () => void;
  onToast: (m: string) => void;
  onSaveTags: (id: string, tags: string[]) => void;
  onFilterTag: (tag: string) => void;
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState('');
  const dirty = tags.length !== initialTags.length || tags.some((t, i) => t !== initialTags[i]);

  const addTag = () => {
    const v = draft.trim();
    if (!v) return;
    if (tags.some((t) => t.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    setTags((t) => [...t, v]);
    setDraft('');
  };
  const removeTag = (tag: string) => setTags((t) => t.filter((x) => x !== tag));

  const meta: { k: string; v: string; num?: boolean }[] = [
    { k: 'Dimensions', v: file.dim, num: true },
    { k: 'Size', v: file.size, num: true },
    { k: 'Type', v: file.type },
    { k: 'Uploaded', v: file.uploaded, num: true },
  ];

  const copyUrl = () => {
    const url = `https://cdn.maildrill.app/media/${file.name}`;
    try {
      navigator.clipboard?.writeText(url);
    } catch {
      /* clipboard may be unavailable — the toast still confirms intent */
    }
    onToast(`Copied URL for ${file.name}`);
  };

  return (
    <div className="adrawer-overlay" onClick={onClose}>
      <div className="adrawer ml__drawer" role="dialog" aria-modal="true" aria-label={`${file.name} preview`} onClick={(e) => e.stopPropagation()}>
        <div className="adrawer__head">
          <span className="adrawer__title">File preview</span>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="adrawer__body ml__drawer-body">
          <div className="ml__preview">
            <div className="ml__preview-inner" style={{ background: file.thumb, color: file.fg }}>
              {file.label || file.type}
            </div>
          </div>

          <div className="ml__dname">{file.name}</div>

          <div className="ml__meta">
            {meta.map((row, i) => (
              <div key={row.k} className="adetail" style={i === meta.length - 1 ? { borderBottom: 'none' } : undefined}>
                <span className="adetail__k">{row.k}</span>
                <span className={`adetail__v${row.num ? ' tnum' : ''}`}>{row.v}</span>
              </div>
            ))}
          </div>

          <div className="ml__tags-head">
            <span className="adrawer__eyebrow">Tags</span>
            <button
              type="button"
              className={`ml__savetags${dirty ? ' is-dirty' : ''}`}
              disabled={!dirty}
              onClick={() => onSaveTags(file.id, tags)}
            >
              Save tags
            </button>
          </div>

          <div className="ml__tags">
            {tags.map((tag) => {
              const st = tagStyle(tag);
              return (
                <span key={tag} className="ml__tag" style={{ background: st.bg, color: st.c }}>
                  <button
                    type="button"
                    className="ml__tag-label"
                    style={{ color: st.c }}
                    title="Filter files by this tag"
                    onClick={() => onFilterTag(tag)}
                  >
                    {tag}
                  </button>
                  <button type="button" className="ml__tag-x" style={{ color: st.c }} aria-label={`Remove tag ${tag}`} title="Remove tag" onClick={() => removeTag(tag)}>
                    <Icon name="x" size={10} stroke={2.6} />
                  </button>
                </span>
              );
            })}
            <input
              className="ml__tag-input"
              placeholder="Add tag…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
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

        <div className="adrawer__foot">
          <button type="button" className="sbtn" style={{ flex: 1 }} onClick={copyUrl}>
            <Icon name="copy" size={14} />
            Copy URL
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            onClick={() => {
              onToast(`Inserted ${file.name}`);
              onClose();
            }}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .ml { animation: fade .3s ease; }

  /* toolbar */
  .ml__toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; row-gap: 10px; }
  .ml__search { display: flex; align-items: center; gap: 8px; background: var(--surface2); border: 1px solid var(--border); border-radius: 9px; padding: 0 11px; width: 250px; max-width: 100%; }
  .ml__searchic { color: var(--muted); }
  .ml__search input { border: none; background: none; padding: 9px 0; font-size: 13px; color: var(--text); outline: none; width: 100%; }
  .ml__spacer { flex: 1 1 0; min-width: 0; }

  .ml__pop-wrap { position: relative; }
  .ml__filterbtn { padding: 8px 12px; border-radius: 9px; font-size: 13px; font-weight: 500; }
  .ml__filterbtn.is-on { background: var(--accent-tint); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
  .ml__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; }
  .ml__coltoggle { display: inline-flex; align-items: center; gap: 6px; background: var(--surface); border: 1px solid var(--border2); color: var(--text2); padding: 8px 11px; border-radius: 9px; font-size: 13px; font-weight: 500; }
  .ml__coltoggle:hover { background: var(--surface2); }
  .ml__coltoggle.is-on { background: var(--accent-tint); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }
  .ml__colcount { background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; min-width: 16px; height: 16px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; padding: 0 3px; }
  .ml__caret { opacity: .6; transition: transform .14s var(--ease-out); }
  .ml__caret.is-open { transform: rotate(180deg); }

  .ml__scrim { position: fixed; inset: 0; z-index: 39; border: 0; background: none; }
  .ml__filterpop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; width: 236px; background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-lg); padding: 10px; animation: pop .14s ease; }
  .ml__pop-eyebrow { margin: 2px 0 9px; }
  .ml__chiprow { display: flex; flex-wrap: wrap; gap: 7px; }
  .ml__typechip { padding: 5px 11px; border-radius: 20px; font-size: 12px; font-weight: 600; background: var(--surface2); color: var(--text2); border: 1px solid var(--border2); }
  .ml__typechip.is-on { background: var(--accent); color: #fff; border-color: var(--accent); }
  .ml__pop-div { height: 1px; background: var(--divider); margin: 10px -10px; }
  .ml__pop-clear { display: flex; align-items: center; gap: 7px; width: 100%; padding: 7px 8px; border-radius: 8px; font-size: 12.5px; color: var(--text3); }
  .ml__pop-clear:hover { background: var(--surface2); }

  .ml__coldrop { position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; min-width: 180px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-lg); padding: 6px; animation: pop .14s ease; }
  .ml__colopt { display: flex; align-items: center; gap: 9px; padding: 8px 9px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--text2); }
  .ml__colopt:hover { background: var(--surface2); }
  .ml__colopt input { width: 15px; height: 15px; accent-color: var(--accent); }
  .ml__coldrop-clear { margin-top: 2px; border-top: 1px solid var(--divider); border-radius: 0; }

  .ml__chips { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
  .ml__chip { display: inline-flex; align-items: center; gap: 4px; background: var(--accent-tint); color: var(--accent); font-size: 12px; font-weight: 600; padding: 3px 4px 3px 10px; border-radius: 20px; }
  .ml__chip-x { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; border-radius: 50%; color: var(--accent); }
  .ml__chip-x:hover { background: color-mix(in srgb, var(--accent) 16%, transparent); }
  .ml__chips-clear { font-size: 12px; color: var(--muted); font-weight: 500; }

  /* card */
  .ml__card { overflow: hidden; }
  .ml__folders { padding: 4px 8px 0; overflow-x: auto; }
  .ml__folders .atab { white-space: nowrap; }

  /* bulk bar */
  .ml__bulk { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: var(--accent-tint); border-bottom: 1px solid var(--divider); animation: fade .18s ease; flex-wrap: wrap; }
  .ml__bulkcount { font-size: 13px; font-weight: 600; color: var(--accent); }
  .ml__bulkdiv { width: 1px; height: 16px; background: var(--border2); }
  .ml__bulkbtn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 11px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--text2); background: var(--surface); border: 1px solid var(--border2); }
  .ml__bulkbtn:hover { background: var(--surface2); }
  .ml__bulkbtn--danger { color: var(--danger); border-color: #f3c9c9; }
  .ml__bulkbtn--danger:hover { background: var(--danger-bg); }
  .ml__bulkclear { margin-left: auto; font-size: 12.5px; color: var(--muted); }

  /* shared thumb label */
  .ml__thumb { display: flex; align-items: center; justify-content: center; text-align: center; }
  .ml__thumb-label { font-weight: 700; font-size: 12px; letter-spacing: .3px; padding: 0 12px; line-height: 1.2; }
  .ml__thumb-label--sm { font-size: 9px; padding: 0 6px; }
  .ml__fname { font-size: 12px; font-weight: 500; color: var(--text2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* checkbox */
  .ml__box { display: inline-flex; align-items: center; justify-content: center; border-radius: 5px; border: 1.5px solid var(--border2); background: var(--surface); color: #fff; transition: all .12s; }
  .ml__box.is-on { background: var(--accent); border-color: var(--accent); }
  .ml__checkbtn { display: inline-flex; }
  .ml__check { display: flex; align-items: center; justify-content: center; }

  /* GRID view */
  .ml__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(172px, 1fr)); gap: 16px; padding: 18px 19px; }
  .ml__gcard { position: relative; border-radius: 14px; overflow: hidden; cursor: pointer; padding: 0; }
  .ml__gcard.is-sel { border-color: var(--accent); }
  .ml__gcheck { position: absolute; top: 8px; left: 8px; z-index: 2; border-radius: 6px; box-shadow: 0 1px 2px rgba(0,0,0,.14); }
  .ml__thumb--grid { aspect-ratio: 4 / 3; }
  .ml__gcap { padding: 10px 12px; }
  .ml__gdim { font-size: 11px; color: var(--muted); margin-top: 3px; }

  /* COMPACT view */
  .ml__compact { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 10px; padding: 18px 19px; }
  .ml__ccell { cursor: pointer; }
  .ml__thumb--compact { position: relative; aspect-ratio: 1 / 1; border-radius: 10px; border: 1.5px solid var(--border); overflow: hidden; }
  .ml__ccheck { position: absolute; top: 6px; left: 6px; }
  .ml__cname { font-size: 11px; color: var(--text3); margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* LIST view */
  .ml__list { display: block; }
  .ml__lgrid { display: grid; grid-template-columns: 36px 2fr .8fr 1fr .8fr .9fr 36px; column-gap: 16px; align-items: center; }
  .ml__lhead { padding: 12px 19px; border-bottom: 1px solid var(--surface2); }
  .ml__lhead > div { font-size: 11px; color: var(--muted); font-weight: 600; letter-spacing: .3px; text-transform: uppercase; }
  .ml__lhead button { display: inline-flex; align-items: center; gap: 4px; color: inherit; font: inherit; letter-spacing: inherit; text-transform: inherit; }
  .ml__lhead button:hover { color: var(--text); }
  .ml__r { text-align: right; justify-content: flex-end; }
  .ml__lhead .ml__r button { justify-content: flex-end; }
  .ml__lrow { padding: 11px 19px; border-bottom: 1px solid var(--divider); font-size: 13px; cursor: pointer; transition: background .12s var(--ease-out); }
  .ml__lrow:last-child { border-bottom: none; }
  .ml__lrow:hover { background: var(--surface2); }
  .ml__lrow.is-sel { background: var(--accent-tint); }
  .ml__lname-cell { display: flex; align-items: center; gap: 11px; min-width: 0; }
  .ml__lthumb { width: 46px; height: 31px; flex: none; border-radius: 8px; box-shadow: inset 0 0 0 1px rgba(0,0,0,.06); display: flex; align-items: center; justify-content: center; font-size: 6px; font-weight: 700; text-align: center; padding: 0 3px; line-height: 1.1; overflow: hidden; }
  .ml__typepill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 10.5px; font-weight: 600; background: var(--surface2); color: var(--text3); border: 1px solid var(--border); }
  .ml__muted { color: var(--muted); }
  .ml__muted4 { color: var(--text4); }

  /* footer / pager */
  .ml__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 19px; border-top: 1px solid var(--divider); flex-wrap: wrap; }
  .ml__count { font-size: 12px; color: var(--muted); }
  .ml__pager { display: flex; align-items: center; gap: 6px; }
  .ml__pgarrow { width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border2); background: var(--surface); color: var(--text3); display: inline-flex; align-items: center; justify-content: center; }
  .ml__pgarrow:hover:not(:disabled) { background: var(--surface2); }
  .ml__pgarrow:disabled { opacity: .4; cursor: default; }
  .ml__flip { transform: rotate(180deg); }
  .ml__pgnum { min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; border: 1px solid var(--border2); background: var(--surface); color: var(--text3); font-size: 12.5px; font-weight: 600; }
  .ml__pgnum:hover { background: var(--surface2); }
  .ml__pgnum.is-active { background: var(--accent); border-color: var(--accent); color: #fff; font-weight: 700; }

  /* drawer */
  .ml__drawer { width: 400px; }
  .ml__drawer-body { padding: 20px; }
  .ml__preview { border-radius: 12px; overflow: hidden; border: 1px solid var(--border); margin-bottom: 18px; }
  .ml__preview-inner { aspect-ratio: 4 / 3; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 15px; text-align: center; padding: 0 16px; }
  .ml__dname { font-weight: 600; font-size: 14px; word-break: break-all; margin-bottom: 8px; }
  .ml__meta { margin-bottom: 4px; }
  .ml__tags-head { display: flex; align-items: center; justify-content: space-between; margin: 18px 0 10px; }
  .ml__savetags { padding: 4px 10px; border-radius: 7px; font-size: 11px; font-weight: 600; background: var(--surface2); color: var(--muted); }
  .ml__savetags.is-dirty { background: var(--accent); color: #fff; }
  .ml__tags { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; }
  .ml__tag { display: inline-flex; align-items: center; gap: 3px; padding: 3px 5px 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .ml__tag-label { font: inherit; color: inherit; }
  .ml__tag-x { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; }
  .ml__tag-x:hover { background: rgba(0,0,0,.08); }
  .ml__tag-input { flex: 1; min-width: 82px; border: 1px dashed var(--border2); border-radius: 20px; padding: 3px 11px; font-size: 11px; background: none; color: var(--text2); outline: none; }
  .ml__tag-input:focus { border-color: var(--accent); }

  /* upload modal */
  .ml__modal-ov { position: fixed; inset: 0; z-index: var(--z-modal, 90); background: rgba(28,25,23,.4); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; padding: 32px; animation: ovfade .2s ease; }
  .ml__modal { width: 560px; max-width: 100%; background: var(--surface); border-radius: 20px; box-shadow: 0 24px 60px rgba(28,25,23,.28); overflow: hidden; animation: pop .18s ease; display: flex; flex-direction: column; max-height: 100%; }
  .ml__modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid var(--divider); }
  .ml__modal-title { font-size: 15px; font-weight: 600; }
  .ml__modal-body { padding: 22px; overflow-y: auto; }
  .ml__drop { width: 100%; border: 1.5px dashed var(--muted2); border-radius: 16px; padding: 30px; text-align: center; background: var(--surface2); cursor: pointer; margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: border-color .14s, background .14s; }
  .ml__drop:hover { border-color: var(--accent); background: var(--accent-tint); }
  .ml__drop-ic { width: 44px; height: 44px; border-radius: 12px; background: var(--accent-tint); color: var(--accent); display: flex; align-items: center; justify-content: center; margin-bottom: 8px; }
  .ml__drop-title { font-size: 13.5px; font-weight: 600; color: var(--text); }
  .ml__drop-sub { font-size: 12px; color: var(--muted); }
  .ml__drop-browse { color: var(--accent); font-weight: 600; }
  .ml__queue-eyebrow { margin-bottom: 10px; }
  .ml__qitem { display: flex; align-items: center; gap: 12px; padding: 11px 13px; border: 1px solid var(--border); border-radius: 12px; margin-bottom: 9px; }
  .ml__qitem--last { margin-bottom: 0; }
  .ml__qthumb { width: 38px; height: 38px; flex: none; border-radius: 8px; }
  .ml__qmain { flex: 1; min-width: 0; }
  .ml__qtop { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
  .ml__qname { font-size: 13px; font-weight: 600; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ml__qpct { font-size: 12px; color: var(--muted); flex: none; }
  .ml__qdone { display: inline-flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 600; color: var(--success-strong); flex: none; }
  .ml__qbar { height: 6px; }
  .ml__modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; border-top: 1px solid var(--divider); background: var(--surface2); }

  /* toast */
  .ml__toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: var(--z-toast); display: flex; align-items: center; gap: 11px; background: var(--text); color: #fff; padding: 12px 16px 12px 13px; border-radius: 12px; box-shadow: 0 12px 32px rgba(28,25,23,.3); font-size: 13px; font-weight: 500; animation: toastin .22s cubic-bezier(.2,.8,.2,1); }
  .ml__toast-ic { width: 22px; height: 22px; border-radius: 50%; background: #22c55e; color: #fff; display: flex; align-items: center; justify-content: center; flex: none; }

  @media (max-width: 900px) {
    .ml__lgrid { grid-template-columns: 34px 1.8fr .8fr .9fr 34px; }
    .ml__lgrid > :nth-child(4), .ml__lgrid > :nth-child(6) { display: none; }
  }
  @media (max-width: 560px) {
    .ml__lgrid { grid-template-columns: 30px 1.6fr .8fr 30px; }
    .ml__lgrid > :nth-child(3) { display: none; }
    .ml__search { width: 100%; }
    .ml__spacer { display: none; }
  }
`;
