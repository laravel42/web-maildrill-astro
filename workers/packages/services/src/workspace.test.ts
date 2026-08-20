import { describe, expect, it } from 'vitest';
import { mergeSettings } from './workspace';

describe('mergeSettings', () => {
  it('merges plain-object values one level so partial patches keep siblings', () => {
    expect(
      mergeSettings(
        { branding: { brandName: 'Acme', accentColor: '#111111' }, ai: { summaries: true } },
        { branding: { accentColor: '#4f46e5' } },
      ),
    ).toEqual({
      branding: { brandName: 'Acme', accentColor: '#4f46e5' },
      ai: { summaries: true },
    });
  });

  it('replaces scalars, arrays, and previously-scalar keys wholesale', () => {
    expect(mergeSettings({ a: 1, list: [1, 2] }, { a: 2, list: [3], b: 'x' })).toEqual({
      a: 2,
      list: [3],
      b: 'x',
    });
    expect(mergeSettings({ a: 'scalar' }, { a: { now: 'object' } })).toEqual({
      a: { now: 'object' },
    });
  });

  it('null clears a key value', () => {
    expect(mergeSettings({ branding: { logoUrl: 'x' }, flag: true }, { flag: null })).toEqual({
      branding: { logoUrl: 'x' },
      flag: null,
    });
  });
});
