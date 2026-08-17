import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildListDetailView,
  type ApiListChannelTotals,
  type ApiListStats,
} from '@/lib/app/list-detail';

/**
 * `weeklyJoins` as the API sends it: the week edges it counted over, and the
 * label it named each one with.
 *
 * The edges are literal instants rather than ones this process derives, because
 * that is the situation the label has to survive — they are Mondays 00:00 in
 * the API's zone (UTC−6 here), which is not the zone the test, or a viewer,
 * runs in. Deriving `W…` from them locally reads the Sunday before whenever the
 * reader is further west, which is the bug these fixtures now pin.
 */
const weeksFrom = (joins: number[]): ApiListStats['weeklyJoins'] => {
  const WEEK = 7 * 86_400_000;
  const lastMonday = Date.parse('2026-08-10T06:00:00.000Z'); // W33
  return joins.map((n, i) => ({
    weekStart: new Date(lastMonday - (joins.length - 1 - i) * WEEK).toISOString(),
    label: `W${33 - (joins.length - 1 - i)}`,
    joins: n,
  }));
};

/* Four members: two active, one unsubscribed, one bounced — and one of the
   four carrying a `city` value. Counted by SQL over the whole list now, so the
   fixture states the counts rather than a member array to tally. */
const list: ApiListStats = {
  id: 'list-1',
  name: 'Newsletter',
  memberCount: 4,
  addedLast7: 3,
  addedPrev7: 2,
  createdAt: '2026-02-12T10:00:00Z',
  statusCounts: { active: 2, unsubscribed: 1, failed: 1, bounced: 1, complained: 0 },
  weeklyJoins: weeksFrom([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]),
  fieldFill: [{ key: 'city', filled: 1 }],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('buildListDetailView', () => {
  it('buckets member statuses into the health segments', () => {
    const v = buildListDetailView(list, [], [], []);
    const byKey = Object.fromEntries(v.health.map((h) => [h.key, h]));
    expect(byKey.active.value).toBe(2);
    expect(byKey.active.pct).toBe(50);
    expect(byKey.unsubscribed.value).toBe(1);
    expect(byKey.failed.value).toBe(1);
    expect(byKey.delivered).toBeUndefined();
    expect(byKey.unconfirmed).toBeUndefined();
    expect(byKey.bounced).toBeUndefined();
    expect(v.total).toBe(4);
  });

  /* The bug this file's fixtures used to encode: the page derived these from
     `members?limit=1000`, so a list bigger than the cap described its sample.
     Every share now divides by the member count the server measured. */
  it('divides every share by the whole membership, not a page of it', () => {
    const v = buildListDetailView(
      {
        ...list,
        memberCount: 2000,
        statusCounts: { active: 997, unsubscribed: 0, failed: 1003, bounced: 783, complained: 219 },
        fieldFill: [{ key: 'city', filled: 500 }],
      },
      [],
      [{ id: 'f1', key: 'city', label: 'City', type: 'text' }],
      [],
    );
    const byKey = Object.fromEntries(v.health.map((h) => [h.key, h]));
    expect(byKey.active.value).toBe(997);
    expect(byKey.failed.value).toBe(1003);
    expect(byKey.active.pct).toBe(49.9);
    expect(v.deliverableLabel).toBe('49.9%');
    expect(v.bounceRate).toBe('39.15%');
    expect(v.complaintRate).toBe('10.95%');
    expect(v.fields[0]!.fillPct).toBe(25);
  });

  /* Rates come from `channelTotals` — SQL over the list's whole campaign
     history — not from the campaign strip, which is one page of it. Passing a
     campaign the strip happens to hold must not move them. */
  it('reports delivery and failed rates from the server channel totals', () => {
    const strip = [
      {
        id: 'c1',
        name: 'Spring',
        channel: 'email' as const,
        status: 'sent',
        recipients: 100,
        delivered: 92,
        failed: 8,
      },
    ];
    expect(buildListDetailView(list, strip, [], []).deliveredRate).toBe('—');

    const totals = (over: Partial<ApiListChannelTotals>): ApiListStats => ({
      ...list,
      channelTotals: [
        {
          channel: 'email',
          attempted: 100,
          delivered: 92,
          opened: 0,
          clicked: 0,
          failed: 0,
          ...over,
        },
      ],
    });
    const clean = buildListDetailView(totals({}), strip, [], []);
    expect(clean.deliveredRate).toBe('92.00%');
    expect(clean.failedRate).toBe('0.00%');

    const withFail = buildListDetailView(totals({ failed: 8 }), strip, [], []);
    expect(withFail.failedRate).toBe('8.00%');
    expect(withFail.unsubRate).toBe('25.00%');
  });

  it('states the whole each rail percentage is a share of', () => {
    /* Three percentages, two denominators. "Delivery rate" and "Failed rate"
       divide by messages attempted; "Unsubscribed" divides by the roster. Perf
       list 877 read "Delivery rate 100.00% / Failed rate 0.00% / Unsubscribe
       rate 50.00%" — the last being 1,000 of 2,000 MEMBERS, against zero
       unsubscribe events on its 1,176 sends. The bases are what stop the three
       reading as one series. */
    const v = buildListDetailView(
      {
        ...list,
        channelTotals: [
          { channel: 'email', attempted: 100, delivered: 92, opened: 0, clicked: 0, failed: 8 },
        ],
      },
      [],
      [],
      [],
    );
    expect(v.sendBasis).toBe('of 100 sent');
    expect(v.rosterBasis).toBe('of 4 members');
  });

  it('says so when there is no whole to divide by', () => {
    const v = buildListDetailView(
      { id: 'list-3', name: 'Nobody', memberCount: 0, createdAt: '2026-02-12T10:00:00Z' },
      [],
      [],
      [],
    );
    expect(v.sendBasis).toBe('nothing sent yet');
    expect(v.rosterBasis).toBe('no members yet');
    expect(v.unsubRate).toBe('—');
    expect(v.deliveredRate).toBe('—');
  });

  it('labels weekly growth with its direction', () => {
    expect(buildListDetailView(list, [], [], []).growthLabel).toBe('+50.0% this week');
    const down = buildListDetailView({ ...list, addedLast7: 1, addedPrev7: 2 }, [], [], []);
    expect(down.growthLabel).toBe('−50.0% this week');
    expect(down.growthUp).toBe(false);
  });

  it('renders one bar per week the server counted, with silent leave bars', () => {
    const v = buildListDetailView(list, [], [], []);
    expect(v.weeks).toHaveLength(12);
    expect(v.weeks.reduce((n, w) => n + w.joins, 0)).toBe(4);
    expect(v.weeks.every((w) => w.left === 0)).toBe(true);
    expect(v.weeks.at(-1)!.label).toMatch(/^W\d+$/);
  });

  /* `weekStart` is an instant, so deriving the label from it here read the
     viewer's calendar rather than the API's: west of the API every bar was
     labelled one ISO week early — under counts taken over the API's Mondays —
     and the SSR'd markup no longer matched what hydration produced. The label
     is the API's own now, so the same payload names the same weeks in every
     zone. */
  it('names each bar with the API label, whatever zone the viewer is in', () => {
    const weeks = weeksFrom([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4])!;
    const labels = buildListDetailView({ ...list, weeklyJoins: weeks }, [], [], []).weeks.map(
      (w) => w.label,
    );
    expect(labels).toEqual(weeks.map((w) => w.label));
    expect(labels).toEqual([
      'W22',
      'W23',
      'W24',
      'W25',
      'W26',
      'W27',
      'W28',
      'W29',
      'W30',
      'W31',
      'W32',
      'W33',
    ]);
  });

  it('reads an empty list as empty rather than as unknown', () => {
    const v = buildListDetailView(
      { id: 'list-2', name: 'Nobody', memberCount: 0, createdAt: '2026-02-12T10:00:00Z' },
      [],
      [{ id: 'f1', key: 'city', label: 'City', type: 'text' }],
      [],
    );
    expect(v.total).toBe(0);
    expect(v.deliverableLabel).toBe('—');
    expect(v.unsubRate).toBe('—');
    expect(v.health.every((h) => h.value === 0 && h.pct === 0)).toBe(true);
    expect(v.weeks).toHaveLength(0);
    expect(v.fields[0]!.fillPct).toBe(0);
  });

  it('embeds the real list id in the signup snippet', () => {
    const v = buildListDetailView(list, [], [], []);
    expect(v.embedSnippet).toContain('list-1');
  });

  it('computes field fill rates from the whole membership', () => {
    const v = buildListDetailView(
      list,
      [],
      [
        { id: 'f1', key: 'city', label: 'City', type: 'text' },
        { id: 'f2', key: 'dob', label: 'Dob', type: 'date' },
      ],
      [],
    );
    expect(v.fields.find((f) => f.key === 'city')!.fillPct).toBe(25);
    // A field the rollup returned no count for is 0% filled, not missing.
    expect(v.fields.find((f) => f.key === 'dob')!.fillPct).toBe(0);
  });
});
