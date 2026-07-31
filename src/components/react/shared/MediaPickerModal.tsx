import { useEffect, useMemo, useRef, useState } from 'react';
import { folderLabel, libraryFolderOf } from '@/lib/app/media-data';
import type { MediaFolder } from '@/lib/app/media-data';
import { api } from '@/lib/app/api';
import type { ApiMediaAsset } from '@/lib/app/media-map';
import { anyMatchesSearchQuery } from '@/lib/app/search-match';
import Icon from '../Icon';
import ColFilter from './ColFilter';
import FilterChipsRow from './FilterChipsRow';
import FolderFilter from './FolderFilter';
import TagFilter from './TagFilter';
import {
  ASPECT_RATIO_KEYS,
  ORIENTATIONS,
  matchesAspectRatio,
  matchesOrientation,
  mediaSize,
} from '../AppMedia.logic';
import styles from './MediaPickerModal.module.css';

/** How many tiles to reveal per scroll page. */
const PAGE_SIZE = 30;

/** An image asset as offered by the picker. */
export interface MediaPickerImage {
  id: string;
  /** Full original CloudFront URL (what Insert returns). */
  url: string;
  /** Tile preview (250×250 twin when available). */
  preview: string;
  name: string;
  dim: string | null;
  folder: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
}

function isImage(a: ApiMediaAsset): boolean {
  if (a.contentType) return a.contentType.startsWith('image/');
  return /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(a.name);
}

/**
 * Modal that lists every image in the workspace media library and lets the
 * user pick one: click selects (one at a time), Insert confirms. Used by the
 * email builder's "Browse gallery" button; the caller decides what inserting
 * does (e.g. set the selected block's image). Escape handling is the
 * caller's: it owns what Esc means while it's open.
 */
