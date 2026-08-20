import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Opaque, signed keyset cursors.
 *
 * Pagination is keyset, not OFFSET: a page is located by the sort key of the
 * last row seen, so cost is constant with depth instead of growing with it.
 * The cursor carries that key.
 *
 * It is signed, not merely encoded, for two reasons: the payload names a tenant
 * (so a forged cursor must never be able to page into another workspace), and
 * the query shape it belongs to is bound in, so a cursor from one sort or
 * filter cannot be replayed against another and silently return nonsense.
 */
export interface KeysetCursor {
  /** ISO timestamp of the last row on the previous page. */
  at: string;
  /** Tiebreaker — rows can share a timestamp. */
  id: string;
  /** Tenant the cursor was issued for. */
  t: string;
  /** Hash of the query shape (sort + filters) the cursor belongs to. */
  s: string;
}

export class CursorError extends Error {
  readonly statusCode = 400;
  constructor(message = 'invalid_cursor') {
    super(message);
  }
}

/**
 * Errors that are the caller's fault and whose message is safe to echo.
 *
 * App error handlers collapse everything unrecognised into `internal_error` —
 * correct for a bug, useless for a bad cursor, where the client needs to know
 * the token is the problem and not retry it. Recognising them here keeps every
 * app's handler agreeing on the mapping instead of each hard-coding it.
 */
export function asClientError(err: unknown): { statusCode: number; error: string } | null {
  if (err instanceof CursorError) return { statusCode: err.statusCode, error: err.message };
  return null;
}

const key = (secret: string) =>
  createHmac('sha256', secret).update('maildrill:cursor:v1').digest();

const b64url = (b: Buffer) => b.toString('base64url');

/** Stable fingerprint of everything that must not change mid-pagination. */
export function shapeOf(parts: Record<string, string | undefined>): string {
  const canonical = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${parts[k] ?? ''}`)
    .join('&');
  return createHmac('sha256', 'shape').update(canonical).digest('base64url').slice(0, 12);
}

export function encodeCursor(secret: string, c: KeysetCursor): string {
  const payload = b64url(Buffer.from(JSON.stringify(c), 'utf8'));
  const sig = b64url(createHmac('sha256', key(secret)).update(payload).digest());
  return `${payload}.${sig}`;
}

/**
 * Decode and verify. Throws `CursorError` (400) on anything malformed, forged,
 * or belonging to another tenant or query shape — never a database error.
 */
export function decodeCursor(
  secret: string,
  token: string,
  expect: { tenantId: string; shape: string },
): KeysetCursor {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) throw new CursorError();
  const expected = b64url(createHmac('sha256', key(secret)).update(payload).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new CursorError();

  let parsed: KeysetCursor;
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as KeysetCursor;
  } catch {
    throw new CursorError();
  }
  if (!parsed?.at || !parsed?.id || !parsed?.t || !parsed?.s) throw new CursorError();
  if (Number.isNaN(Date.parse(parsed.at))) throw new CursorError();
  // Tenant isolation beats convenience: a cursor is only ever valid for the
  // workspace it was issued to.
  if (parsed.t !== expect.tenantId) throw new CursorError('cursor_tenant_mismatch');
  if (parsed.s !== expect.shape) throw new CursorError('cursor_shape_mismatch');
  return parsed;
}

/** Page size policy shared by every cursor endpoint. */
export const PAGE = { default: 10, min: 1, max: 100 } as const;

export function clampLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return PAGE.default;
  return Math.min(Math.max(Math.floor(n), PAGE.min), PAGE.max);
}

/**
 * Rows to ask the database for when serving a page of `limit`.
 *
 * One extra: whether another page exists is then answered by whether that row
 * came back, rather than by a second query or a COUNT the caller never asked
 * for. The probe row is never returned — see `toCursorPage`.
 */
export function overFetch(limit: number): number {
  return limit + 1;
}

/** The response body every cursor-paginated endpoint returns. */
export interface CursorPage<T> {
  items: T[];
  /** Token for the following page, or null once the end is reached. */
  next_cursor: string | null;
  has_more: boolean;
  /**
   * Present only when the caller explicitly asked for it: a total is a COUNT
   * over the whole filtered set, which is exactly the cost keyset paging
   * exists to avoid paying on every page.
   */
  total?: number;
}

/**
 * Turn an over-fetched result into a page.
 *
 * `rows` is what `overFetch(limit)` returned, in sort order. `cursorFor` is
 * called only for the last row actually served, so the token always points at
 * a row the client has seen — the next page resumes strictly after it, with no
 * gap and no repeat.
 */
export function toCursorPage<T>(
  rows: T[],
  limit: number,
  cursorFor: (row: T) => string,
): CursorPage<T> {
  const has_more = rows.length > limit;
  const items = has_more ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    next_cursor: has_more && last !== undefined ? cursorFor(last) : null,
    has_more,
  };
}
