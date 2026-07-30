import { describe, expect, it } from 'vitest';
import {
  matchesAspectRatio,
  matchesOrientation,
  mediaSize,
  parseDim,
} from '@/components/react/AppMedia.logic';

describe('parseDim / mediaSize', () => {
  it('parses display dims', () => {
    expect(parseDim('1920 × 1080')).toEqual({ width: 1920, height: 1080 });
    expect(mediaSize({ width: 800, height: 800 })).toEqual({ width: 800, height: 800 });
  });
});

describe('matchesOrientation', () => {
  it('treats square as both landscape and portrait', () => {
    expect(matchesOrientation(1000, 1000, new Set(['Landscape']))).toBe(true);
    expect(matchesOrientation(1000, 1000, new Set(['Portrait']))).toBe(true);
    expect(matchesOrientation(1000, 1000, new Set(['Landscape', 'Portrait']))).toBe(true);
  });

  it('filters wide and tall images', () => {
    expect(matchesOrientation(1920, 1080, new Set(['Landscape']))).toBe(true);
    expect(matchesOrientation(1920, 1080, new Set(['Portrait']))).toBe(false);
    expect(matchesOrientation(1080, 1920, new Set(['Portrait']))).toBe(true);
    expect(matchesOrientation(1080, 1920, new Set(['Landscape']))).toBe(false);
  });
});

describe('matchesAspectRatio', () => {
  it('matches named ratios within tolerance', () => {
    expect(matchesAspectRatio(1920, 1080, new Set(['16:9']))).toBe(true);
    expect(matchesAspectRatio(1080, 1920, new Set(['9:16']))).toBe(true);
    expect(matchesAspectRatio(1000, 1000, new Set(['1:1']))).toBe(true);
    expect(matchesAspectRatio(1600, 1200, new Set(['4:3']))).toBe(true);
    expect(matchesAspectRatio(1500, 1000, new Set(['3:2']))).toBe(true);
  });

  it('rejects distant ratios', () => {
    expect(matchesAspectRatio(1920, 1080, new Set(['1:1']))).toBe(false);
    expect(matchesAspectRatio(1000, 1000, new Set(['16:9']))).toBe(false);
  });

  it('ORs multiple selected ratios', () => {
    expect(matchesAspectRatio(1920, 1080, new Set(['1:1', '16:9']))).toBe(true);
  });
});
