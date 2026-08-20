import { describe, expect, it } from 'vitest';
import { isValidE164, mergePreferences } from './users';

describe('mergePreferences', () => {
  it('replaces top-level string prefs', () => {
    expect(
      mergePreferences({ title: 'A', timezone: 'Europe/Rome (GMT+2)' }, { title: 'B' }),
    ).toEqual({ title: 'B', timezone: 'Europe/Rome (GMT+2)' });
  });

  it('merges notifications without dropping siblings', () => {
    expect(
      mergePreferences(
        { notifications: { 'finished-email': true, 'quota-app': false } },
        { notifications: { 'quota-app': true } },
      ),
    ).toEqual({
      notifications: { 'finished-email': true, 'quota-app': true },
    });
  });
});

describe('isValidE164', () => {
  it('accepts + and 7–16 digits', () => {
    expect(isValidE164('+15550100142')).toBe(true);
    expect(isValidE164('+393319751986')).toBe(true);
  });

  it('rejects missing plus, short, or non-digit', () => {
    expect(isValidE164('15550100142')).toBe(false);
    expect(isValidE164('+123')).toBe(false);
    expect(isValidE164('+1 555 010 0142')).toBe(false);
  });
});
