import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { folderLabel, libraryFolderOf, TYPE_FOLDER_ORDER } from '@/lib/app/media-data';
import type { MediaFile, MediaFolder } from '@/lib/app/media-data';
import { anyMatchesSearchQuery } from '@/lib/app/search-match';
import { api, ApiError } from '@/lib/app/api';
import { toMediaFile, type ApiMediaAsset } from '@/lib/app/media-map';
import Icon from './Icon';
import Modal from './shared/Modal';
import ConfirmDialog from './shared/ConfirmDialog';
import ColFilter from './shared/ColFilter';
import FilterChipsRow from './shared/FilterChipsRow';
import FolderFilter from './shared/FolderFilter';
import TagFilter from './shared/TagFilter';
import { useToast } from './shared/useToast';
import ToastHost from './shared/ToastHost';
import { agoNow } from './shared/time';
import { visiblePageNumbers } from './shared/pagination';
import {
  ASC_FIRST,
  ASPECT_RATIO_KEYS,
  ORIENTATIONS,
  PAGE_SIZE,
  VIEWS,
  agoMin,
  dimFirst,
  displayNameFromFile,
  downscaleToMaxEdge,
  imageToSuggestPayload,
  imageToThumb250File,
  matchesAspectRatio,
  matchesOrientation,
  mediaSize,
  sizeBytes,
  tagStyle,
  tagsFromFilename,
  toKebabCase,
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
type LiveMediaFile = MediaFile & {
  preview: string;
  url: string;
  tags: string[];
  folder: string | null;
  width: number | null;
  height: number | null;
};

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
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [orientSel, setOrientSel] = useState<Set<string>>(new Set());
  const [ratioSel, setRatioSel] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState<'orientation' | 'ratio' | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'uploaded', dir: -1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Ids waiting on the delete confirm dialog (bulk toolbar or drawer).
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadName, setUploadName] = useState('');
  const [uploadFolder, setUploadFolder] = useState('');
  const [uploadTags, setUploadTags] = useState<string[]>([]);
  const [uploadTagDraft, setUploadTagDraft] = useState('');
  const [uploadNameError, setUploadNameError] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const suggestGen = useRef(0);
  const { toast, show } = useToast();
  const [tagStore, setTagStore] = useState<Record<string, string[]>>({});

  const resetPage = () => setPage(1);

  const resetUploadForm = () => {
    suggestGen.current += 1;
    setSuggesting(false);
    setUploadQueue([]);
    setUploadName('');
    setUploadFolder('');
    setUploadTags([]);
    setUploadTagDraft('');
    setUploadNameError(false);
  };

  const openUpload = () => {
    resetUploadForm();
    // Prefill folder from the active toolbar filter when it's a custom library folder.
    if (folder !== 'All files' && !(TYPE_FOLDER_ORDER as readonly string[]).includes(folder)) {
      setUploadFolder(folder);
    }
    setUploadOpen(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setUploadOpen(false);
    resetUploadForm();
  };

  const toggleSet = (setter: typeof setOrientSel) => (v: string) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
    resetPage();
  };

  // Folder counts: custom library folders (topics) win over type buckets.
  const folderCounts = useMemo(() => {
    const c: Record<string, number> = { 'All files': mediaFiles.length };
    for (const m of mediaFiles) {
      const f = libraryFolderOf(m);
      c[f] = (c[f] ?? 0) + 1;
    }
    return c;
  }, [mediaFiles]);
  const folderOptions = useMemo(
    () =>
      Object.keys(folderCounts)
        .filter((f) => f !== 'All files' && (folderCounts[f] ?? 0) > 0)
        .sort((a, b) => a.localeCompare(b))
        .map((key) => ({
          key,
          label: folderLabel(key),
          count: folderCounts[key] ?? 0,
        })),
    [folderCounts],
  );

  // In-session edits win; otherwise the asset's real persisted tags.
  const effTags = (m: LiveMediaFile): string[] => tagStore[m.id] ?? m.tags;

  // Tags present across the library, with image counts for the filter dropdown.
  const tagUniverse = useMemo(() => {
    const freq = new Map<string, number>();
    for (const m of mediaFiles) {
      for (const t of effTags(m)) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [mediaFiles, tagStore]);
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
    const q = query.trim();
    let list = mediaFiles.filter((m) => {
      if (q) {
        // Word/prefix match on name, folder, and each tag — not mid-word
        // substrings ("two" must not match the tag "artwork").
        if (!anyMatchesSearchQuery([m.name, libraryFolderOf(m), ...effTags(m)], q)) {
          return false;
        }
      }
      if (folder !== 'All files' && libraryFolderOf(m) !== folder) return false;
      if (tagSel.size > 0 && !effTags(m).some((t) => tagSel.has(t))) return false;
      if (orientSel.size > 0 || ratioSel.size > 0) {
        const size = mediaSize(m);
        if (!size) return false;
        if (!matchesOrientation(size.width, size.height, orientSel)) return false;
        if (!matchesAspectRatio(size.width, size.height, ratioSel)) return false;
      }
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
  }, [mediaFiles, query, folder, tagSel, orientSel, ratioSel, sort, tagStore]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const curPage = Math.min(page, pageCount);
  const pagerPages = visiblePageNumbers(curPage, pageCount);
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

  /** Stage one image — leave name/tags empty until vision AI returns. */
  const stageFiles = (files: File[]) => {
    if (files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) {
      show('Only image files can be uploaded');
      return;
    }
    if (files.length > 1 || images.length > 1) {
      show('Only one image can be uploaded at a time');
    }
    const file = images[0]!;
    // Keep toolbar folder if the user opened Upload filtered to a custom folder.
    const keepFolder =
      uploadFolder.trim() && !(TYPE_FOLDER_ORDER as readonly string[]).includes(uploadFolder.trim())
        ? uploadFolder.trim()
        : '';

    setUploadQueue([file]);
    setUploadNameError(false);
    setUploadName('');
    setUploadTags([]);
    setUploadFolder(keepFolder);

    const gen = ++suggestGen.current;
    setSuggesting(true);
    void (async () => {
      try {
        const payload = await imageToSuggestPayload(file);
        const result = await api.post<{
          name: string;
          tags: string[];
          folder: string | null;
        }>('media/suggest-metadata', payload);
        if (gen !== suggestGen.current) return;
        setUploadName(toKebabCase(result.name));
        setUploadTags(result.tags);
        if (!keepFolder && result.folder) setUploadFolder(result.folder);
        setUploadNameError(false);
      } catch {
        // AI unavailable — fall back to filename only after the attempt fails.
        if (gen !== suggestGen.current) return;
        setUploadName(toKebabCase(displayNameFromFile(file.name)));
        setUploadTags(tagsFromFilename(file.name).slice(0, 3));
      } finally {
        if (gen === suggestGen.current) setSuggesting(false);
      }
    })();
  };

  /* Upload straight to S3 with a presigned PUT, then register the object.
     Registering only after the PUT succeeds means a failed upload never leaves
     an asset behind that claims to exist. Triggered by Done — not by drop. */
  const commitUpload = async () => {
    if (uploading) return;
    if (!live || !storageReady) {
      show('Media storage is not configured yet');
      return;
    }
    if (uploadQueue.length === 0) {
      show('Add an image to upload');
      return;
    }
    const name = toKebabCase(uploadName);
    if (!name) {
      setUploadNameError(true);
      document.getElementById('media-upload-name')?.focus();
      return;
    }
    setUploadName(name);
    // Cancel any in-flight AI fill so it can't overwrite after commit starts.
    suggestGen.current += 1;
    setSuggesting(false);
    setUploadNameError(false);

    const folder = uploadFolder.trim() || null;
    const tags = uploadTags;
    const queued = uploadQueue[0]!;

    setUploading(true);
    try {
      // Cap the longest edge at 1024 before any bytes leave the browser.
      const file = await downscaleToMaxEdge(queued);
      const ticket = await api.post<{ storageKey: string; uploadUrl: string }>('media/upload-url', {
        filename: file.name,
        contentType: file.type,
        sizeBytes: file.size,
      });
      // Straight to S3 — the bytes never pass through our server.
      const put = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`upload failed (${put.status})`);

      // Best-effort 250×250 cover twin for Grid/List; original still registers if this fails.
      let thumbStorageKey: string | null = null;
      try {
        const thumb = await imageToThumb250File(file);
        if (thumb) {
          const thumbTicket = await api.post<{ storageKey: string; uploadUrl: string }>(
            'media/upload-url',
            {
              filename: thumb.name,
              contentType: thumb.type,
              sizeBytes: thumb.size,
            },
          );
          const thumbPut = await fetch(thumbTicket.uploadUrl, {
            method: 'PUT',
            headers: { 'content-type': thumb.type },
            body: thumb,
          });
          if (thumbPut.ok) thumbStorageKey = thumbTicket.storageKey;
        }
      } catch {
        /* preview falls back to the full-size URL */
      }

      const dims = await imageSize(file);
      const asset = await api.post<ApiMediaAsset>('media', {
        storageKey: ticket.storageKey,
        name,
        contentType: file.type,
        sizeBytes: file.size,
        folder,
        tags,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        thumbStorageKey,
      });
      setMediaFiles((prev) => [toMediaFile(asset, prev.length), ...prev]);
      show('File uploaded');
      setUploadOpen(false);
      resetUploadForm();
    } catch (e) {
      show(e instanceof ApiError ? e.message : `Could not upload ${queued.name}`);
    } finally {
      setUploading(false);
    }
  };

  const addUploadTag = () => {
    const v = uploadTagDraft.trim();
    setUploadTagDraft('');
    if (!v || uploadTags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    setUploadTags((prev) => [...prev, v]);
  };

  /* Delete for real, and only drop rows the server actually removed. */
  const deleteMedia = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!live) {
      show('Media storage is not configured yet');
      return;
    }
    const results = await Promise.allSettled(ids.map((id) => api.del(`media/${id}`)));
    const okIds = new Set(ids.filter((_, i) => results[i].status === 'fulfilled'));
    setMediaFiles((prev) => prev.filter((f) => !okIds.has(f.id)));
    setSelected((prev) => new Set([...prev].filter((id) => !okIds.has(id))));
    if (openId && okIds.has(openId)) setOpenId(null);
    const failed = ids.length - okIds.size;
    show(
      failed
        ? `Deleted ${okIds.size}, ${failed} failed`
        : `Deleted ${okIds.size} file${okIds.size === 1 ? '' : 's'}`,
    );
  };

  /* Open each selected asset's real CDN URL — no fake "Downloading" toast. */
  const downloadSelected = () => {
    const rows = mediaFiles.filter((f) => selected.has(f.id) && f.url);
    if (rows.length === 0) {
      show('Nothing downloadable selected');
      return;
    }
    rows.forEach((f) => window.open(f.url, '_blank', 'noopener'));
    setSelected(new Set());
  };

  const saveTags = async (id: string, tags: string[]) => {
    setTagStore((prev) => ({ ...prev, [id]: tags }));
    if (!live) {
      show('Tags saved');
      return;
    }
    try {
      await api.patch<ApiMediaAsset>(`media/${id}`, { tags });
      setMediaFiles((prev) => prev.map((f) => (f.id === id ? { ...f, tags } : f)));
      show('Tags saved');
    } catch (e) {
      show(e instanceof ApiError ? e.message : 'Could not save tags');
    }
  };

  const chips = [
    ...(folder !== 'All files'
      ? [
          {
            key: `folder:${folder}`,
            label: `Folder: ${folderLabel(folder)}`,
            onRemove: () => {
              setFolder('All files');
              setSelected(new Set());
              resetPage();
            },
          },
        ]
      : []),
    ...[...tagSel].map((t) => ({
      key: `tag:${t}`,
      label: `Tag: ${t}`,
      onRemove: () => toggleTag(t),
    })),
    ...[...orientSel].map((o) => ({
      key: `orient:${o}`,
      label: `Orientation: ${o}`,
      onRemove: () => toggleSet(setOrientSel)(o),
    })),
    ...[...ratioSel].map((r) => ({
      key: `ratio:${r}`,
      label: `Ratio: ${r}`,
      onRemove: () => toggleSet(setRatioSel)(r),
    })),
  ];
  const clearChips = () => {
    setFolder('All files');
    setTagSel(new Set());
    setOrientSel(new Set());
    setRatioSel(new Set());
    setSelected(new Set());
    resetPage();
  };

  const openFile = openId ? (mediaFiles.find((m) => m.id === openId) ?? null) : null;

  // Escape closes overlays
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (uploadOpen) {
        if (!uploading) {
          setUploadOpen(false);
          resetUploadForm();
        }
      } else if (openId) setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [uploadOpen, openId, uploading]);

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
        <button type="button" className="pbtn" onClick={openUpload}>
          <Icon name="upload" size={15} stroke={2.2} />
          Upload file
        </button>
      </div>

      {/* card container */}
      <div className={`acrd ${styles.card}`}>
        {/* toolbar: controls on row 1; active filter chips always on their own row */}
        <div className={styles.toolbar}>
          <div className={styles.toolbarRow}>
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

            <FolderFilter
              options={folderOptions}
              value={folder === 'All files' ? null : folder}
              onChange={(key) => {
                setFolder((key ?? 'All files') as MediaFolder);
                setSelected(new Set());
                resetPage();
              }}
            />

            <TagFilter
              tags={tagUniverse}
              selected={tagSel}
              onToggle={toggleTag}
              onClear={() => {
                setTagSel(new Set());
                resetPage();
              }}
            />

            <ColFilter
              label="Orientation"
              icon="orientation"
              options={ORIENTATIONS}
              selected={orientSel}
              onToggle={toggleSet(setOrientSel)}
              onClear={() => {
                setOrientSel(new Set());
                resetPage();
              }}
              open={filterOpen === 'orientation'}
              onOpenToggle={() =>
                setFilterOpen((v) => (v === 'orientation' ? null : 'orientation'))
              }
            />

            <ColFilter
              label="Ratio"
              icon="ratio"
              options={ASPECT_RATIO_KEYS}
              selected={ratioSel}
              onToggle={toggleSet(setRatioSel)}
              onClear={() => {
                setRatioSel(new Set());
                resetPage();
              }}
              open={filterOpen === 'ratio'}
              onOpenToggle={() => setFilterOpen((v) => (v === 'ratio' ? null : 'ratio'))}
            />

            <div className={styles.spacer} />

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

          <FilterChipsRow chips={chips} onClearAll={clearChips} />
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
              onClick={() => setConfirmDelete([...selected])}
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
                <button
                  type="button"
                  className={sort.key === 'name' ? styles.isActive : undefined}
                  onClick={() => toggleSort('name')}
                >
                  Name <span className="tnum">{sortArrow('name')}</span>
                </button>
              </div>
              <div>
                <button
                  type="button"
                  className={sort.key === 'type' ? styles.isActive : undefined}
                  onClick={() => toggleSort('type')}
                >
                  Type <span className="tnum">{sortArrow('type')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button
                  type="button"
                  className={sort.key === 'dim' ? styles.isActive : undefined}
                  onClick={() => toggleSort('dim')}
                >
                  Dimensions <span className="tnum">{sortArrow('dim')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button
                  type="button"
                  className={sort.key === 'size' ? styles.isActive : undefined}
                  onClick={() => toggleSort('size')}
                >
                  Size <span className="tnum">{sortArrow('size')}</span>
                </button>
              </div>
              <div className={styles.r}>
                <button
                  type="button"
                  className={sort.key === 'uploaded' ? styles.isActive : undefined}
                  onClick={() => toggleSort('uploaded')}
                >
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
                <div className={`${styles.r} ${styles.muted}`}>{agoNow(m.uploaded)}</div>
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
              {pagerPages.map((n) => (
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
          initialTags={tagStore[openFile.id] ?? openFile.tags}
          onClose={() => setOpenId(null)}
          onToast={show}
          onSaveTags={(id, tags) => void saveTags(id, tags)}
          onFilterTag={(tag) => {
            if (!tagSel.has(tag)) toggleTag(tag);
            setOpenId(null);
            show(`Filtered by “${tag}”`);
          }}
          onDelete={() => setConfirmDelete([openFile.id])}
        />
      )}

      {/* upload modal */}
      <Modal
        open={uploadOpen}
        onClose={closeUpload}
        title="Upload media"
        panelClassName={styles.uploadDialog}
      >
        <div className="amodal__head">
          <span className="amodal__title">Upload media</span>
          <button
            type="button"
            className="iconbtn"
            aria-label="Close"
            onClick={closeUpload}
            disabled={uploading}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="amodal__body">
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
              if (storageReady && !uploading) stageFiles([...e.dataTransfer.files]);
            }}
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp,image/avif,image/svg+xml"
              disabled={!storageReady || uploading}
              style={{ display: 'none' }}
              onChange={(e) => {
                const files = [...(e.target.files ?? [])];
                e.target.value = '';
                stageFiles(files);
              }}
            />
            <span className={styles.dropIc}>
              <Icon name="media" size={22} />
            </span>
            <span className={styles.dropTitle}>
              {uploading
                ? 'Uploading…'
                : uploadQueue.length > 0
                  ? '1 image ready'
                  : 'Drop an image here'}
            </span>
            <span className={styles.dropSub}>
              or <span className={styles.dropBrowse}>browse</span> · PNG, JPG, GIF, WebP, AVIF,
              SVG up to 15 MB
            </span>
          </label>

          {uploadQueue.length > 0 && (
            <UploadQueue
              files={uploadQueue}
              disabled={uploading || suggesting}
              onRemove={(i) => setUploadQueue((prev) => prev.filter((_, idx) => idx !== i))}
            />
          )}

          {suggesting && (
            <p className={styles.suggesting} aria-live="polite">
              <Icon name="sparkle" size={14} />
              Analyzing image for name and tags…
            </p>
          )}

          <label className={styles.fieldLabel} htmlFor="media-upload-name">
            Name <span className={styles.req}>*</span>
          </label>
          <input
            id="media-upload-name"
            className={`${styles.fieldInput}${uploadNameError ? ` ${styles.fieldInvalid}` : ''}`}
            type="text"
            value={uploadName}
            disabled={uploading}
            required
            aria-required="true"
            aria-invalid={uploadNameError}
            onChange={(e) => {
              setUploadName(e.target.value);
              if (e.target.value.trim()) setUploadNameError(false);
            }}
            onBlur={() => {
              if (!uploadName.trim()) return;
              setUploadName(toKebabCase(uploadName));
            }}
          />
          {uploadNameError && (
            <p className={styles.fieldError} role="alert">
              Name is required
            </p>
          )}

          <span className={styles.fieldLabel} id="media-upload-folder-label">
            Folder
          </span>
          <div aria-labelledby="media-upload-folder-label">
            <FolderFilter
              options={folderOptions}
              value={uploadFolder.trim() ? uploadFolder.trim() : null}
              onChange={(key) => setUploadFolder(key ?? '')}
              block
              disabled={uploading}
            />
          </div>

          <span className={styles.fieldLabel}>Tags</span>
          <div className={styles.uploadTags}>
            {uploadTags.map((tag) => {
              const st = tagStyle(tag);
              return (
                <span
                  key={tag}
                  className={styles.tag}
                  style={{ background: st.bg, color: st.c }}
                >
                  <span className={styles.tagLabel} style={{ color: st.c }}>
                    {tag}
                  </span>
                  <button
                    type="button"
                    className={styles.tagX}
                    style={{ color: st.c }}
                    aria-label={`Remove tag ${tag}`}
                    disabled={uploading}
                    onClick={() => setUploadTags((prev) => prev.filter((t) => t !== tag))}
                  >
                    <Icon name="x" size={14} stroke={3} />
                  </button>
                </span>
              );
            })}
            <input
              className={styles.tagInput}
              placeholder="Add tag…"
              value={uploadTagDraft}
              disabled={uploading}
              onChange={(e) => setUploadTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addUploadTag();
                }
              }}
              aria-label="Add tag"
            />
          </div>
        </div>
        <div className="amodal__foot">
          <button type="button" className="sbtn" onClick={closeUpload} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="pbtn"
            onClick={() => void commitUpload()}
            disabled={uploading || !storageReady}
          >
            {uploading ? 'Uploading…' : 'Done'}
          </button>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.length} file${confirmDelete.length === 1 ? '' : 's'}?`}
          message="This can’t be undone."
          confirmLabel="Delete"
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            const ids = confirmDelete;
            setConfirmDelete(null);
            void deleteMedia(ids);
          }}
        />
      )}

      <ToastHost toast={toast} />
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Staged upload files with object-URL thumbnails (revoked on change/unmount). */
function UploadQueue({
  files,
  disabled,
  onRemove,
}: {
  files: File[];
  disabled?: boolean;
  onRemove: (index: number) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [files]);

  return (
    <div className={styles.queue}>
      {files.map((file, i) => (
        <div
          key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
          className={`${styles.qitem}${i === files.length - 1 ? ` ${styles.qitemLast}` : ''}`}
        >
          <div
            className={styles.qthumb}
            style={
              previews[i]
                ? { background: `center / cover no-repeat url(${previews[i]})` }
                : undefined
            }
          />
          <div className={styles.qmain}>
            <div className={styles.qname}>{file.name}</div>
            <div className={styles.qmeta}>{formatFileSize(file.size)}</div>
          </div>
          <button
            type="button"
            className="iconbtn"
            aria-label={`Remove ${file.name}`}
            disabled={disabled}
            onClick={() => onRemove(i)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      ))}
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
  onDelete,
}: {
  file: MediaFile & { url?: string; preview?: string };
  initialTags: string[];
  onClose: () => void;
  onToast: (m: string) => void;
  onSaveTags: (id: string, tags: string[]) => void;
  onFilterTag: (tag: string) => void;
  onDelete: () => void;
}) {
  const [tags, setTags] = useState<string[]>(initialTags);
  const [draft, setDraft] = useState('');
  const url = file.url ?? '';
  const isAudio = file.type === 'MP3' || file.type === 'WAV' || file.type === 'AUDIO';
  const isImage = file.type === 'JPEG' || file.type === 'PNG' || file.type === 'SVG';
  // Tags autosave: adding (Enter) or removing a tag persists the whole set
  // immediately — no "Save" button. onSaveTags diffs it against the server.
  const addTag = () => {
    const v = draft.trim();
    setDraft('');
    if (!v || tags.some((t) => t.toLowerCase() === v.toLowerCase())) return;
    const next = [...tags, v];
    setTags(next);
    onSaveTags(file.id, next);
  };
  const removeTag = (tag: string) => {
    const next = tags.filter((x) => x !== tag);
    setTags(next);
    onSaveTags(file.id, next);
  };

  const meta: { k: string; v: string; num?: boolean }[] = [
    { k: 'Dimensions', v: file.dim, num: true },
    { k: 'Size', v: file.size, num: true },
    { k: 'Type', v: file.type },
    { k: 'Uploaded', v: agoNow(file.uploaded) },
  ];

  /* The asset's real CloudFront URL, for every file type. */
  const copyUrl = () => {
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
            {isImage && url ? (
              <img className={styles.previewImg} src={url} alt={file.name} />
            ) : isAudio && url ? (
              <div className={styles.audioPreview}>
                <span
                  className={styles.audioBadge}
                  style={{ background: file.thumb, color: file.fg }}
                >
                  {file.type}
                </span>
                <audio className={styles.audioPlayer} controls preload="none" src={url} />
              </div>
            ) : (
              <div
                className={styles.previewInner}
                style={{ background: file.thumb, color: file.fg }}
              >
                {file.label || file.type}
              </div>
            )}
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

          <span className={`adrawer__eyebrow ${styles.tagsEyebrow}`}>Tags</span>

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
          <button
            type="button"
            className="sbtn"
            style={{ flex: 'none', color: 'var(--danger)' }}
            aria-label={`Delete ${file.name}`}
            onClick={onDelete}
          >
            <Icon name="trash" size={15} />
          </button>
          <button type="button" className="sbtn" style={{ flex: 1 }} onClick={copyUrl}>
            <Icon name="copy" size={14} />
            Copy URL
          </button>
          <button
            type="button"
            className="pbtn"
            style={{ flex: 1 }}
            disabled={!url}
            onClick={() => url && window.open(url, '_blank', 'noopener')}
          >
            <Icon name="download" size={15} />
            Download
          </button>
        </div>
      </div>
    </div>
  );
}
