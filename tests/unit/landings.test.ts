import { describe, expect, it } from 'vitest';
import {
  formatBytes,
  landingStatus,
  landingStatusChipClass,
  LANDING_SIZE_WARNING_BYTES,
} from '@/lib/app/landings';

describe('landingStatus', () => {
  it('is a draft while nothing has been published', () => {
    expect(landingStatus({ publishedAt: null, updatedAt: '2026-09-01T10:00:00Z' })).toBe('draft');
  });

  it('is published when the last edit predates the publish', () => {
    expect(
      landingStatus({ publishedAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T10:00:00Z' }),
    ).toBe('published');
  });

  it('is published when the two timestamps match', () => {
    expect(
      landingStatus({ publishedAt: '2026-09-01T12:00:00Z', updatedAt: '2026-09-01T12:00:00Z' }),
    ).toBe('published');
  });

  it('goes stale as soon as the site is edited after publishing', () => {
    expect(
      landingStatus({ publishedAt: '2026-09-01T10:00:00Z', updatedAt: '2026-09-01T12:00:00Z' }),
    ).toBe('stale');
  });
});

describe('landingStatusChipClass', () => {
  it('reuses the workspace status chips rather than inventing new ones', () => {
    expect(landingStatusChipClass('draft')).toBe('astatus--draft');
    expect(landingStatusChipClass('published')).toBe('astatus--active');
    expect(landingStatusChipClass('stale')).toBe('astatus--sending');
  });
});

describe('formatBytes', () => {
  it('renders an em dash for nothing stored yet', () => {
    expect(formatBytes(0)).toBe('—');
    expect(formatBytes(Number.NaN)).toBe('—');
  });

  it('scales through B / KB / MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1_500_000)).toBe('1.4 MB');
  });

  it('matches the editor’s own publish-size warning threshold', () => {
    // Builder42's `checkPublishSize` warns at 9 MB; the list colours the same
    // number, so a landing that will fail to publish looks wrong before it does.
    expect(LANDING_SIZE_WARNING_BYTES).toBe(9 * 1024 * 1024);
    expect(formatBytes(LANDING_SIZE_WARNING_BYTES)).toBe('9.0 MB');
  });
});
