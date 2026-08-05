import { describe, expect, it } from 'vitest';
import { isAllowedLoginEmail } from '../../src/lib/auth/login-allowlist';

describe('isAllowedLoginEmail', () => {
  it('allows the invited account, case- and whitespace-insensitively', () => {
    expect(isAllowedLoginEmail('hello@laravel42.com')).toBe(true);
    expect(isAllowedLoginEmail('  HELLO@Laravel42.com  ')).toBe(true);
  });

  it('rejects every other address', () => {
    expect(isAllowedLoginEmail('stranger@example.com')).toBe(false);
    expect(isAllowedLoginEmail('hello@laravel42.co')).toBe(false);
    expect(isAllowedLoginEmail('')).toBe(false);
  });
});
