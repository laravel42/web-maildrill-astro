import { describe, expect, it } from 'vitest';
import {
  invalidReasonLabel,
  validateEmailAddress,
  validateEmailAddresses,
} from './email-validation';

/**
 * These hit real DNS for the MX check, so they are fast but not hermetic.
 * They are worth it for the SMTP guard below, which protects against a change
 * that would silently mark every subscriber invalid.
 */
describe('validateEmailAddress', () => {
  it('accepts a deliverable address', async () => {
    const r = await validateEmailAddress('hello@laravel42.com');
    expect(r.valid).toBe(true);
  });

  it('rejects broken syntax', async () => {
    expect(await validateEmailAddress('not-an-email')).toMatchObject({
      valid: false,
      reason: 'regex',
    });
    expect((await validateEmailAddress('')).valid).toBe(false);
  });

  it('catches a typo\'d provider domain and suggests the fix', async () => {
    const r = await validateEmailAddress('someone@gmial.com');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('typo');
  });

  it('rejects disposable providers', async () => {
    expect(await validateEmailAddress('throwaway@mailinator.com')).toMatchObject({
      valid: false,
      reason: 'disposable',
    });
  });

  it('rejects a domain that accepts no mail', async () => {
    expect(await validateEmailAddress('nobody@nonexistent-domain-xyzq.com')).toMatchObject({
      valid: false,
      reason: 'mx',
    });
  });

  /**
   * The guard that matters most.
   *
   * SMTP verification needs outbound port 25, which is blocked on our hosts.
   * Measured with it enabled, a real address takes ~10s to time out and then
   * reports `valid: false, reason: 'smtp'` — every subscriber would be marked
   * invalid and all sending would stop. A valid address resolving well under
   * that window is proof the SMTP stage is not running.
   */
  it('never performs an SMTP probe — it would fail closed on a blocked port 25', async () => {
    const started = Date.now();
    const r = await validateEmailAddress('hello@laravel42.com');
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(r.valid).toBe(true);
    expect(r.reason).not.toBe('smtp');
  });
});

describe('validateEmailAddresses', () => {
  it('returns a verdict per unique address', async () => {
    const out = await validateEmailAddresses([
      'hello@laravel42.com',
      'not-an-email',
      'HELLO@laravel42.com', // same address, different case
    ]);
    expect(out.get('hello@laravel42.com')?.valid).toBe(true);
    expect(out.get('not-an-email')?.valid).toBe(false);
    expect(out.size).toBe(2);
  });

  it('reuses a dead domain across the batch instead of re-querying DNS', async () => {
    const dead = Array.from(
      { length: 25 },
      (_, i) => `user${i}@nonexistent-domain-xyzq.com`,
    );
    const started = Date.now();
    const out = await validateEmailAddresses(dead);
    // 25 addresses, one domain — the cache should make this far cheaper than
    // 25 independent lookups.
    expect(Date.now() - started).toBeLessThan(5_000);
    expect([...out.values()].every((v) => v.valid === false && v.reason === 'mx')).toBe(true);
  });
});

describe('invalidReasonLabel', () => {
  it('explains every reason the validator can return', () => {
    for (const reason of ['regex', 'typo', 'disposable', 'mx', 'smtp'] as const) {
      expect(invalidReasonLabel(reason)).toBeTruthy();
    }
  });

  it('includes the suggestion when there is one', () => {
    expect(invalidReasonLabel('typo', 'gmail.com')).toContain('gmail.com');
  });
});
