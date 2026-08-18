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
  it('separates the link group, and custom fields again when present', () => {
    // Two divider groups now, not one. `{{unsubscribe}}` / `{{webview}}` are
    // email-only and always present, so they carry their own divider whether
    // or not the workspace has custom fields — the assertion this replaces
    // ("no divider when the list is empty") described the menu before that
    // group existed.
    const dividers = (fields: Parameters<typeof buildMergeTagMenu>[0]) =>
      buildMergeTagMenu(fields).children.filter((c) => c.type === 'divider').length;

    expect(dividers([])).toBe(1);
    expect(dividers([field('plan')])).toBe(2);

    // And the custom field lands after the second divider, not before it.
    const children = buildMergeTagMenu([field('plan')]).children;
    const lastDivider = children.map((c) => c.type).lastIndexOf('divider');
    expect(children.findIndex((c) => c.value === '{{attributes.plan}}')).toBeGreaterThan(
      lastDivider,
    );
  });
});
