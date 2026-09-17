import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDailyCap, clearRateLimiters, throttleSend } from './rate-limiter';

/** Minimal in-memory stand-in for the ioredis client checkDailyCap needs. */
function fakeRedis() {
  const store = new Map<string, number>();
  const ttls = new Map<string, number>();
  return {
    store,
    ttls,
    async incr(key: string): Promise<number> {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    },
    async expire(key: string, seconds: number): Promise<number> {
      ttls.set(key, seconds);
      return 1;
    },
  };
}

afterEach(() => {
  clearRateLimiters();
  vi.useRealTimers();
});

describe('throttleSend', () => {
  it('is a no-op when the rate is 0 (unthrottled — the historical default)', async () => {
    const start = Date.now();
    await throttleSend('ses', 0);
    await throttleSend('ses', 0);
    expect(Date.now() - start).toBeLessThan(20);
  });

  it('lets the first `rate` calls through immediately, then makes the next one wait', async () => {
    vi.useFakeTimers();
    const rate = 5;
    let acquired = 0;
    for (let i = 0; i < rate; i++) {
      await throttleSend('ses', rate);
      acquired++;
    }
    expect(acquired).toBe(rate);

    let sixthResolved = false;
    void throttleSend('ses', rate).then(() => {
      sixthResolved = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(sixthResolved).toBe(false);

    await vi.advanceTimersByTimeAsync(1000);
    expect(sixthResolved).toBe(true);
  });

  it('keeps separate buckets per driver — one provider throttling never blocks another', async () => {
    vi.useFakeTimers();
    await throttleSend('ses', 1);
    let infobipResolved = false;
    void throttleSend('infobip', 1).then(() => {
      infobipResolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    expect(infobipResolved).toBe(true);
  });
});

describe('checkDailyCap', () => {
  it('is a no-op when maxPerDay is 0 (uncapped)', async () => {
    const redis = fakeRedis();
    const result = await checkDailyCap('ses', 0, redis);
    expect(result).toEqual({ ok: true, count: 0 });
    expect(redis.store.size).toBe(0);
  });

  it('allows attempts up to the cap, then rejects further ones the same day', async () => {
    const redis = fakeRedis();
    for (let i = 1; i <= 3; i++) {
      const result = await checkDailyCap('ses', 3, redis);
      expect(result).toEqual({ ok: true, count: i });
    }
    const over = await checkDailyCap('ses', 3, redis);
    expect(over).toEqual({ ok: false, count: 4 });
  });

  it('sets a 2-day expiry on the counter key only on its first increment', async () => {
    const redis = fakeRedis();
    await checkDailyCap('ses', 10, redis);
    await checkDailyCap('ses', 10, redis);
    expect(redis.ttls.size).toBe(1);
    const seconds = [...redis.ttls.values()][0];
    expect(seconds).toBe(2 * 24 * 60 * 60);
  });

  it('keeps separate counters per driver', async () => {
    const redis = fakeRedis();
    await checkDailyCap('ses', 1, redis);
    const infobip = await checkDailyCap('infobip', 1, redis);
    expect(infobip).toEqual({ ok: true, count: 1 });
  });
});
