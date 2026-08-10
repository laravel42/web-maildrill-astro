/** Errors that often clear after a short wait (Vite re-optimize, dev restart, redeploy). */
export function isTransientImportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('Outdated Optimize Dep') ||
    msg.includes('504') ||
    msg.includes('Loading chunk') ||
    msg.includes('ChunkLoadError')
  );
}

export type RetryDynamicImportOptions = {
  /** Total attempts (first try + retries). Default 3. */
  attempts?: number;
  /** Multiplier for backoff between attempts (ms × attempt index). Default 1500. */
  backoffMs?: number;
};

/** One-shot guard so the stale-chunk auto-reload can never loop. */
const RELOADED_KEY = 'md:import-heal-reload';

/**
 * Last resort for a chunk error that outlived every retry: the page's module
 * graph references hashes the server no longer has (dev re-optimize, fresh
 * deploy). Retrying the same import re-resolves the same stale URLs — only a
 * full page load picks up the server's current graph. Reload once per
 * session-guard; a second failure surfaces to the caller's error UI.
 */
function healWithReload(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(RELOADED_KEY)) return false;
    window.sessionStorage.setItem(RELOADED_KEY, '1');
  } catch {
    return false; // storage unavailable — don't risk a reload loop
  }
  window.location.reload();
  return true;
}

/**
 * Retry a dynamic `import()` before surfacing failure.
 *
 * Used for large lazy islands (email builder, WhatsApp studio) where Vite can
 * briefly 504 with "Outdated Optimize Dep" while re-optimizing mid-session.
 */
export async function retryDynamicImport<T>(
  importFn: () => Promise<T>,
  { attempts = 3, backoffMs = 1_500 }: RetryDynamicImportOptions = {},
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, attempt * backoffMs));
    try {
      const mod = await importFn();
      try {
        window.sessionStorage.removeItem(RELOADED_KEY);
      } catch {
        // best-effort — a healthy import re-arms the heal guard
      }
      return mod;
    } catch (err) {
      lastErr = err;
      const transient = isTransientImportError(err);
      if (!transient && attempt < attempts - 1) {
        // Unknown error — one retry still helps with flaky dev networks.
        continue;
      }
      if (transient && attempt < attempts - 1) continue;
    }
  }
  if (isTransientImportError(lastErr) && healWithReload()) {
    // The page is reloading; keep the caller suspended instead of erroring.
    return new Promise<T>(() => {});
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(typeof lastErr === 'string' ? lastErr : 'Failed to load module.');
}
