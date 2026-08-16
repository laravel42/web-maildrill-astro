import { describe, expect, it } from 'vitest';
import {
  CursorError,
  PAGE,
  asClientError,
  clampLimit,
  decodeCursor,
  encodeCursor,
  overFetch,
  shapeOf,
  toCursorPage,
} from './cursor';

const SECRET = 'test-secret';
const TENANT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const shape = shapeOf({ status: 'active', sort: 'created', dir: 'desc' });
const expect_ = { tenantId: TENANT, shape };

const cursor = (over: Partial<Parameters<typeof encodeCursor>[1]> = {}) =>
  encodeCursor(SECRET, {
    at: '2026-08-16T11:44:57.561234Z',
    id: '33333333-3333-3333-3333-333333333333',
    t: TENANT,
    s: shape,
    ...over,
  });

describe('cursor round trip', () => {
  it('preserves the sort key, including sub-millisecond precision', () => {
    const back = decodeCursor(SECRET, cursor(), expect_);
    expect(back.at).toBe('2026-08-16T11:44:57.561234Z');
    expect(back.id).toBe('33333333-3333-3333-3333-333333333333');
  });

  it('rejects a tampered payload, a tampered signature, and a bare payload', () => {
    const token = cursor();
    const [payload, sig] = token.split('.');
    const flip = (s: string) => s.slice(0, -1) + (s.at(-1) === 'x' ? 'y' : 'x');
    expect(() => decodeCursor(SECRET, `${flip(payload!)}.${sig}`, expect_)).toThrow(CursorError);
    expect(() => decodeCursor(SECRET, `${payload}.${flip(sig!)}`, expect_)).toThrow(CursorError);
    expect(() => decodeCursor(SECRET, payload!, expect_)).toThrow(CursorError);
    expect(() => decodeCursor(SECRET, 'not-a-cursor', expect_)).toThrow(CursorError);
  });

  it('rejects a cursor signed with a different secret', () => {
    expect(() => decodeCursor('other-secret', cursor(), expect_)).toThrow(CursorError);
  });

  // Tenant isolation: a token minted for one workspace must never resume in another.
  it('rejects a cursor issued to another tenant', () => {
    expect(() => decodeCursor(SECRET, cursor({ t: OTHER }), expect_)).toThrow(
      'cursor_tenant_mismatch',
    );
    expect(() => decodeCursor(SECRET, cursor(), { tenantId: OTHER, shape })).toThrow(
      'cursor_tenant_mismatch',
    );
  });

  it('rejects a cursor replayed against a different query shape', () => {
    const moved = shapeOf({ status: 'active', sort: 'created', dir: 'asc' });
    expect(() => decodeCursor(SECRET, cursor(), { tenantId: TENANT, shape: moved })).toThrow(
      'cursor_shape_mismatch',
    );
  });

  it('fingerprints filters order-independently but value-sensitively', () => {
    expect(shapeOf({ a: '1', b: '2' })).toBe(shapeOf({ b: '2', a: '1' }));
    expect(shapeOf({ a: '1' })).not.toBe(shapeOf({ a: '2' }));
    // An absent filter and an empty one are the same query, and must agree.
    expect(shapeOf({ a: undefined })).toBe(shapeOf({ a: '' }));
  });

  it('maps to a 400 with a named error instead of a server fault', () => {
    expect(asClientError(new CursorError())).toEqual({ statusCode: 400, error: 'invalid_cursor' });
    expect(asClientError(new Error('boom'))).toBeNull();
  });
});

describe('page shaping', () => {
  const rows = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
  const key = (r: { id: string }) => `cursor-${r.id}`;

  it('drops the probe row and points the cursor at the last row served', () => {
    const page = toCursorPage(rows(overFetch(10)), 10, key);
    expect(page.items).toHaveLength(10);
    expect(page.has_more).toBe(true);
    // The 11th row was only ever a probe — the cursor names row 10.
    expect(page.next_cursor).toBe('cursor-9');
  });

  it('ends cleanly when the probe row does not come back', () => {
    const page = toCursorPage(rows(10), 10, key);
    expect(page.items).toHaveLength(10);
    expect(page.has_more).toBe(false);
    expect(page.next_cursor).toBeNull();
  });

  it('handles an empty result', () => {
    const page = toCursorPage([], 10, key);
    expect(page).toEqual({ items: [], next_cursor: null, has_more: false });
  });

  it('clamps limits instead of rejecting them', () => {
    expect(clampLimit(undefined)).toBe(PAGE.default);
    expect(clampLimit('abc')).toBe(PAGE.default);
    expect(clampLimit(0)).toBe(PAGE.min);
    expect(clampLimit(-5)).toBe(PAGE.min);
    expect(clampLimit(200)).toBe(PAGE.max);
    expect(clampLimit('25')).toBe(25);
  });
});
