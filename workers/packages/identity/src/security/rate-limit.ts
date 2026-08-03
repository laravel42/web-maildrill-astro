/**
 * Fixed-window in-memory rate limiter for the security endpoints (TOTP /
 * recovery / WebAuthn attempts, code requests, sensitive mutations). The
 * product API runs as a single process, so process-local state is the actual
 * global state; if the API is ever scaled horizontally this must move to
 * Redis. The clock is injectable for tests.
 */

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets — only meaningful when `ok` is false. */
  retryAfterSec: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  private lastSweep = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** Count a hit against `key`; deny once `max` hits land inside `windowMs`. */
  hit(key: string, max: number, windowMs: number): RateLimitResult {
    const at = this.now();
    this.sweep(at);
    const win = this.windows.get(key);
    if (!win || win.resetAt <= at) {
      this.windows.set(key, { count: 1, resetAt: at + windowMs });
      return { ok: true, retryAfterSec: 0 };
    }
    win.count += 1;
    if (win.count > max) {
      return { ok: false, retryAfterSec: Math.max(1, Math.ceil((win.resetAt - at) / 1000)) };
    }
    return { ok: true, retryAfterSec: 0 };
  }

  /** Forget a key (e.g. clear failed-attempt counters after success). */
  clear(key: string): void {
    this.windows.delete(key);
  }

  /** Drop expired windows at most once a minute so the map can't grow forever. */
  private sweep(at: number): void {
    if (at - this.lastSweep < 60_000) return;
    this.lastSweep = at;
    for (const [key, win] of this.windows) {
      if (win.resetAt <= at) this.windows.delete(key);
    }
  }
}

/** Shared limiter instance + the per-concern policies. */
export const rateLimiter = new RateLimiter();

export const RATE_LIMITS = {
  /** TOTP / recovery-code attempts during login 2FA and reauth, per user. */
  secondFactor: { max: 5, windowMs: 5 * 60_000 },
  recoveryCode: { max: 5, windowMs: 15 * 60_000 },
  /** Passkey assertion attempts, per IP (user unknown before verify). */
  passkeyLogin: { max: 10, windowMs: 5 * 60_000 },
  /** Passkey registration ceremonies, per user. */
  passkeyRegister: { max: 10, windowMs: 60 * 60_000 },
  /** Magic-link code emails, per address and per IP. */
  codeRequest: { max: 5, windowMs: 10 * 60_000 },
  /** Sensitive security mutations (remove/disable/regenerate/revoke-all), per user. */
  sensitiveMutation: { max: 30, windowMs: 10 * 60_000 },
} as const;
