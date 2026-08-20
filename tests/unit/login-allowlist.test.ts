import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The allowlist is read from `PUBLIC_LOGIN_ALLOWLIST` at MODULE LOAD, so every
 * case here has to stub the env and re-import rather than call a function with
 * different arguments. That is also the behaviour worth pinning: the value is
 * inlined at build time, so changing it needs a rebuild — a test that could
 * flip it at runtime would be testing something the deployed app cannot do.
 *
 * These assertions previously described a hardcoded single-address list. When
 * registration was opened up (ef1df3d) the source became env-driven and
 * defaulted to open, and the old test kept asserting the old shape — it failed
 * for the honest reason that the behaviour had deliberately changed.
 */
async function loadWith(allowlist: string | undefined) {
  vi.resetModules();
  if (allowlist === undefined) vi.stubEnv('PUBLIC_LOGIN_ALLOWLIST', '');
  else vi.stubEnv('PUBLIC_LOGIN_ALLOWLIST', allowlist);
  return import('../../src/lib/auth/login-allowlist');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('login allowlist', () => {
  it('is open when unset — registration is self-service by default', async () => {
    const { isAllowedLoginEmail, REGISTRATION_OPEN } = await loadWith(undefined);
    expect(REGISTRATION_OPEN).toBe(true);
    expect(isAllowedLoginEmail('anyone@example.com')).toBe(true);
  });

  it('restricts to the configured addresses once set', async () => {
    const { isAllowedLoginEmail, REGISTRATION_OPEN } = await loadWith('hello@laravel42.com');
    expect(REGISTRATION_OPEN).toBe(false);
    expect(isAllowedLoginEmail('hello@laravel42.com')).toBe(true);
    expect(isAllowedLoginEmail('stranger@example.com')).toBe(false);
    // A near-miss on the TLD must not pass.
    expect(isAllowedLoginEmail('hello@laravel42.co')).toBe(false);
    expect(isAllowedLoginEmail('')).toBe(false);
  });

  it('matches case- and whitespace-insensitively', async () => {
    const { isAllowedLoginEmail } = await loadWith('hello@laravel42.com');
    expect(isAllowedLoginEmail('  HELLO@Laravel42.com  ')).toBe(true);
  });

  it('accepts a comma-separated list, tolerating spacing', async () => {
    const { LOGIN_ALLOWLIST, isAllowedLoginEmail } = await loadWith(
      ' hello@laravel42.com , Second@Example.com ,, ',
    );
    // Blanks dropped, everything normalised — otherwise an editing slip in the
    // env silently adds an empty entry that matches nothing.
    expect(LOGIN_ALLOWLIST).toEqual(['hello@laravel42.com', 'second@example.com']);
    expect(isAllowedLoginEmail('second@example.com')).toBe(true);
  });
});
