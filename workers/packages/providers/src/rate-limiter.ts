/**
 * In-process token-bucket limiter for outbound provider calls.
 *
 * This is deliberately separate from, and stricter than, the BullMQ dispatch
 * worker's own limiter (RATE_LIMIT_MAX/RATE_LIMIT_DURATION_MS): that one is
 * global across every channel and provider sharing the one dispatch queue, so
 * raising it to get SES throughput also uncaps Infobip, and vice versa. Each
 * provider gets its own bucket here instead, sized to what that specific
 * account is actually allowed to do (e.g. SES's granted account send rate).
 *
 * One process = one bucket per provider name; multiple dispatch worker
 * replicas each enforce their own local ceiling; the aggregate fleet-wide
 * rate is `perProcessRate * replicaCount`, so divide the account's granted
 * rate by the number of running replicas when setting *_MAX_SEND_RATE.
 */

class TokenBucket {
  private tokens: number;
  private lastRefill: number;

  constructor(private readonly ratePerSecond: number) {
    this.tokens = ratePerSecond;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.ratePerSecond, this.tokens + elapsedSeconds * this.ratePerSecond);
    this.lastRefill = now;
  }

  /** Resolve once a token is available, waiting as long as the current shortfall requires. */
  async acquire(): Promise<void> {
    for (;;) {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const shortfall = 1 - this.tokens;
      const waitMs = Math.max(1, Math.ceil((shortfall / this.ratePerSecond) * 1000));
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

const buckets = new Map<string, TokenBucket>();

/**
 * Wait for a send slot under `driver`'s configured rate. A `ratePerSecond` of
 * 0 (or unset) is unthrottled — the historical default — so this is a no-op
 * for every driver until its `*_MAX_SEND_RATE` is explicitly set.
 */
export async function throttleSend(driver: string, ratePerSecond: number): Promise<void> {
  if (!ratePerSecond || ratePerSecond <= 0) return;
  let bucket = buckets.get(driver);
  if (!bucket) {
    bucket = new TokenBucket(ratePerSecond);
    buckets.set(driver, bucket);
  }
  await bucket.acquire();
}

export interface DailyCapResult {
  ok: boolean;
  /** Count including the attempt just recorded, whether or not it was allowed. */
  count: number;
}

/**
 * Redis-backed daily send cap, shared across every dispatch worker replica
 * (unlike the per-second token bucket above, which is per-process — a daily
 * account-wide ceiling has to be enforced fleet-wide, not per replica).
 *
 * Simplification: keyed by UTC calendar day, not a true rolling 24h window
 * like AWS SES's own account-level quota. Close enough for an in-process
 * safety net; the account's real quota is still the authority.
 *
 * Counts attempts reaching the provider adapter, not confirmed-successful
 * sends — a message already past validation earlier in the pipeline is
 * effectively committed to being sent, so this is the right thing to bound.
 * Once over cap, every further attempt today keeps getting rejected (the
 * counter is never decremented) rather than silently let through.
 */
export async function checkDailyCap(
  driver: string,
  maxPerDay: number,
  redis: { incr(key: string): Promise<number>; expire(key: string, seconds: number): Promise<number> },
): Promise<DailyCapResult> {
  if (!maxPerDay || maxPerDay <= 0) return { ok: true, count: 0 };
  const day = new Date().toISOString().slice(0, 10);
  const key = `ratelimit:daily:${driver}:${day}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 2 * 24 * 60 * 60); // 2-day safety margin past UTC midnight
  }
  return { ok: count <= maxPerDay, count };
}

/** Test seam — drop bucket state between cases. */
export function clearRateLimiters(): void {
  buckets.clear();
}
