import * as React from 'react';
import { Camera, Loader2, Search, UploadCloud, X } from 'lucide-react';

import { Input } from '@/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs';

/*
 * Image picker for media headers — same UX as the email editor's image
 * inspector: current-image preview with Unsplash credit, a "Stock image" tab
 * (search + orientation filter + credited grid + load more, Powered by
 * Unsplash) and an "Upload" tab that stores the file in the workspace media
 * library so Meta gets a public CDN URL (blob: URLs fail submission).
 *
 * All requests ride the same-origin BFF: /api/images/* (Unsplash proxy) and
 * /api/v1/media* (uploads). Unsplash API Terms: credits + UTMs per tile (§9),
 * download ping on insert (§6), visible "Powered by Unsplash" (§10).
 */

const SEARCH_DEBOUNCE_MS = 350;
const PER_PAGE = 20;
const UTM = '?utm_source=Maildrill&utm_medium=referral';

type Orientation = 'any' | 'landscape' | 'portrait' | 'squarish';
const ORIENTATIONS: ReadonlyArray<{ key: Orientation; label: string }> = [
  { key: 'any', label: 'Any' },
  { key: 'landscape', label: 'Landscape' },
  { key: 'portrait', label: 'Portrait' },
  { key: 'squarish', label: 'Square' },
];

export type ImageCredit = { name: string; profileUrl: string; unsplashUrl: string };

export type ImageValue = { url: string; fileName?: string; credit?: ImageCredit };

type Photo = {
  id: string;
  urls: { raw: string; thumb: string };
  alt: string;
  attribution: string;
  color: string | null;
  user: { name: string; profileUrl: string };
  unsplashUrl: string;
  links: { downloadLocation: string };
};

type SearchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'results'; photos: Photo[]; page: number; totalPages: number };

function searchErrorMessage(status: number): string {
  if (status === 503) return 'Unsplash is not configured on the backend.';
  if (status === 429) return 'Unsplash rate limit reached — try again in a bit.';
  return 'Image search failed — try again.';
}

/** Same sizing recipe as the email picker: WebP-capable, 1200px, capped. */
function pickedUrl(photo: Photo): string {
  return `${photo.urls.raw}&w=1200&auto=format&q=80&fit=max`;
}

