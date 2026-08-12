import { describe, expect, it } from 'vitest';
import { TRIAL_ALLOWANCES, TRIAL_ALLOWANCE_UNITS } from '@maildrill/domain';

/**
 * The allowances are a promise made on `/signup`, so they get a test of their
 * own: a silent edit here changes what customers were sold. The site builds
 * its perk list from the mirrored constant in `src/config/pricing.ts`, and
 * these values must match it.
 */
describe('TRIAL_ALLOWANCES', () => {
  it('matches what /signup advertises', () => {
    expect(TRIAL_ALLOWANCES).toEqual({
      email: 100,
      sms: 15,
      whatsapp: 100,
      voice: 60,
    });
  });

  it('covers every channel with a unit label', () => {
    for (const channel of Object.keys(TRIAL_ALLOWANCES)) {
      expect(TRIAL_ALLOWANCE_UNITS[channel as keyof typeof TRIAL_ALLOWANCE_UNITS]).toBeTruthy();
    }
  });

  it('is frozen — allowances must not be mutated at runtime', () => {
    expect(Object.isFrozen(TRIAL_ALLOWANCES)).toBe(true);
  });
});
