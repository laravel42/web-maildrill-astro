/**
 * Browser-side Landings client and view models.
 *
 * A "landing" is one whole Builder42 site (`BuilderSite`: `pages`, `pageOrder`,
 * `homePageId`), not a single page — so one row carries one site document and
 * the list shows how many pages it holds. Every call goes through the
 * same-origin BFF (`/api/v1/*`), which mints the tenant-scoped token; the
 * browser never names a workspace. See `src/lib/app/api.ts`.
 *
 * Publishing is deliberately not wired yet (see
 * `docs/landing-pages-builder-integration.md`): the two publish verbs exist
 * here so the UI can render their affordances disabled instead of hiding a
 * concept the model already has, and the backend answers them with
 * `not_implemented` until that phase lands.
 */
import { api } from './api';

/**
 * `stale` = published, then edited: `updatedAt > publishedAt`. It is not a
 * stored column — see `landingStatus` — because the source of truth is the two
 * timestamps, and a stored copy would drift on every save.
 */
export type LandingStatus = 'draft' | 'published' | 'stale';

/**
 * List-row shape. Deliberately excludes the site document: a `BuilderSite` with
 * inline images is measured in megabytes, so listing rows must never carry it
 * (`pageCount`/`documentBytes` are denormalised on write for exactly that
 * reason).
 */
export interface LandingSummary {
  id: string;
  name: string;
  /** Publish slug (`BuilderSite.meta.siteId`), null until first published. */
  siteId: string | null;
  /** Public URL of the last successful publish, null until then. */
  publishedUrl: string | null;
  publishedAt: string | null;
  /** `pageOrder.length` of the stored document. */
  pageCount: number;
  /** Serialised size of the document in bytes. */
  documentBytes: number;
  createdAt: string;
  updatedAt: string;
}

/** Single landing, document included — only ever fetched one at a time. */
export interface LandingDetail extends LandingSummary {
  /** The `BuilderSite` JSON, opaque to this host (the editor owns its shape). */
  document: Record<string, unknown> | null;
  schemaVersion: number | null;
}

export interface LandingListParams {
  q?: string;
  status?: LandingStatus;
  limit?: number;
  offset?: number;
  sort?: 'name' | 'updatedAt' | 'createdAt' | 'publishedAt';
  dir?: 'asc' | 'desc';
}

function queryString(params: LandingListParams): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export const landingsApi = {
  list: (params: LandingListParams = {}) =>
    api.get<{ items: LandingSummary[]; total: number }>(`landings${queryString(params)}`),
  get: (id: string) => api.get<LandingDetail>(`landings/${id}`),
  create: (body: { name: string; document?: unknown; schemaVersion?: number }) =>
    api.post<LandingDetail>('landings', body),
  /** Rename, or persist a new document revision (the editor's Save). */
  update: (
    id: string,
    body: { name?: string; document?: unknown; schemaVersion?: number; siteId?: string },
  ) => api.patch<LandingDetail>(`landings/${id}`, body),
  duplicate: (id: string) => api.post<LandingDetail>(`landings/${id}/duplicate`),
  remove: (id: string) => api.del(`landings/${id}`),
  // --- reserved until the publishing phase; answer `not_implemented` today ---
  publish: (id: string, body: { siteId?: string } = {}) =>
    api.post<LandingDetail>(`landings/${id}/publish`, body),
  unpublish: (id: string) => api.del<LandingDetail>(`landings/${id}/publish`),
};

// --- presentation helpers ------------------------------------------------------------

export const LANDING_STATUS_LABEL: Record<LandingStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  stale: 'Unpublished changes',
};

export const LANDING_STATUS_FILTERS: { value: LandingStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'published', label: 'Published' },
  { value: 'stale', label: 'Needs republish' },
];

/** Derived, never stored: a landing is stale when it was edited after publishing. */
export function landingStatus(row: {
  publishedAt: string | null;
  updatedAt: string;
}): LandingStatus {
  if (!row.publishedAt) return 'draft';
  return Date.parse(row.updatedAt) > Date.parse(row.publishedAt) ? 'stale' : 'published';
}

/** Maps onto the workspace's shared `.astatus--*` chips so nothing new is invented. */
export function landingStatusChipClass(status: LandingStatus): string {
  switch (status) {
    case 'published':
      return 'astatus--active';
    // Amber: the live site no longer matches the editor, which is a "do
    // something" state, not a failure.
    case 'stale':
      return 'astatus--sending';
    default:
      return 'astatus--draft';
  }
}

/**
 * Builder42's own publish preflight warns above this size (`checkPublishSize`
 * in the vendored `services/apiClient.ts`), because images picked from Unsplash
 * or uploaded are inlined into the document as data URLs. Surfacing it in the
 * list turns a future publish-time failure into something visible while editing.
 */
export const LANDING_SIZE_WARNING_BYTES = 9 * 1024 * 1024;

/** `812 KB` / `1.4 MB` — the list's size column. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
