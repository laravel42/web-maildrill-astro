import { describe, expect, it } from 'vitest';
import {
  buildMergeTagMenu,
  buildPersonalizationTokens,
  normalizeKey,
  type CustomField,
} from '@/lib/app/custom-fields';

const field = (key: string): CustomField => ({
  id: key,
  key,
  label: key,
  type: 'text',
  createdAt: '2026-01-01T00:00:00Z',
});

describe('normalizeKey', () => {
  it('slugs to lowercase snake case', () => {
    expect(normalizeKey('First Name')).toBe('first_name');
    expect(normalizeKey('  Company-Size!  ')).toBe('company_size');
  });

  it('requires a leading letter', () => {
    expect(normalizeKey('123abc')).toBe('');
    expect(normalizeKey('___')).toBe('');
    expect(normalizeKey('')).toBe('');
  });

  it('caps at 64 characters', () => {
    expect(normalizeKey(`a${'b'.repeat(100)}`)).toHaveLength(64);
  });
});

describe('buildPersonalizationTokens', () => {
  it('appends custom fields after the core tokens', () => {
    const tokens = buildPersonalizationTokens([field('plan')]);
    expect(tokens.map((t) => t.token)).toEqual([
      '{{name}}',
      '{{email}}',
      '{{phone}}',
      '{{attributes.plan}}',
    ]);
  });
});

describe('buildMergeTagMenu', () => {
  it('adds a divider only when custom fields exist', () => {
    expect(buildMergeTagMenu([]).children.some((c) => c.type === 'divider')).toBe(false);
    const menu = buildMergeTagMenu([field('plan')]);
    expect(menu.children.some((c) => c.type === 'divider')).toBe(true);
    expect(menu.children.at(-1)).toMatchObject({ value: '{{attributes.plan}}' });
  });
});
