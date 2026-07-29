import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/app/api';
import type { ApiMediaAsset } from '@/lib/app/media-map';
import Icon from '../Icon';
import styles from './MediaPickerModal.module.css';

/** An image asset as offered by the picker. */
export interface MediaPickerImage {
  id: string;
  /** Public CloudFront URL. */
  url: string;
  name: string;
  dim: string | null;
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
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await api.get<{ data: ApiMediaAsset[] }>('media');
        if (!alive) return;
        const imgs = (res.data ?? [])
          .filter(isImage)
          .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
          .map((a) => ({
            id: a.id,
            url: a.url,
            name: a.name,
            dim: a.width && a.height ? `${a.width} × ${a.height}` : null,
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? images.filter((i) => i.name.toLowerCase().includes(q)) : images;
  }, [images, query]);

  const selected = selectedId ? (images.find((i) => i.id === selectedId) ?? null) : null;

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
          <div className={styles.searchRow}>
            <Icon name="search" size={14} className={styles.searchIcon} />
            <input
              autoFocus
              className={styles.search}
              type="search"
              placeholder="Search images…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        )}

        <div className={styles.body}>
          {state === 'loading' && <div className={styles.msg}>Loading your media…</div>}
          {state === 'error' && <div className={styles.msg}>Couldn’t load the media library.</div>}
          {state === 'ready' && images.length === 0 && (
            <div className={styles.msg}>
              No images in your media library yet. Upload some on the Media page, then pick them
              here.
            </div>
          )}
          {state === 'ready' && images.length > 0 && shown.length === 0 && (
            <div className={styles.msg}>No images match “{query}”.</div>
          )}
          {shown.length > 0 && (
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
                      <img src={img.url} alt="" loading="lazy" />
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