export function ImagePicker({
  value,
  onChange,
}: {
  value: ImageValue;
  onChange: (next: ImageValue) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [orientation, setOrientation] = React.useState<Orientation>('any');
  const [state, setState] = React.useState<SearchState>({ kind: 'idle' });
  const [loadingMore, setLoadingMore] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  const runSearch = React.useCallback(
    async (q: string, o: Orientation, page: number, prev: Photo[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (page === 1) setState({ kind: 'loading' });
      else setLoadingMore(true);
      try {
        const url = new URL('/api/images/search', window.location.origin);
        url.searchParams.set('query', q);
        url.searchParams.set('page', String(page));
        url.searchParams.set('per_page', String(PER_PAGE));
        if (o !== 'any') url.searchParams.set('orientation', o);
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) {
          setState({ kind: 'error', message: searchErrorMessage(res.status) });
          return;
        }
        const json = (await res.json()) as { totalPages: number; results: Photo[] };
        setState({
          kind: 'results',
          photos: page === 1 ? json.results : [...prev, ...json.results],
          page,
          totalPages: json.totalPages,
        });
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;
        setState({ kind: 'error', message: 'Image search failed — check your connection.' });
      } finally {
        if (abortRef.current === controller) {
          abortRef.current = null;
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  React.useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      abortRef.current?.abort();
      setState({ kind: 'idle' });
      return;
    }
    const handle = window.setTimeout(
      () => void runSearch(trimmed, orientation, 1, []),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(handle);
  }, [query, orientation, runSearch]);

  React.useEffect(() => () => abortRef.current?.abort(), []);

  const pick = (photo: Photo) => {
    onChange({
      url: pickedUrl(photo),
      credit: {
        name: photo.user.name,
        profileUrl: photo.user.profileUrl,
        unsplashUrl: photo.unsplashUrl,
      },
    });
    // API Terms §6 — fire-and-forget download ping on actual insertion.
    void fetch('/api/images/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ downloadLocation: photo.links.downloadLocation }),
      keepalive: true,
    }).catch(() => undefined);
  };

  /* -------------------------------- upload -------------------------------- */
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const uploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const ticketRes = await fetch('/api/v1/media/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type, sizeBytes: file.size }),
      });
      if (!ticketRes.ok) {
        throw new Error(
          ticketRes.status === 401
            ? 'Sign in to a workspace to upload images.'
            : 'Could not start the upload.',
        );
      }
      const ticket = (await ticketRes.json()) as { storageKey: string; uploadUrl: string };
      // Straight to S3 — the bytes never pass through our server.
      const put = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status}).`);
      const assetRes = await fetch('/api/v1/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storageKey: ticket.storageKey,
          name: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!assetRes.ok) throw new Error('Could not register the upload.');
      const asset = (await assetRes.json()) as { url: string };
      onChange({ url: asset.url, fileName: file.name });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const showResults = state.kind === 'results' && state.photos.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {value.url && (
        <div className="wts-imgpick-preview">
          <img src={value.url} alt="" />
          <button
            type="button"
            aria-label="Remove image"
            className="wts-imgpick-remove"
            onClick={() => onChange({ url: '' })}
          >
            <X className="size-4" />
          </button>
          {value.credit && (
            <span className="wts-imgpick-previewcredit">
              <Camera className="size-3.5" />
              <span>
                Photo by{' '}
                <a href={value.credit.profileUrl} target="_blank" rel="noreferrer noopener">
                  {value.credit.name}
                </a>{' '}
                on{' '}
                <a href={value.credit.unsplashUrl} target="_blank" rel="noreferrer noopener">
                  Unsplash
                </a>
              </span>
            </span>
          )}
        </div>
      )}

      <Tabs defaultValue="stock">
        <TabsList className="w-full">
          <TabsTrigger value="stock" className="flex-1">
            Stock image
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stock" className="flex flex-col gap-2.5">
          <div className="wts-imgpick-search">
            <Search className="size-4" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search free photos…"
              aria-label="Search stock images"
            />
          </div>

          <div className="wts-imgpick-orients" role="group" aria-label="Orientation">
            {ORIENTATIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                className="wts-imgpick-orient"
                aria-pressed={orientation === o.key}
                onClick={() => setOrientation(o.key)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {state.kind === 'loading' && (
            <div className="wts-imgpick-note">
              <Loader2 className="size-4 animate-spin" /> Searching…
            </div>
          )}
          {state.kind === 'error' && (
            <p className="wts-imgpick-error" role="alert">
              {state.message}
            </p>
          )}
          {state.kind === 'idle' && (
            <p className="wts-imgpick-note">Search Unsplash for a free hero photo.</p>
          )}
          {state.kind === 'results' && state.photos.length === 0 && (
            <p className="wts-imgpick-note">No results for “{query.trim()}”.</p>
          )}

          {showResults && (
            <div className="wts-imgpick-grid">
              {state.photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="wts-imgpick-tile"
                  style={photo.color ? { background: photo.color } : undefined}
                >
                  <button
                    type="button"
                    title={photo.attribution}
                    onClick={() => pick(photo)}
                    aria-label={`Use photo by ${photo.user.name}`}
                  >
                    <img src={photo.urls.thumb} alt={photo.alt} loading="lazy" />
                  </button>
                  <figcaption>
                    Photo by{' '}
                    <a
                      href={photo.user.profileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {photo.user.name}
                    </a>{' '}
                    on{' '}
                    <a
                      href={photo.unsplashUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Unsplash
                    </a>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {state.kind === 'results' && state.page < state.totalPages && (
            <button
              type="button"
              className="wts-imgpick-more"
              disabled={loadingMore}
              onClick={() =>
                void runSearch(query.trim(), orientation, state.page + 1, state.photos)
              }
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}

          {/* §10 — keep the Unsplash mark visible. */}
          <p className="wts-imgpick-powered">
            Powered by{' '}
            <a href={`https://unsplash.com/${UTM}`} target="_blank" rel="noreferrer noopener">
              Unsplash
            </a>
          </p>
        </TabsContent>

        <TabsContent value="upload" className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="Upload image"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              void uploadFile(e.dataTransfer.files[0]);
            }}
            className={`flex h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-dashed text-xs text-muted-foreground transition-colors ${
              dragOver
                ? 'border-primary bg-primary/5 text-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <UploadCloud className="size-5" />
            )}
            {uploading ? 'Uploading…' : 'Drop an image or click to upload'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void uploadFile(file);
            }}
          />
          {uploadError && (
            <p className="wts-imgpick-error" role="alert">
              {uploadError}
            </p>
          )}
          <p className="wts-imgpick-note">
            Uploads land in your media library and use its public CDN URL — required for Meta
            review.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
