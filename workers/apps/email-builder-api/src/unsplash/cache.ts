/**
 * Tiny TTL-bounded LRU cache for Unsplash search results.
 *
 * The demo rate limit is 50 req/h — identical queries can happen dozens of
 * times during a single editing session (users typing / paginating / going
 * back), so memoising the last ~100 query permutations for 10 minutes keeps
 * us well under quota without pulling in a dependency.
 *
 * Cache semantics:
 * - Keys are opaque strings (we hash the full query params upstream).
 * - LRU: a cache hit moves the entry to the end of insertion order; the
 *   oldest entry is evicted when the cache is full.
 * - TTL: each entry carries its own `expiresAt`. `get` returns `undefined`
 *   for expired entries and removes them, so the cache self-heals.
 *
 * This is intentionally single-process, in-memory. Multi-instance
 * deployments (Phase 3) will need to swap this for Redis or similar.
 */

const DEFAULT_MAX_ENTRIES = 100;
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface TtlLruCacheOptions {
  maxEntries?: number;
  /** Entry TTL in milliseconds. Each `set` uses this unless overridden. */
  ttlMs?: number;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

export class TtlLruCache<V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly store = new Map<string, Entry<V>>();

  constructor(options: TtlLruCacheOptions = {}) {
    this.maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return undefined;
    }

    // Refresh LRU position — delete then set.
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V): void {
    // If already present, remove so the re-insert moves it to the tail.
    if (this.store.has(key)) {
      this.store.delete(key);
    } else if (this.store.size >= this.maxEntries) {
      // Evict the oldest key (Map iteration is insertion order).
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) {
        this.store.delete(oldest);
      }
    }

    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  /** Clear the cache. Primarily used by tests. */
  clear(): void {
    this.store.clear();
  }

  /** Current entry count (including not-yet-pruned expired entries). */
  get size(): number {
    return this.store.size;
  }
}
