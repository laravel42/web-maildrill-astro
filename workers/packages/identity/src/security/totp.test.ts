import { describe, expect, it } from 'vitest';
import {
  TOTP_PERIOD_SECONDS,
  generateTotpSecret,
  totpCodeAt,
  totpSetupUri,
  verifyTotpCode,
} from './totp';

const STEP_MS = TOTP_PERIOD_SECONDS * 1000;

describe('totp', () => {
  it('generates base32 secrets of RFC-recommended length', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(secret.length).toBe(32); // 20 bytes base32
    expect(generateTotpSecret()).not.toBe(secret);
  });

  it('builds an otpauth URI carrying issuer and account label', () => {
    const uri = totpSetupUri(generateTotpSecret(), 'user@example.com');
    expect(uri).toMatch(/^otpauth:\/\/totp\//);
    expect(uri).toContain('issuer=Maildrill');
    expect(uri).toContain('user%40example.com');
    expect(uri).toContain('period=30');
    expect(uri).toContain('digits=6');
  });

  it('accepts the current code and tolerates one step of drift', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const current = totpCodeAt(secret, now);
    expect(verifyTotpCode(secret, current, { now }).ok).toBe(true);
    const prev = totpCodeAt(secret, now - STEP_MS);
    expect(verifyTotpCode(secret, prev, { now }).ok).toBe(true);
    const next = totpCodeAt(secret, now + STEP_MS);
    expect(verifyTotpCode(secret, next, { now }).ok).toBe(true);
  });

  it('rejects codes beyond the drift window', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const stale = totpCodeAt(secret, now - 3 * STEP_MS);
    expect(verifyTotpCode(secret, stale, { now }).ok).toBe(false);
    const future = totpCodeAt(secret, now + 3 * STEP_MS);
    expect(verifyTotpCode(secret, future, { now }).ok).toBe(false);
  });

  it('rejects malformed and wrong codes', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    expect(verifyTotpCode(secret, '', { now }).ok).toBe(false);
    expect(verifyTotpCode(secret, '12345', { now }).ok).toBe(false);
    const current = totpCodeAt(secret, now);
    const wrong = current === '000000' ? '000001' : '000000';
    expect(verifyTotpCode(secret, wrong, { now }).ok).toBe(false);
  });

  it('blocks replay of an accepted step via lastUsedStep', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const code = totpCodeAt(secret, now);
    const first = verifyTotpCode(secret, code, { now });
    expect(first.ok).toBe(true);
    // Same code, same window, replayed after acceptance: rejected.
    const replay = verifyTotpCode(secret, code, { now, lastUsedStep: first.step });
    expect(replay.ok).toBe(false);
    // The next step's code still works.
    const nextCode = totpCodeAt(secret, now + STEP_MS);
    const second = verifyTotpCode(secret, nextCode, {
      now: now + STEP_MS,
      lastUsedStep: first.step,
    });
    expect(second.ok).toBe(true);
    expect(second.step).toBe((first.step ?? 0) + 1);
  });
});
