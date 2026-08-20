import type { UnsplashPhotoDTO, UnsplashSearchResponseDTO } from './dto';

const UNSPLASH_API_BASE = 'https://api.unsplash.com';
const DEFAULT_APP_NAME = 'email-builder-online';
const REQUEST_TIMEOUT_MS = 10_000;

/** Narrow shape of the upstream photo payload we actually care about. */
interface UpstreamPhoto {
  id: string;
  width: number;
  height: number;
  color: string | null;
  blur_hash: string | null;
  description: string | null;
  alt_description: string | null;
  urls: {
    raw: string;
    full: string;
    regular: string;
    small: string;
    thumb: string;
  };
  links: {
    html: string;
    download: string;
    download_location: string;
  };
  user: {
    name: string;
    username: string;
    links: {
      html: string;
    };
  };
}

interface UpstreamSearchResponse {
  total: number;
  total_pages: number;
  results: UpstreamPhoto[];
}

export class UnsplashConfigError extends Error {
  constructor() {
    super('UNSPLASH_API_KEY is not configured');
    this.name = 'UnsplashConfigError';
  }
}

export class UnsplashUpstreamError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'UnsplashUpstreamError';
  }
}

export interface UnsplashClientOptions {
  /** Defaults to `UNSPLASH_API_KEY` env var. */
  apiKey?: string;
  /** Defaults to `UNSPLASH_APP_NAME` env var, then `'email-builder-online'`. */
  appName?: string;
  /** Defaults to `https://api.unsplash.com`. */
  baseUrl?: string;
}

export interface SearchPhotosParams {
  query: string;
  page?: number;
  perPage?: number;
  orientation?: 'landscape' | 'portrait' | 'squarish';
  color?:
    | 'black_and_white'
    | 'black'
    | 'white'
    | 'yellow'
    | 'orange'
    | 'red'
    | 'purple'
    | 'magenta'
    | 'green'
    | 'teal'
    | 'blue';
  /** Defaults to `'high'` — safest choice for business email content. */
  contentFilter?: 'low' | 'high';
}

export interface UnsplashClient {
  searchPhotos(params: SearchPhotosParams): Promise<UnsplashSearchResponseDTO>;
  /**
   * Fires the `GET download_location` ping required by API Terms §6. Returns
   * `true` on success; returns `false` on any failure — this is fire-and-forget
   * from the caller's point of view and must never block the UI.
   */
  trackDownload(downloadLocation: string): Promise<boolean>;
}

/**
 * Creates an Unsplash client backed by `fetch`. Uses public (Client-ID) auth
 * since none of our endpoints require user-scoped actions.
 *
 * Env resolution happens at construction time, so callers that need to react
 * to a runtime key change (tests, credential rotation) should rebuild the
 * client rather than mutating env vars on the fly.
 */
export function createUnsplashClient(options: UnsplashClientOptions = {}): UnsplashClient {
  const apiKey = options.apiKey ?? process.env.UNSPLASH_API_KEY ?? '';
  const appName = options.appName ?? process.env.UNSPLASH_APP_NAME ?? DEFAULT_APP_NAME;
  const baseUrl = (options.baseUrl ?? UNSPLASH_API_BASE).replace(/\/+$/, '');

  function requireKey(): void {
    if (!apiKey) throw new UnsplashConfigError();
  }

  const utmSuffix = `utm_source=${encodeURIComponent(appName)}&utm_medium=referral`;

  /** Append the required UTMs to an unsplash.com URL without clobbering existing params. */
  function withUtm(url: string): string {
    if (!url) return url;
    return url.includes('?') ? `${url}&${utmSuffix}` : `${url}?${utmSuffix}`;
  }

  function toDto(photo: UpstreamPhoto): UnsplashPhotoDTO {
    const photographerName = photo.user.name;
    const attribution = `Photo by ${photographerName} on Unsplash`;
    const altDescription = photo.alt_description?.trim();
    const description = photo.description?.trim();

    return {
      id: photo.id,
      urls: photo.urls,
      blurHash: photo.blur_hash,
      width: photo.width,
      height: photo.height,
      color: photo.color,
      description: description || null,
      // Fall back gracefully so we never emit empty alt text for a photo
      // selected into the editor.
      alt: altDescription || description || attribution,
      attribution,
      user: {
        name: photographerName,
        username: photo.user.username,
        profileUrl: withUtm(photo.user.links.html),
      },
      links: {
        html: withUtm(photo.links.html),
        // `download_location` is a tracking endpoint under api.unsplash.com
        // and must NOT have UTMs appended — Unsplash validates it verbatim.
        downloadLocation: photo.links.download_location,
      },
      unsplashUrl: withUtm('https://unsplash.com/'),
      appName,
    };
  }

  async function searchPhotos(params: SearchPhotosParams): Promise<UnsplashSearchResponseDTO> {
    requireKey();

    const url = new URL(`${baseUrl}/search/photos`);
    url.searchParams.set('query', params.query);
    url.searchParams.set('page', String(params.page ?? 1));
    url.searchParams.set('per_page', String(params.perPage ?? 20));
    url.searchParams.set('content_filter', params.contentFilter ?? 'high');
    if (params.orientation) url.searchParams.set('orientation', params.orientation);
    if (params.color) url.searchParams.set('color', params.color);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Client-ID ${apiKey}`,
          'Accept-Version': 'v1',
          // App identification in the User-Agent helps Unsplash debug traffic
          // and also tags us correctly in their analytics.
          'User-Agent': `${appName}/unsplash-gallery`,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => undefined);
      throw new UnsplashUpstreamError(
        `Unsplash search failed with status ${response.status}`,
        response.status,
        body,
      );
    }

    const rateLimitHeader = response.headers.get('x-ratelimit-remaining');
    const rateLimitRemaining = rateLimitHeader ? Number(rateLimitHeader) : null;

    const payload = (await response.json()) as UpstreamSearchResponse;

    return {
      total: payload.total,
      totalPages: payload.total_pages,
      results: payload.results.map(toDto),
      rateLimitRemaining: Number.isFinite(rateLimitRemaining) ? rateLimitRemaining : null,
    };
  }

  async function trackDownload(downloadLocation: string): Promise<boolean> {
    requireKey();

    // SSRF hardening: the location MUST point to the Unsplash API. Frontends
    // submit this value opaquely, so a malicious or stale value could try to
    // turn our backend into an outbound-request relay otherwise.
    let parsed: URL;
    try {
      parsed = new URL(downloadLocation);
    } catch {
      return false;
    }
    if (parsed.host !== 'api.unsplash.com') return false;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(parsed, {
        method: 'GET',
        headers: {
          Authorization: `Client-ID ${apiKey}`,
          'Accept-Version': 'v1',
          'User-Agent': `${appName}/unsplash-gallery`,
        },
        signal: controller.signal,
      });
      // Unsplash returns 200 with `{ url: "..." }` on success; we don't read
      // the body — the ping itself is what counts.
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  }

  return { searchPhotos, trackDownload };
}
