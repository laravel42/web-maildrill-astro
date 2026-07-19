import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { mediaFiles, folderOf, FOLDER_ORDER } from '@/lib/app/media-data';
import type { MediaFile, MediaFileType, MediaFolder } from '@/lib/app/media-data';
import Icon from './Icon';
import { useToast } from './shared/useToast';
import {
  ASC_FIRST,
  PAGE_SIZE,
  POPOVER_TYPES,
  TYPE_ORDER,
  VIEWS,
  agoMin,
  dimFirst,
  sizeBytes,
  tagStyle,
} from './AppMedia.logic';
import type { ViewKey } from './AppMedia.logic';
import type { SortKey } from './AppMedia.types';
import styles from './AppMedia.module.css';

function Box({ on, size = 17 }: { on: boolean; size?: number }) {
  return (
    <span className={`${styles.box}${on ? ' is-on' : ''}`} style={{ width: size, height: size }}>
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
  const { toast, show } = useToast();
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});
  const [prog, setProg] = useState(72);

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
  const folders = useMemo(
    () => FOLDER_ORDER.filter((f) => f === 'All files' || (folderCounts[f] ?? 0) > 0),
    [folderCounts],
  );
  const presentTypes = useMemo(
    () => TYPE_ORDER.filter((t) => mediaFiles.some((m) => m.type === t)),
    [],
  );

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
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir * -1) as 1 | -1 }
        : { key, dir: (ASC_FIRST[key] ? 1 : -1) as 1 | -1 },
    );
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
    show(`${verb} ${selected.size} file${selected.size === 1 ? '' : 's'}`);
    setSelected(new Set());
  };

  const toggleFrom = (
    set: Set<MediaFileType>,
    setter: (s: Set<MediaFileType>) => void,
    t: MediaFileType,
  ) => {
    const next = new Set(set);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setter(next);
    resetPage();
  };

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...[...popTypes].map((t) => ({
      key: `pop:${t}`,
      label: `Type: ${t}`,
      remove: () => toggleFrom(popTypes, setPopTypes, t),
    })),
    ...[...colTypes].map((t) => ({
      key: `col:${t}`,
      label: `Type: ${t}`,
      remove: () => toggleFrom(colTypes, setColTypes, t),
    })),
    ...(tagFilter
      ? [
          {
            key: 'tag',
            label: `Tag: ${tagFilter}`,
            remove: () => {
              setTagFilter(null);
              resetPage();
            },
          },
        ]
      : []),
  ];
  const clearChips = () => {
    setPopTypes(new Set());
    setColTypes(new Set());
    setTagFilter(null);
    resetPage();
  };

  const openFile = openId ? (mediaFiles.find((m) => m.id === openId) ?? null) : null;

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
    <div className="screen" style={{ animation: 'fade .3s ease' }}>
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
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Icon name="search" size={15} className={styles.searchIc} />
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
        <div className={styles.popWrap}>
          <button
            type="button"
            className={`sbtn ${styles.filterBtn}${popTypes.size ? ' is-on' : ''}`}
            aria-expanded={filterOpen}
            aria-haspopup="dialog"
            onClick={() => {
              setFilterOpen((v) => !v);
              setColOpen(false);
            }}
          >
            <Icon name="filter" size={14} />
            Filters
            {popTypes.size > 0 && <span className={styles.dot} aria-hidden="true" />}
          </button>
          {filterOpen && (
            <>
              <button
                type="button"
                className={styles.scrim}
                aria-label="Close filters"
                onClick={() => setFilterOpen(false)}
              />
              <div
                className={styles.filterPop}
                role="dialog"
                aria-label="Filter files"
                style={{ animation: 'pop .14s ease' }}
              >
                <p className={`adrawer__eyebrow ${styles.popEyebrow}`}>File type</p>
                <div className={styles.chipRow}>
                  {POPOVER_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={`${styles.typeChip}${popTypes.has(t) ? ' is-on' : ''}`}
                      aria-pressed={popTypes.has(t)}
                      onClick={() => toggleFrom(popTypes, setPopTypes, t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <div className={styles.popDiv} />
                <button
                  type="button"
                  className={styles.popClear}
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
        <div className={styles.popWrap}>
          <button
            type="button"
            className={`${styles.colToggle}${colTypes.size ? ' is-on' : ''}`}
            aria-expanded={colOpen}
            onClick={() => {
              setColOpen((v) => !v);
              setFilterOpen(false);
            }}
          >
            Type
            {colTypes.size > 0 && <span className={`${styles.colCount} tnum`}>{colTypes.size}</span>}
            <Icon
              name="chevron-down"
              size={12}
              className={`${styles.caret}${colOpen ? ' ' + styles.isOpen : ''}`}
            />
          </button>
          {colOpen && (
            <>
              <button
                type="button"
                className={styles.scrim}
                aria-label="Close type filter"
                onClick={() => setColOpen(false)}
              />
              <div className={styles.colDrop} role="menu" style={{ animation: 'pop .14s ease' }}>
                {presentTypes.map((t) => (
                  <label key={t} className={styles.colOpt}>
                    <input
                      type="checkbox"
                      checked={colTypes.has(t)}
                      onChange={() => toggleFrom(colTypes, setColTypes, t)}
                    />
                    {t}
                  </label>
                ))}
                {colTypes.size > 0 && (
                  <button
                    type="button"
                    className={`${styles.popClear} ${styles.colDropClear}`}
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
          <div className={styles.chips}>
            {chips.map((c) => (
              <span key={c.key} className={styles.chip}>
                {c.label}
                <button
                  type="button"
                  className={styles.chipX}
                  aria-label={`Remove ${c.label}`}
                  onClick={c.remove}
                >
                  <Icon name="x" size={11} stroke={2.6} />
                </button>
              </span>
            ))}
            <button type="button" className={styles.chipsClear} onClick={clearChips}>
              Clear all
            </button>
          </div>
        )}

        <div className={styles.spacer} />

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
      <div className={`acrd ${styles.card}`}>
        {/* folder tabs */}
        <div className={`${styles.folders} atabs`} role="tablist" aria-label="Folders">
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
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={`${styles.bulkCount} tnum`}>{selected.size} selected</span>
            <span className={styles.bulkDiv} />
            <button type="button" className={styles.bulkBtn} onClick={() => bulk('Downloading')}>
              <Icon name="download" size={13} />
              Download
            </button>
            <button type="button" className={styles.bulkBtn} onClick={() => bulk('Moved')}>
              <Icon name="layers" size={13} />
              Move to folder
            </button>
            <button
              type="button"
              className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
              onClick={() => bulk('Deleted')}
            >
              <Icon name="trash" size={13} />
              Delete
            </button>
            <button
              type="button"
              className={styles.bulkClear}
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        {/* views */}
        {total === 0 ? (
          <div className="atable__empty">No files match your search.</div>
        ) : view === 'grid' ? (
          <div className={styles.grid}>
            {pageRows.map((m) => (
              <div
                key={m.id}
                className={`acrd acrd--hover ${styles.gcard}${selected.has(m.id) ? ' ' + styles.isSel : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <button
                  type="button"
                  className={styles.gcheck}
                  aria-label={`Select ${m.name}`}
                  aria-pressed={selected.has(m.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSelect(m.id);
                  }}
                >
                  <Box on={selected.has(m.id)} size={19} />
                </button>
                <div
                  className={`${styles.thumb} ${styles.thumbGrid}`}
                  style={{ background: m.thumb, color: m.fg }}
                >
                  {m.label && <span className={styles.thumbLabel}>{m.label}</span>}
                </div>
                <div className={styles.gcap}>
                  <div className={styles.fname} title={m.name}>
                    {m.name}
                  </div>
                  <div className={`${styles.gdim} tnum`}>{m.dim}</div>
                </div>
              </div>
            ))}
          </div>
        ) : view === 'compact' ? (
          <div className={styles.compact}>
            {pageRows.map((m) => (
              <div
                key={m.id}
                className={styles.ccell}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <div
                  className={`${styles.thumb} ${styles.thumbCompact}`}
                  style={{
                    background: m.thumb,
                    color: m.fg,
                    borderColor: selected.has(m.id) ? '#4f46e5' : 'var(--border)',
                  }}
                >
                  {m.label && (
                    <span className={`${styles.thumbLabel} ${styles.thumbLabelSm}`}>{m.label}</span>
                  )}
                  <button
                    type="button"
                    className={styles.ccheck}
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
                <div className={styles.cname} title={m.name}>
                  {m.name}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.list}>
            <div className={`${styles.lhead} ${styles.lgrid}`}>
              <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className={styles.checkBtn}
                  aria-label="Select all on page"
                  aria-pressed={allChecked}
                  onClick={toggleAll}
                >
                  <Box on={allChecked} />
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('name')}>
                  Name <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>
                <button type="button" onClick={() => toggleSort('type')}>
                  Type <span className="tnum">{sortArrow('type')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button type="button" onClick={() => toggleSort('dim')}>
                  Dimensions <span className="tnum">{sortArrow('dim')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button type="button" onClick={() => toggleSort('size')}>
                  Size <span className="tnum">{sortArrow('size')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button type="button" onClick={() => toggleSort('uploaded')}>
                  Uploaded <span className="tnum">{sortArrow('uploaded')}</span>
                </button>
              </div>
              <div />
            </div>

            {pageRows.map((m) => (
              <div
                key={m.id}
                className={`${styles.lrow} ${styles.lgrid}${selected.has(m.id) ? ' ' + styles.isSel : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(m.id)}
                onKeyDown={onRowActivate(m.id)}
              >
                <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className={styles.checkBtn}
                    aria-label={`Select ${m.name}`}
                    aria-pressed={selected.has(m.id)}
                    onClick={() => toggleSelect(m.id)}
                  >
                    <Box on={selected.has(m.id)} />
                  </button>
                </div>
                <div className={styles.lnameCell}>
                  <span
                    className={styles.lthumb}
                    style={{ background: m.thumb, color: m.fg }}
                    aria-hidden="true"
                  >
                    {m.label}
                  </span>
                  <span className={styles.fname} title={m.name}>
                    {m.name}
                  </span>
                </div>
                <div>
                  <span className={styles.typePill}>{m.type}</span>
                </div>
                <div className={`${styles.r} tnum ${styles.muted4}`}>{m.dim}</div>
                <div className={`${styles.r} tnum ${styles.muted4}`}>{m.size}</div>
                <div className={`${styles.r} tnum ${styles.muted}`}>{m.uploaded}</div>
                <div className={styles.check} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="kbtn"
                    aria-label={`Actions for ${m.name}`}
                    onClick={() => show('Row menu')}
                  >
                    <Icon name="more" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* footer / pager */}
        <div className={styles.foot}>
          <span className={`tnum ${styles.count}`}>
            {total === 0
              ? 'No files match your search'
              : `${start}–${end} of ${total} file${total === 1 ? '' : 's'}`}
          </span>
          {pageCount > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={styles.pgArrow}
                disabled={curPage === 1}
                aria-label="Previous page"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Icon name="chevron-right" size={15} className={styles.flip} />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${styles.pgNum} tnum${n === curPage ? ' is-active' : ''}`}
                  aria-current={n === curPage ? 'page' : undefined}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                type="button"
                className={styles.pgArrow}
                disabled={curPage === pageCount}
                aria-label="Next page"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              >
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
          onToast={show}
          onSaveTags={(id, tags) => {
            setTagStore((prev) => ({ ...prev, [id]: tags }));
            show('Tags saved');
          }}
          onFilterTag={(tag) => {
            setTagFilter(tag);
            resetPage();
            setOpenId(null);
            show(`Filtered by "${tag}"`);
          }}
        />
      )}

      {/* upload modal */}
      {uploadOpen && (
        <div
          className={styles.modalOv}
          onClick={() => setUploadOpen(false)}
          style={{ animation: 'ovfade .2s ease' }}
        >
          <div
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-label="Upload media"
            onClick={(e) => e.stopPropagation()}
            style={{ animation: 'pop .18s ease' }}
          >
            <div className={styles.modalHead}>
              <span className={styles.modalTitle}>Upload media</span>
              <button
                type="button"
                className="iconbtn"
                aria-label="Close"
                onClick={() => setUploadOpen(false)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <button
                type="button"
                className={styles.drop}
                onClick={() => show('File picker is a mock in this demo')}
              >
                <span className={styles.dropIc}>
                  <Icon name="media" size={22} />
                </span>
                <span className={styles.dropTitle}>Drop images here to upload</span>
                <span className={styles.dropSub}>
                  or <span className={styles.dropBrowse}>browse</span> · PNG, JPG, SVG up to 5 MB
                </span>
              </button>

              <p className={`adrawer__eyebrow ${styles.queueEyebrow}`}>Upload queue</p>

              <div className={styles.qitem}>
                <span
                  className={styles.qthumb}
                  style={{ background: 'linear-gradient(135deg,#93c5fd,#3b82f6)' }}
                  aria-hidden="true"
                />
                <div className={styles.qmain}>
                  <div className={styles.qtop}>
                    <span className={styles.qname}>hero-banner.jpg</span>
                    <span className={`${styles.qpct} tnum`}>{prog}%</span>
                  </div>
                  <div className={`abar ${styles.qbar}`}>
                    <div
                      className="abar__fill"
                      style={{ width: `${prog}%`, background: '#4f46e5' }}
                    />
                  </div>
                </div>
              </div>

              <div className={`${styles.qitem} ${styles.qitemLast}`}>
                <span
                  className={styles.qthumb}
                  style={{ background: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)' }}
                  aria-hidden="true"
                />
                <div className={styles.qmain}>
                  <div className={styles.qtop}>
                    <span className={styles.qname}>product-shot.png</span>
                    <span className={styles.qdone}>
                      <Icon name="check" size={13} stroke={3} />
                      Done
                    </span>
                  </div>
                  <div className={`abar ${styles.qbar}`}>
                    <div className="abar__fill" style={{ width: '100%', background: '#22c55e' }} />
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className="sbtn" onClick={() => setUploadOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="pbtn"
                onClick={() => {
                  setUploadOpen(false);
                  show('2 files uploaded');
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
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
      <div
        className={`adrawer ${styles.drawer}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${file.name} preview`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adrawer__head">
          <span className="adrawer__title">File preview</span>
          <button type="button" className="iconbtn" aria-label="Close" onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className={`adrawer__body ${styles.drawerBody}`}>
          <div className={styles.preview}>
            <div className={styles.previewInner} style={{ background: file.thumb, color: file.fg }}>
              {file.label || file.type}
            </div>
          </div>

          <div className={styles.dname}>{file.name}</div>

          <div className={styles.meta}>
            {meta.map((row, i) => (
              <div
                key={row.k}
                className="adetail"
                style={i === meta.length - 1 ? { borderBottom: 'none' } : undefined}
              >
                <span className="adetail__k">{row.k}</span>
                <span className={`adetail__v${row.num ? ' tnum' : ''}`}>{row.v}</span>
              </div>
            ))}
          </div>

          <div className={styles.tagsHead}>
            <span className="adrawer__eyebrow">Tags</span>
            <button
              type="button"
              className={`${styles.saveTags}${dirty ? ' ' + styles.isDirty : ''}`}
              disabled={!dirty}
              onClick={() => onSaveTags(file.id, tags)}
            >
              Save tags
            </button>
          </div>

          <div className={styles.tags}>
            {tags.map((tag) => {
              const st = tagStyle(tag);
              return (
                <span key={tag} className={styles.tag} style={{ background: st.bg, color: st.c }}>
                  <button
                    type="button"
                    className={styles.tagLabel}
                    style={{ color: st.c }}
                    title="Filter files by this tag"
                    onClick={() => onFilterTag(tag)}
                  >
                    {tag}
                  </button>
                  <button
                    type="button"
                    className={styles.tagX}
                    style={{ color: st.c }}
                    aria-label={`Remove tag ${tag}`}
                    title="Remove tag"
                    onClick={() => removeTag(tag)}
                  >
                    <Icon name="x" size={10} stroke={2.6} />
                  </button>
                </span>
              );
            })}
            <input
              className={styles.tagInput}
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
