/**
 * Daily quota counter for Unsplash API requests, split between two budgets:
 *
 *   - `'ai'`     — used by `/api/generate` to pre-resolve the IMAGE_POOL
 *                  injected into the system prompt.
 *   - `'picker'` — used by `/api/images/search` for the manual gallery picker.
 *
 * Production tier on the Unsplash side gives us 1000 req/day. We reserve
 * 600/day for AI generation and 400/day for the picker so a burst of one
 * never starves the other.
 *
 * Implementation notes:
 *
 * - In-memory only. Multi-instance deployments will need to swap this for
 *   Redis or similar; the module exposes `createDailyQuota({ now })` so the
 *   backing store can be replaced without churning callers.
 * - Counters reset at UTC midnight. We don't roll on local time because the
 *   1000/day Unsplash limit is itself UTC-based, and a local-time reset
 *   would let one server reset twice on DST days.
 * - `tryConsume` is the only mutation path. Reads (`remaining`, `usage`) are
 *   side-effect free aside from triggering a reset when the date rolls.
 */

export type QuotaScope = 'ai' | 'picker';

export interface DailyQuotaLimits {
  /** Daily budget for the `ai` scope. Defaults to 600. */
  ai: number;
  /** Daily budget for the `picker` scope. Defaults to 400. */
  picker: number;
}

export interface DailyQuotaUsage {
  /** UTC date (YYYY-MM-DD) the snapshot belongs to. */
  date: string;
  ai: { used: number; remaining: number; limit: number };
  picker: { used: number; remaining: number; limit: number };
}

export interface DailyQuotaOptions {
  /** Override the production limits (mostly useful in tests). */
  limits?: Partial<DailyQuotaLimits>;
  /** Injected clock — defaults to `() => new Date()`. Tests override this. */
  now?: () => Date;
}

export interface DailyQuota {
  /**
   * Attempt to charge `cost` units against the given scope. Returns `true`
   * if the budget had room (and was decremented), `false` otherwise.
   *
   * `cost` defaults to 1 — pass a larger value for a single request that
   * fans out to multiple upstream calls (e.g. building a 5-query image
   * pool charges 5 against `'ai'`).
   */
  tryConsume(scope: QuotaScope, cost?: number): boolean;
  /** Remaining budget for `scope` on the current UTC day (post-reset). */
  remaining(scope: QuotaScope): number;
  /** Snapshot of both buckets for diagnostics or `/health`. */
  usage(): DailyQuotaUsage;
  /** Force a reset — only used by tests. */
  reset(): void;
}

const DEFAULT_LIMITS: DailyQuotaLimits = {
  ai: 600,
  picker: 400,
};

/**
 * Format a `Date` as a UTC `YYYY-MM-DD` string. Used as the bucket key so
 * counters auto-roll at UTC midnight without scheduling a timer.
 */
function utcDateKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Read an optional positive integer from an env var. Falls back to
 * `defaultValue` when unset, empty, or invalid.
 */
function readPositiveIntEnv(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    return defaultValue;
  }
  return parsed;
}

/**
 * Resolves limits from constructor options first, then environment
 * (`UNSPLASH_DAILY_BUDGET_AI`, `UNSPLASH_DAILY_BUDGET_PICKER`), then
 * built-in defaults.
 */
function resolveLimits(override?: Partial<DailyQuotaLimits>): DailyQuotaLimits {
  return {
    ai: override?.ai ?? readPositiveIntEnv('UNSPLASH_DAILY_BUDGET_AI', DEFAULT_LIMITS.ai),
    picker:
      override?.picker ?? readPositiveIntEnv('UNSPLASH_DAILY_BUDGET_PICKER', DEFAULT_LIMITS.picker),
  };
}

/**
 * Creates a `DailyQuota` with isolated state. Tests should always construct a
 * fresh instance to avoid cross-test interference.
 */
export function createDailyQuota(options: DailyQuotaOptions = {}): DailyQuota {
  const now = options.now ?? (() => new Date());
  const limits = resolveLimits(options.limits);

  let bucketDate = utcDateKey(now());
  let used: Record<QuotaScope, number> = { ai: 0, picker: 0 };

  function rollIfNewDay(): void {
    const today = utcDateKey(now());
    if (today !== bucketDate) {
      bucketDate = today;
      used = { ai: 0, picker: 0 };
    }
  }

  function tryConsume(scope: QuotaScope, cost = 1): boolean {
    if (!Number.isFinite(cost) || cost <= 0 || !Number.isInteger(cost)) {
      // Defensive — calling code should never pass a non-positive integer.
      return false;
    }
    rollIfNewDay();
    const limit = limits[scope];
    const next = used[scope] + cost;
    if (next > limit) return false;
    used[scope] = next;
    return true;
  }

  function remaining(scope: QuotaScope): number {
    rollIfNewDay();
    return Math.max(0, limits[scope] - used[scope]);
  }

  function usage(): DailyQuotaUsage {
    rollIfNewDay();
    return {
      date: bucketDate,
      ai: { used: used.ai, limit: limits.ai, remaining: limits.ai - used.ai },
      picker: {
        used: used.picker,
        limit: limits.picker,
        remaining: limits.picker - used.picker,
      },
    };
  }

  function reset(): void {
    bucketDate = utcDateKey(now());
    used = { ai: 0, picker: 0 };
  }

  return { tryConsume, remaining, usage, reset };
}

/**
 * Singleton used by route handlers. Tests should NOT import this — they
 * should call `createDailyQuota` directly with their own clock.
 */
export const dailyQuota = createDailyQuota();
