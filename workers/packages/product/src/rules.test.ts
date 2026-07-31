import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import type { SegmentRule } from '@maildrill/database';
import { buildSegmentWhere, clamp } from './rules';

const dialect = new PgDialect();

/** Render a drizzle SQL fragment to real SQL text (params become $1, $2, …). */
function render(sqlFragment: SQL | undefined): string {
  if (!sqlFragment) return '';
  return dialect.sqlToQuery(sqlFragment).sql;
}

const rule = (over: Partial<SegmentRule>): SegmentRule =>
  ({ field: 'email', op: 'eq', value: 'a@x.com', ...over }) as SegmentRule;

describe('clamp', () => {
  it('bounds values inclusively', () => {
    expect(clamp(5, 1, 10)).toBe(5);
    expect(clamp(-5, 1, 10)).toBe(1);
    expect(clamp(50, 1, 10)).toBe(10);
  });
});

describe('buildSegmentWhere', () => {
  it('returns undefined for no rules', () => {
    expect(buildSegmentWhere([], 'all')).toBeUndefined();
  });

  it('compiles core-column and attribute rules', () => {
    const core = render(buildSegmentWhere([rule({})], 'all'));
    expect(core).toContain('email');
    const attr = render(buildSegmentWhere([rule({ field: 'plan', value: 'pro' })], 'all'));
    expect(attr).toContain('->>');
  });

  it('compiles list/tag membership into EXISTS subqueries', () => {
    const list = render(
      buildSegmentWhere(
        [rule({ field: 'list', op: 'eq', value: '11111111-1111-1111-1111-111111111111' })],
        'all',
      ),
    );
    expect(list).toContain('list_members');
    const tag = render(buildSegmentWhere([rule({ field: 'tag', op: 'neq', value: 'vip' })], 'all'));
    expect(tag).toContain('subscriber_tags');
    expect(tag).toContain('not ');
  });

  it('rejects unsupported membership operators', () => {
    expect(() =>
      buildSegmentWhere([rule({ field: 'tag', op: 'contains', value: 'v' })], 'all'),
    ).toThrow(/unsupported op/);
  });

  it('combines with AND for all and OR for any', () => {
    const rules = [rule({}), rule({ field: 'status', value: 'active' })];
    const all = render(buildSegmentWhere(rules, 'all'));
    const any = render(buildSegmentWhere(rules, 'any'));
    expect(all).toContain(' and ');
    expect(any).toContain(' or ');
  });

  it('casts numeric comparisons and keeps string ones raw', () => {
    const num = render(buildSegmentWhere([rule({ field: 'orders', op: 'gt', value: 3 })], 'all'));
    expect(num).toContain('::numeric');
    const str = render(buildSegmentWhere([rule({ field: 'orders', op: 'gt', value: '3' })], 'all'));
    expect(str).not.toContain('::numeric');
  });

  it('maps exists/not_exists to null checks on plain fields', () => {
    const yes = render(buildSegmentWhere([rule({ field: 'phone', op: 'exists' })], 'all'));
    expect(yes).toContain('is not null');
    const no = render(buildSegmentWhere([rule({ field: 'phone', op: 'not_exists' })], 'all'));
    expect(no).toContain('is null');
  });
});
