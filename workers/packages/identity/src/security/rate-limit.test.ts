import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit';

describe('rate limiter', () => {
  it('allows up to max hits, then denies with a retry hint', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 5; i += 1) {
      expect(limiter.hit('k', 5, 60_000).ok).toBe(true);
    }
    const denied = limiter.hit('k', 5, 60_000);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it('resets after the window elapses', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 6; i += 1) limiter.hit('k', 5, 60_000);
    expect(limiter.hit('k', 5, 60_000).ok).toBe(false);
    now = 60_001;
    expect(limiter.hit('k', 5, 60_000).ok).toBe(true);
  });

  it('tracks keys independently and supports clear()', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 6; i += 1) limiter.hit('a', 5, 60_000);
    expect(limiter.hit('a', 5, 60_000).ok).toBe(false);
    expect(limiter.hit('b', 5, 60_000).ok).toBe(true);
    limiter.clear('a');
    expect(limiter.hit('a', 5, 60_000).ok).toBe(true);
  });

  it('sweeps expired windows so the map cannot grow forever', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    for (let i = 0; i < 100; i += 1) limiter.hit(`k${i}`, 5, 1000);
    now = 120_000; // past both the windows and the sweep interval
    limiter.hit('fresh', 5, 1000);
    // Internal map only retains live windows.
    expect((limiter as unknown as { windows: Map<string, unknown> }).windows.size).toBe(1);
  });
});
