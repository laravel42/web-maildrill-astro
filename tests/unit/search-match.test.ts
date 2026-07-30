import { describe, expect, it } from 'vitest';
import { anyMatchesSearchQuery, matchesSearchQuery } from '@/lib/app/search-match';

describe('matchesSearchQuery', () => {
  it('does not match mid-word substrings', () => {
    expect(matchesSearchQuery('artwork', 'two')).toBe(false);
    expect(matchesSearchQuery('network', 'two')).toBe(false);
    expect(matchesSearchQuery('textures', 'ext')).toBe(false);
  });

  it('matches whole tokens and prefixes', () => {
    expect(matchesSearchQuery('artwork', 'art')).toBe(true);
    expect(matchesSearchQuery('artwork', 'artwork')).toBe(true);
    expect(matchesSearchQuery('street photography', 'street')).toBe(true);
    expect(matchesSearchQuery('street photography', 'photo')).toBe(true);
  });

  it('requires every query token to match', () => {
    expect(matchesSearchQuery('street photography', 'street photo')).toBe(true);
    expect(matchesSearchQuery('street photography', 'street food')).toBe(false);
  });

  it('tokenizes hyphenated filenames', () => {
    expect(matchesSearchQuery('two-women-on-a-beach.jpg', 'two')).toBe(true);
    expect(matchesSearchQuery('brown-wooden-swing.jpg', 'two')).toBe(false);
  });
});

describe('anyMatchesSearchQuery', () => {
  it('matches across parts', () => {
    expect(anyMatchesSearchQuery(['sunset.jpg', 'nature', 'artwork'], 'two')).toBe(false);
    expect(anyMatchesSearchQuery(['sunset.jpg', 'nature', 'artwork'], 'art')).toBe(true);
    expect(anyMatchesSearchQuery(['two-cats.jpg', 'animals'], 'two')).toBe(true);
  });
});
