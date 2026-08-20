import { describe, expect, it } from 'vitest';
import {
  displayNameFromFile,
  matchesAspectRatio,
  matchesOrientation,
  mediaSize,
  parseDim,
  tagsFromFilename,
  toKebabCase,
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

describe('displayNameFromFile / tagsFromFilename', () => {
  it('strips extension and path for display name', () => {
    expect(displayNameFromFile('sunset-beach.jpg')).toBe('sunset-beach');
    expect(displayNameFromFile('/tmp/foo_bar.PNG')).toBe('foo_bar');
  });

  it('derives tags from filename tokens', () => {
    expect(tagsFromFilename('sunset-beach-view.jpg')).toEqual(['sunset', 'beach', 'view']);
    expect(tagsFromFilename('ab.jpg')).toEqual([]); // too short
    expect(tagsFromFilename('img_12.jpg')).toEqual(['img']); // numeric token skipped
  });
});

describe('toKebabCase', () => {
  it('normalizes titles to kebab-case', () => {
    expect(toKebabCase('Red Fox in Snow')).toBe('red-fox-in-snow');
    expect(toKebabCase('  already_snake  ')).toBe('already-snake');
    expect(toKebabCase('Café-Morning!!')).toBe('caf-morning');
  });
});
