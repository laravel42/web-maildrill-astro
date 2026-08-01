import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildListDetailView, type ApiListMember } from '@/lib/app/list-detail';
import type { ApiList } from '@/lib/app/list-map';

const list: ApiList = {
  id: 'list-1',
  name: 'Newsletter',
  memberCount: 4,
  addedLast7: 3,
  addedPrev7: 2,
  createdAt: '2026-02-12T10:00:00Z',
};

const member = (over: Partial<ApiListMember>): ApiListMember =>
  ({
    id: 'm-x',
    email: 'x@example.com',
    name: null,
    status: 'active',
    createdAt: '2026-07-01T10:00:00Z',
    joinedAt: '2026-07-01T10:00:00Z',
    attributes: {},
    ...over,
  }) as ApiListMember;

const members: ApiListMember[] = [
  member({ id: 'm1', email: 'a@x.com', name: 'Ada Lovelace', status: 'active' }),
  member({ id: 'm2', email: 'b@x.com', status: 'active', attributes: { city: 'Rome' } }),
  member({ id: 'm3', email: 'c@x.com', status: 'unsubscribed' }),
  member({ id: 'm4', email: 'd@x.com', status: 'bounced' }),
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('buildListDetailView', () => {
  it('buckets member statuses into the health segments', () => {
    const v = buildListDetailView(list, members, [], [], []);
    const byKey = Object.fromEntries(v.health.map((h) => [h.key, h]));
    expect(byKey.active.value).toBe(2);
    expect(byKey.active.pct).toBe(50);
    expect(byKey.unsubscribed.value).toBe(1);
    expect(byKey.bounced.value).toBe(1);
    expect(byKey.unconfirmed.value).toBe(0); // no such backend status
    expect(v.total).toBe(4);
    expect(v.sampled).toBe(false);
  });

  it('scales sampled shares up to the real member count when capped', () => {
    const v = buildListDetailView({ ...list, memberCount: 400 }, members, [], [], []);
    expect(v.sampled).toBe(true);
    const active = v.health.find((h) => h.key === 'active')!;
    expect(active.value).toBe(200); // 50% of 400
    expect(active.pct).toBe(50);
  });

  it('labels weekly growth with its direction', () => {
    expect(buildListDetailView(list, members, [], [], []).growthLabel).toBe('+50.0% this week');
    const down = buildListDetailView({ ...list, addedLast7: 1, addedPrev7: 2 }, [], [], [], []);
    expect(down.growthLabel).toBe('−50.0% this week');
    expect(down.growthUp).toBe(false);
  });

  it('buckets joins into trailing ISO weeks with silent leave bars', () => {
    const v = buildListDetailView(list, members, [], [], []);
    expect(v.weeks).toHaveLength(12);
    expect(v.weeks.reduce((n, w) => n + w.joins, 0)).toBe(4);
    expect(v.weeks.every((w) => w.left === 0)).toBe(true);
    expect(v.weeks.at(-1)!.label).toMatch(/^W\d+$/);
  });

  it('builds roster rows with initials, email fallback and status meta', () => {
    const v = buildListDetailView(list, members, [], [], []);
    expect(v.roster[0]).toMatchObject({ initials: 'AL', name: 'Ada Lovelace' });
    expect(v.roster[1].name).toBe('b@x.com');
    expect(v.roster[2].statusLabel).toBe('Unsubscribed');
    expect(v.rosterCounts.all).toBe(4);
    expect(v.rosterCounts.active).toBe(2);
  });

  it('embeds the real list id in the signup snippet', () => {
    const v = buildListDetailView(list, members, [], [], []);
    expect(v.embedSnippet).toContain('list-1');
  });

  it('computes field fill rates from loaded member attributes', () => {
    const v = buildListDetailView(
      list,
      members,
      [],
      [{ id: 'f1', key: 'city', label: 'City', type: 'text' }],
      [],
    );
    const city = v.fields.find((f) => f.key === 'city')!;
    expect(city.fillPct).toBe(25); // 1 of 4 members carries it
  });
});
