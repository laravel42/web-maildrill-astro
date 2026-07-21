import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { folderOf, FOLDER_ORDER } from '@/lib/app/media-data';
import type { MediaFile, MediaFileType, MediaFolder } from '@/lib/app/media-data';
import { api, ApiError } from '@/lib/app/api';
import { toMediaFile, type ApiMediaAsset } from '@/lib/app/media-map';
import Icon from './Icon';
import ConfirmDialog from './shared/ConfirmDialog';
import TagFilter from './shared/TagFilter';
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
      {on && <Icon name="check" size={Math.round(size * 0.88)} stroke={3.5} />}
    </span>
  );
}

/** Read intrinsic dimensions so the grid can show real sizes. Non-images and
    unreadable files resolve to null rather than blocking the upload. */
async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith('image/')) return null;
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** A grid row plus the fields that only exist for live assets. */
type LiveMediaFile = MediaFile & { preview: string; tags: string[] };

export default function AppMedia({
  initial,
  storageReady = false,
}: {
  initial?: LiveMediaFile[];
  storageReady?: boolean;
} = {}) {
  const live = initial !== undefined;
  const [mediaFiles, setMediaFiles] = useState<LiveMediaFile[]>(initial ?? []);
  const [uploading, setUploading] = useState(false);
  const [view, setView] = useState<ViewKey>('list');
  const [folder, setFolder] = useState<MediaFolder>('All files');
  const [query, setQuery] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [popTypes, setPopTypes] = useState<Set<MediaFileType>>(new Set());
  const [colOpen, setColOpen] = useState(false);
  const [colTypes, setColTypes] = useState<Set<MediaFileType>>(new Set());
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'uploaded', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Set while a destructive action waits on confirmation.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { toast, show } = useToast();
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});

  const resetPage = () => setPage(1);

  // folder counts over the full set
  const folderCounts = useMemo(() => {
    const c: Record<string, number> = { 'All files': mediaFiles.length };
    for (const m of mediaFiles) {
      const f = folderOf(m.type);
      c[f] = (c[f] ?? 0) + 1;
    }
    return c;
  }, [mediaFiles]);
  const folders = useMemo(
    () => FOLDER_ORDER.filter((f) => f === 'All files' || (folderCounts[f] ?? 0) > 0),
    [folderCounts],
  );
  const presentTypes = useMemo(
    () => TYPE_ORDER.filter((t) => mediaFiles.some((m) => m.type === t)),
    [],
  );

  const effTags = (m: MediaFile): string[] => tagStore[m.id] ?? [m.type];

  // Tags present across the library (custom tags, else the file type), for the
  // tags filter dropdown.
  const tagUniverse = useMemo(
    () => [...new Set(mediaFiles.flatMap((m) => effTags(m)))].sort((a, b) => a.localeCompare(b)),
    [mediaFiles, tagStore],
  );
  const toggleTag = (t: string) => {
    setTagSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    resetPage();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = mediaFiles.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (folder !== 'All files' && folderOf(m.type) !== folder) return false;
      if (popTypes.size && !popTypes.has(m.type)) return false;
      if (colTypes.size && !colTypes.has(m.type)) return false;
      if (tagSel.size > 0 && !effTags(m).some((t) => tagSel.has(t))) return false;
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
  }, [query, folder, popTypes, colTypes, tagSel, sort, tagStore]);

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

  /* Upload straight to S3 with a presigned PUT, then register the object.
     Registering only after the PUT succeeds means a failed upload never leaves
     an asset behind that claims to exist. */
  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    if (!live || !storageReady) {
      show('Media storage is not configured yet');
      return;
    }
    setUploading(true);
    let ok = 0;
    for (const file of files) {
      try {
        const ticket = await api.post<{ storageKey: string; uploadUrl: string }>(
          'media/upload-url',
          { filename: file.name, contentType: file.type, sizeBytes: file.size },
        );
        // Straight to S3 — the bytes never pass through our server.
        const put = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        });
        if (!put.ok) throw new Error(`upload failed (${put.status})`);

        const dims = await imageSize(file);
        const asset = await api.post<ApiMediaAsset>('media', {
          storageKey: ticket.storageKey,
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
          width: dims?.width ?? null,
          height: dims?.height ?? null,
        });
        setMediaFiles((prev) => [toMediaFile(asset, prev.length), ...prev]);
        ok += 1;
      } catch (e) {
        show(e instanceof ApiError ? e.message : `Could not upload ${file.name}`);
      }
    }
    setUploading(false);
    if (ok > 0) {
      show(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
      setUploadOpen(false);
    }
  };

  /* Delete for real, and only drop rows the server actually removed. */
  const deleteSelected = async () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (!live) {
      show('Media storage is not configured yet');
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`media/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setMediaFiles((prev) => prev.filter((f) => !okIds.has(f.id)));
    const failed = ids.length - okIds.size;
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} file${okIds.size === 1 ? '' : 's'}`,
    );
    setSelected(new Set());
  };

  /* Open each selected asset's real CDN URL — no fake "Downloading" toast. */
  const downloadSelected = () => {
    const rows = mediaFiles.filter((f) => selected.has(f.id) && f.preview);
    if (rows.length === 0) {
      show('Nothing downloadable selected');
      return;
    }
    rows.forEach((f) => window.open(f.preview, '_blank', 'noopener'));
    setSelected(new Set());
  };

  const saveTags = async (id: string, tags: string[]) => {
    setTagStore((prev) => ({ ...prev, [id]: tags }));
    if (!live) return;
    try {
      await api.patch<ApiMediaAsset>(`media/${id}`, { tags });
      setMediaFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags } : f)));
      show('Tags saved');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not save tags');
    }
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
    ...[...tagSel].map((t) => ({
      key: `tag:${t}`,
      label: `Tag: ${t}`,
      remove: () => toggleTag(t),
    })),
  ];
  const clearChips = () => {
    setPopTypes(new Set());
    setColTypes(new Set());
    setTagSel(new Set());
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

          <TagFilter
            tags={tagUniverse}
            selected={tagSel}
            onToggle={toggleTag}
            onClear={() => {
              setTagSel(new Set());
              resetPage();
            }}
          />

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
                    <Icon name="x" size={14} stroke={3} />
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

        {/* bulk bar */}
        {selected.size > 0 && (
          <div className={styles.bulk} style={{ animation: 'fade .18s ease' }}>
            <span className={`${styles.bulkCount} tnum`}>{selected.size} selected</span>
            <span className={styles.bulkDiv} />
            <button type="button" className={styles.bulkBtn} onClick={downloadSelected}>
              <Icon name="download" size={13} />
              Download
            </button>
            <button
              type="button"
              className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`}
              onClick={() => setConfirmDelete(true)}
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
                  style={{
                    background: m.preview ? `center/cover no-repeat url(${m.preview})` : m.thumb,
                    color: m.fg,
                  }}
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
                    background: m.preview
                      ? `center/cover no-repeat url(${m.preview})`
                      : m.thumb,
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
                    style={{
                      background: m.preview ? `center/cover no-repeat url(${m.preview})` : m.thumb,
                      color: m.fg,
                    }}
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
            void saveTags(id, tags);
            show('Tags saved');
          }}
          onFilterTag={(tag) => {
            if (!tagSel.has(tag)) toggleTag(tag);
            setOpenId(null);
            show(`Filtered by “${tag}”`);
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
              {!storageReady && (
                <p className="screen__sub" style={{ margin: '0 0 12px' }}>
                  Media storage isn't configured yet, so uploads are disabled.
                </p>
              )}
              <label
                className={styles.drop}
                style={{
                  display: 'flex',
                  cursor: storageReady && !uploading ? 'pointer' : 'not-allowed',
                  opacity: storageReady ? 1 : 0.55,
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (storageReady && !uploading) void uploadFiles([...e.dataTransfer.files]);
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml,application/pdf"
                  disabled={!storageReady || uploading}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const files = [...(e.target.files ?? [])];
                    e.target.value = '';
                    void uploadFiles(files);
                  }}
                />
                <span className={styles.dropIc}>
                  <Icon name="media" size={22} />
                </span>
                <span className={styles.dropTitle}>
                  {uploading ? 'Uploading…' : 'Drop files here to upload'}
                </span>
                <span className={styles.dropSub}>
                  or <span className={styles.dropBrowse}>browse</span> · PNG, JPG, SVG, PDF up to
                  15 MB
                </span>
              </label>
            </div>
            <div className={styles.modalFoot}>
              <button type="button" className="sbtn" onClick={() => setUploadOpen(false)}>
                Cancel
              </button>
              <button type="button" className="pbtn" onClick={() => setUploadOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${selected.size} file${selected.size === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => {
            setConfirmDelete(false);
            void deleteSelected();
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

  /* The asset's real CloudFront URL. Previously this fabricated a
     cdn.maildrill.app link that pointed at nothing. */
  const copyUrl = () => {
    const url = (file as { preview?: string }).preview;
    if (!url) {
      onToast('No public URL for this file');
      return;
    }
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
                    <Icon name="x" size={14} stroke={3} />
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
