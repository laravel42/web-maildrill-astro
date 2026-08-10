import { describe, expect, it, vi } from 'vitest';

import {
  isTransientImportError,
  retryDynamicImport,
} from '@/lib/app/retry-dynamic-import';

describe('isTransientImportError', () => {
  it('detects Vite outdated optimize dep failures', () => {
    expect(
      isTransientImportError(new Error('504 Outdated Optimize Dep: react-colorful')),
    ).toBe(true);
  });

  it('detects dynamic import fetch failures', () => {
    expect(
      isTransientImportError(
        new TypeError('Failed to fetch dynamically imported module: http://localhost:4321/...'),
      ),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(isTransientImportError(new Error('SyntaxError in module'))).toBe(false);
  });
});

describe('retryDynamicImport', () => {
  it('returns on first success', async () => {
    const fn = vi.fn(async () => ({ ok: true }));
    await expect(retryDynamicImport(fn, { attempts: 3, backoffMs: 1 })).resolves.toEqual({
      ok: true,
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures then succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('504 Outdated Optimize Dep: foo'))
      .mockResolvedValueOnce({ ok: true });
    await expect(retryDynamicImport(fn, { attempts: 3, backoffMs: 1 })).resolves.toEqual({
      ok: true,
    });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting attempts', async () => {
    const err = new Error('504 Outdated Optimize Dep: foo');
    const fn = vi.fn(async () => {
      throw err;
    });
    await expect(retryDynamicImport(fn, { attempts: 2, backoffMs: 1 })).rejects.toThrow(err);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
