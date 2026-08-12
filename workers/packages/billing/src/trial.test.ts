import { describe, expect, it } from 'vitest';
import {
  estimateVoiceSeconds,
  TRIAL_ALLOWANCES,
  TRIAL_ALLOWANCE_UNITS,
  TRIAL_VOICE_SECONDS,
} from '@maildrill/domain';

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

describe('estimateVoiceSeconds', () => {
  // 150 wpm + 5s connect overhead, rounded up.
  const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ');

  it('reads text at the neutral pace plus connect overhead', () => {
    // 150 words = 60s spoken + 5s connect.
    expect(estimateVoiceSeconds({ text: words(150) })).toBe(65);
    expect(estimateVoiceSeconds({ text: words(75) })).toBe(35);
  });

  it('scales with speechRate — faster speech is a shorter call', () => {
    const normal = estimateVoiceSeconds({ text: words(150) });
    const fast = estimateVoiceSeconds({ text: words(150), speechRate: 2 });
    const slow = estimateVoiceSeconds({ text: words(150), speechRate: 0.5 });
    expect(fast).toBeLessThan(normal);
    expect(slow).toBeGreaterThan(normal);
    expect(fast).toBe(35); // 60s / 2 + 5s
  });

  it('ignores a nonsensical speechRate rather than distorting the estimate', () => {
    const normal = estimateVoiceSeconds({ text: words(150) });
    for (const speechRate of [0, -1, 99, Number.NaN, 'fast']) {
      expect(estimateVoiceSeconds({ text: words(150), speechRate })).toBe(normal);
    }
  });

  it('rounds up — a partly spoken second is a spent second', () => {
    // 1 word ≈ 0.4s spoken + 5s connect = 5.4 → 6.
    expect(estimateVoiceSeconds({ text: 'hello' })).toBe(6);
  });

  it('falls back for a recording it cannot measure, and never returns zero', () => {
    expect(estimateVoiceSeconds({ audioFileUrl: 'https://cdn/x.mp3' })).toBe(30);
    expect(estimateVoiceSeconds({})).toBeGreaterThan(0);
    expect(estimateVoiceSeconds(null)).toBeGreaterThan(0);
    expect(estimateVoiceSeconds({ text: '   ' })).toBeGreaterThan(0);
  });

  it('spends the advertised hour in seconds', () => {
    expect(TRIAL_VOICE_SECONDS).toBe(3600);
    // ~55 calls of a 60-second script fit in the hour; ~56 do not.
    const perCall = estimateVoiceSeconds({ text: words(150) });
    expect(Math.floor(TRIAL_VOICE_SECONDS / perCall)).toBe(55);
  });
});
