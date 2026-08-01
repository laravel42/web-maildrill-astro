import { describe, expect, it } from 'vitest';
import { resolveEmailTracking } from './infobip';

const URL = 'https://us.i.posthog.com/webhook/abc?kind=tracking';

describe('resolveEmailTracking', () => {
  it('tracks opens and clicks with the callback when no flags are set (legacy default)', () => {
    expect(resolveEmailTracking({}, URL)).toEqual({
      track: true,
      trackOpens: true,
      trackClicks: true,
      trackingUrl: URL,
    });
  });

  it('omits the block entirely when flag-less and no callback is configured', () => {
    expect(resolveEmailTracking({}, '')).toBeUndefined();
  });

  it('returns an explicit opt-out when both flags are false — domain default must not apply', () => {
    expect(resolveEmailTracking({ trackOpens: false, trackClicks: false }, URL)).toEqual({
      track: false,
      trackOpens: false,
      trackClicks: false,
    });
    // Same without a callback configured.
    expect(resolveEmailTracking({ trackOpens: false, trackClicks: false }, '')).toEqual({
      track: false,
      trackOpens: false,
      trackClicks: false,
    });
  });

  it('keeps opens while disabling click link-rewriting', () => {
    expect(resolveEmailTracking({ trackClicks: false }, URL)).toEqual({
      track: true,
      trackOpens: true,
      trackClicks: false,
      trackingUrl: URL,
    });
  });

  it('stamps explicit downgrades even without a callback', () => {
    expect(resolveEmailTracking({ trackOpens: false }, '')).toEqual({
      track: true,
      trackOpens: false,
      trackClicks: true,
    });
  });

  it('treats non-boolean junk as on (only literal false disables)', () => {
    expect(resolveEmailTracking({ trackOpens: 'no', trackClicks: 0 }, URL)).toEqual({
      track: true,
      trackOpens: true,
      trackClicks: true,
      trackingUrl: URL,
    });
  });
});
