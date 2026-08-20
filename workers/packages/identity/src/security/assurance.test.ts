import { describe, expect, it } from 'vitest';
import { decideCodeLogin, decidePasskeyLogin, isMfaSatisfied } from './assurance';

describe('authentication assurance policy', () => {
  it('code login without TOTP needs no second factor', () => {
    expect(decideCodeLogin({ totpEnabled: false, trustedDevice: false })).toEqual({
      requiresSecondFactor: false,
      amr: ['code'],
    });
  });

  it('code login with TOTP demands a second factor on untrusted devices', () => {
    expect(decideCodeLogin({ totpEnabled: true, trustedDevice: false })).toEqual({
      requiresSecondFactor: true,
      amr: ['code'],
    });
  });

  it('a trusted device satisfies the challenge and is recorded in amr', () => {
    expect(decideCodeLogin({ totpEnabled: true, trustedDevice: true })).toEqual({
      requiresSecondFactor: false,
      amr: ['code', 'trusted_device'],
    });
  });

  it('passkey login is phishing-resistant MFA on its own', () => {
    expect(decidePasskeyLogin()).toEqual({ requiresSecondFactor: false, amr: ['webauthn'] });
    expect(isMfaSatisfied(['webauthn'])).toBe(true);
  });

  it('classifies method sets for MFA', () => {
    expect(isMfaSatisfied(['code'])).toBe(false);
    expect(isMfaSatisfied(['code', 'trusted_device'])).toBe(false);
    expect(isMfaSatisfied(['code', 'totp'])).toBe(true);
    expect(isMfaSatisfied(['code', 'recovery'])).toBe(true);
    expect(isMfaSatisfied([])).toBe(false);
  });
});
