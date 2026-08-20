import { describe, expect, it } from 'vitest';
import {
  generateRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  looksLikeRecoveryCode,
  normalizeRecoveryCode,
} from './recovery-codes';

describe('recovery codes', () => {
  it('formats as XXXX-XXXX over the unambiguous alphabet', () => {
    for (let i = 0; i < 50; i += 1) {
      const code = generateRecoveryCode();
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/);
      expect(code).not.toMatch(/[ILOU]/);
    }
  });

  it('generates a full set of unique codes', () => {
    const codes = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });

  it('normalizes case and separators', () => {
    expect(normalizeRecoveryCode('ab12-cd34')).toBe('AB12CD34');
    expect(normalizeRecoveryCode(' AB12 CD34 ')).toBe('AB12CD34');
    expect(hashRecoveryCode('ab12-cd34')).toBe(hashRecoveryCode('AB12CD34'));
  });

  it('shape-checks candidate codes', () => {
    expect(looksLikeRecoveryCode(generateRecoveryCode())).toBe(true);
    expect(looksLikeRecoveryCode('ab12-cd34')).toBe(true);
    expect(looksLikeRecoveryCode('123456')).toBe(false); // TOTP-shaped
    expect(looksLikeRecoveryCode('AB12-CD3')).toBe(false);
    expect(looksLikeRecoveryCode('')).toBe(false);
  });

  it('hashes are stable and one-way-ish distinct', () => {
    const a = generateRecoveryCode();
    const b = generateRecoveryCode();
    expect(hashRecoveryCode(a)).toBe(hashRecoveryCode(a));
    expect(hashRecoveryCode(a)).not.toBe(hashRecoveryCode(b));
    expect(hashRecoveryCode(a)).toMatch(/^[0-9a-f]{64}$/);
  });
});