export default function MediaPickerModal({
  onPick,
  onClose,
}: {
  onPick: (img: MediaPickerImage) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<'loading' | 'error' | 'ready'>('loading');
  const [images, setImages] = useState<MediaPickerImage[]>([]);
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<MediaFolder>('All files');
  const [tagSel, setTagSel] = useState<Set<string>>(new Set());
  const [orientSel, setOrientSel] = useState<Set<string>>(new Set());
  const [ratioSel, setRatioSel] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState<'orientation' | 'ratio' | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const bodyRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: ApiMediaAsset[] }>('media');
        if (!alive) return;
        const imgs = (res.data ?? [])
          .filter(isImage)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .map((a): MediaPickerImage => ({
            id: a.id,
            url: a.url,
            preview: a.thumbUrl?.trim() || a.url,
            name: a.name,
            dim: a.width && a.height ? `${a.width} × ${a.height}` : null,
            folder: a.folder?.trim() || null,
            tags: a.tags ?? [],
            width: a.width && a.width > 0 ? a.width : null,
            height: a.height && a.height > 0 ? a.height : null,
          }));
        setImages(imgs);
        setState('ready');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const folderOfImg = (img: MediaPickerImage) =>
    libraryFolderOf({ folder: img.folder, type: 'JPEG' });

  const folderCounts = useMemo(() => {
    const c: Record<string, number> = { 'All files': images.length };
    for (const img of images) {
      const f = folderOfImg(img);
      c[f] = (c[f] ?? 0) + 1;
    }
    return c;
  }, [images]);

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

  const tagUniverse = useMemo(() => {
    const freq = new Map<string, number>();
    for (const img of images) {
      for (const t of img.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
    }
    return [...freq.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [images]);

  const resetVisible = () => setVisibleCount(PAGE_SIZE);

  const toggleSet =
    (setter: typeof setOrientSel) =>
    (v: string) => {
      setter((prev) => {
        const next = new Set(prev);
        if (next.has(v)) next.delete(v);
        else next.add(v);
        return next;
      });
      resetVisible();
    };

  const toggleTag = (t: string) => {
    setTagSel((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    resetVisible();
  };

  const filtered = useMemo(() => {
    const q = query.trim();
    return images.filter((img) => {
      if (q && !anyMatchesSearchQuery([img.name, folderOfImg(img), ...img.tags], q)) {
        return false;
      }
      if (folder !== 'All files' && folderOfImg(img) !== folder) return false;
      if (tagSel.size > 0 && !img.tags.some((t) => tagSel.has(t))) return false;
      if (orientSel.size > 0 || ratioSel.size > 0) {
        const size = mediaSize({
          width: img.width,
          height: img.height,
          dim: img.dim ?? undefined,
        });
        if (!size) return false;
        if (!matchesOrientation(size.width, size.height, orientSel)) return false;
        if (!matchesAspectRatio(size.width, size.height, ratioSel)) return false;
      }
      return true;
    });
  }, [images, query, folder, tagSel, orientSel, ratioSel]);

  // Reset the lazy window whenever filters change the result set.
  const filterKey = `${query}\0${folder}\0${[...tagSel].sort().join(',')}\0${[...orientSel].sort().join(',')}\0${[...ratioSel].sort().join(',')}`;
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [filterKey]);

  const shown = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  // Load the next page when the sentinel enters the scroll container.
  useEffect(() => {
    const root = bodyRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !hasMore) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((n) => Math.min(n + PAGE_SIZE, filtered.length));
        }
      },
      { root, rootMargin: '120px', threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [hasMore, filtered.length, shown.length]);

  const chips = [
    ...(folder !== 'All files'
      ? [
          {
            key: `folder:${folder}`,
            label: `Folder: ${folderLabel(folder)}`,
            onRemove: () => {
              setFolder('All files');
              resetVisible();
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
    resetVisible();
  };

  const selected = selectedId ? (images.find((i) => i.id === selectedId) ?? null) : null;
  const hasFilters =
    query.trim() !== '' ||
    folder !== 'All files' ||
    tagSel.size > 0 ||
    orientSel.size > 0 ||
    ratioSel.size > 0;

  const insert = () => {
    if (selected) onPick(selected);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Choose an image from your media library"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.head}>
          <span className={styles.title}>Media library</span>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>

        {state === 'ready' && images.length > 0 && (
          <div className={styles.toolbar}>
            <div className={styles.toolbarRow}>
              <label className={styles.search}>
                <Icon name="search" size={14} className={styles.searchIc} />
                <input
                  autoFocus
                  type="search"
                  placeholder="Search images…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetVisible();
                  }}
                  aria-label="Search images"
                />
              </label>

              <FolderFilter
                options={folderOptions}
                value={folder === 'All files' ? null : folder}
                onChange={(key) => {
                  setFolder((key ?? 'All files') as MediaFolder);
                  resetVisible();
                }}
              />

              <TagFilter
                tags={tagUniverse}
                selected={tagSel}
                onToggle={toggleTag}
                onClear={() => {
                  setTagSel(new Set());
                  resetVisible();
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
                  resetVisible();
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
                  resetVisible();
                }}
                open={filterOpen === 'ratio'}
                onOpenToggle={() => setFilterOpen((v) => (v === 'ratio' ? null : 'ratio'))}
              />
            </div>

            <FilterChipsRow chips={chips} onClearAll={clearChips} />
          </div>
        )}

        <div className={styles.body} ref={bodyRef}>
          {state === 'loading' && <div className={styles.msg}>Loading your media…</div>}
          {state === 'error' && <div className={styles.msg}>Couldn’t load the media library.</div>}
          {state === 'ready' && images.length === 0 && (
            <div className={styles.msg}>
              No images in your media library yet. Upload some on the Media page, then pick them
              here.
            </div>
          )}
          {state === 'ready' && images.length > 0 && filtered.length === 0 && (
            <div className={styles.msg}>
              {hasFilters
                ? 'No images match your filters.'
                : 'No images match your search.'}
            </div>
          )}
          {shown.length > 0 && (
            <>
              <div className={styles.grid}>
                {shown.map((img) => {
                  const isSelected = img.id === selectedId;
                  return (
                    <button
                      key={img.id}
                      type="button"
                      className={`${styles.tile} ${isSelected ? styles.tileSelected : ''}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(isSelected ? null : img.id)}
                      onDoubleClick={() => onPick(img)}
                      title={img.name}
                    >
                      <span className={styles.thumb}>
                        <img src={img.preview} alt="" loading="lazy" />
                        {isSelected && (
                          <span className={styles.check} aria-hidden="true">
                            <Icon name="check" size={12} stroke={3} />
                          </span>
                        )}
                      </span>
                      <span className={styles.name}>{img.name}</span>
                      {img.dim && <span className={styles.dim}>{img.dim}</span>}
                    </button>
                  );
                })}
              </div>
              {hasMore && (
                <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
              )}
              <p className={styles.pageMeta} aria-live="polite">
                Showing {shown.length} of {filtered.length}
              </p>
            </>
          )}
        </div>

        <div className={styles.foot}>
          <button type="button" className="sbtn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`pbtn ${styles.insert}`}
            onClick={insert}
            disabled={!selected}
          >
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}
