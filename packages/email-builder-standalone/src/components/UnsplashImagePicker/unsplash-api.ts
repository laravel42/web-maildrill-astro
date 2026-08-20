/**
 * Frontend API helpers for the Unsplash picker.
 *
 * All calls go through the `@eb/backend` proxy — the frontend never has
 * direct knowledge of the `UNSPLASH_API_KEY`. The types here mirror the DTO
 * returned by `packages/backend/src/unsplash/dto.ts`.
 */

export interface UnsplashPhoto {
  id: string;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  blurHash: string | null;
  width: number;
  height: number;
  color: string | null;
  description: string | null;
  alt: string;
  /** Pre-computed "Photo by X on Unsplash" — used as the block's alt text. */
  attribution: string;
  user: {
    name: string;
    username: string;
    /** Photographer profile URL with UTMs already appended (API Terms §9). */
    profileUrl: string;
  };
  links: {
    html: string;
    /**
     * Opaque API URL that must be pinged via `trackDownload` when the user
     * actually inserts a photo (API Terms §6).
     */
    downloadLocation: string;
  };
  /** Unsplash homepage URL with UTMs — used for the "on Unsplash" credit link. */
  unsplashUrl: string;
  /** Registered app name slug from the backend. */
  appName: string;
}

export interface UnsplashSearchResponse {
  total: number;
  totalPages: number;
  results: UnsplashPhoto[];
  rateLimitRemaining: number | null;
}

export type SearchErrorKind =
  'rate_limited' | 'not_configured' | 'unauthorized' | 'network' | 'invalid_request' | 'unknown';

export class UnsplashSearchError extends Error {
  constructor(
    public readonly kind: SearchErrorKind,
    message?: string,
  ) {
    super(message ?? kind);
    this.name = 'UnsplashSearchError';
  }
}

export interface SearchParams {
  query: string;
  page?: number;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  signal?: AbortSignal;
}

/**
 * Resolves the backend base URL. Priority:
 *   1. Explicit `backendUrl` argument (picker prop).
 *   2. `window.__emailBuilderUnsplashBackendUrl` (set by `EmailBuilder` prop).
 *   3. Vite env var `VITE_AI_BACKEND_URL`.
 *   4. Localhost fallback for `pnpm dev`.
 */
export function resolveBackendUrl(backendUrl?: string): string {
  const fromArg = backendUrl?.replace(/\/+$/, '');
  if (fromArg) return fromArg;
  const fromWindow =
    typeof window !== 'undefined'
      ? ((window as unknown as { __emailBuilderUnsplashBackendUrl?: string })
          .__emailBuilderUnsplashBackendUrl ?? undefined)
      : undefined;
  const fromWindowClean = fromWindow?.replace(/\/+$/, '');
  if (fromWindowClean) return fromWindowClean;
  const fromEnv = (import.meta.env.VITE_AI_BACKEND_URL as string | undefined)?.replace(/\/+$/, '');
  return fromEnv ?? 'http://localhost:3003';
}

/** Map an HTTP response to a typed `UnsplashSearchError` for 4xx/5xx responses. */
async function errorFromResponse(response: Response): Promise<UnsplashSearchError> {
  if (response.status === 429) return new UnsplashSearchError('rate_limited');
  if (response.status === 503) {
    // Backend returns this when UNSPLASH_API_KEY is missing.
    return new UnsplashSearchError('not_configured');
  }
  if (response.status === 401 || response.status === 403) {
    return new UnsplashSearchError('unauthorized');
  }
  if (response.status === 400) return new UnsplashSearchError('invalid_request');
  return new UnsplashSearchError('unknown', `Status ${response.status}`);
}

export async function searchUnsplash(
  backendUrl: string,
  params: SearchParams,
): Promise<UnsplashSearchResponse> {
  const url = new URL(`${backendUrl}/api/images/search`);
  url.searchParams.set('query', params.query);
  url.searchParams.set('page', String(params.page ?? 1));
  url.searchParams.set('per_page', String(params.perPage ?? 20));
  if (params.orientation) url.searchParams.set('orientation', params.orientation);

  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', signal: params.signal });
  } catch (err) {
    // Abort is re-thrown so callers can differentiate it from actual errors.
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new UnsplashSearchError('network', (err as Error)?.message);
  }

  if (!response.ok) throw await errorFromResponse(response);

  return (await response.json()) as UnsplashSearchResponse;
}

/**
 * Fire-and-forget download tracking.
 *
 * Required by API Terms §6 each time the user actually inserts a photo.
 * Swallows all errors — the picker must never block the UI on this call.
 */
export function trackUnsplashDownload(backendUrl: string, downloadLocation: string): void {
  // Using `keepalive: true` so the ping survives tab close or immediate
  // component unmount after the insertion.
  void fetch(`${backendUrl}/api/images/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ downloadLocation }),
    keepalive: true,
  }).catch(() => undefined);
}

/**
 * Builds an email-optimised URL from a photo. Uses the `raw` endpoint so we
 * can pin dimensions/quality explicitly — `urls.regular` is also fine but
 * 1200px is a better fit for retina email heroes than the default 1080px.
 */
export function buildEmailImageUrl(photo: UnsplashPhoto): string {
  const base = photo.urls.raw;
  // `auto=format` lets Unsplash serve WebP to supporting clients while
  // falling back to JPEG in Outlook / Gmail iOS / etc.
  return `${base}&w=1200&auto=format&q=80&fit=max`;
}
