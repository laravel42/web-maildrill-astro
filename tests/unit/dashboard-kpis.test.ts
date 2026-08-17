import { describe, expect, it } from 'vitest';
import { buildKpis, type Summary } from '@/components/react/AppDashboard.logic';

const DAYS = 365;

/* Entry 0's calendar date, as the server ships it. Fixed, not derived from the
   clock this test runs on: the point of the anchor is that the labels do not
   depend on the reader's zone. `SINCE` + 364 days = 2026-08-17. */
const SINCE = '2025-08-18';

/** A daily series of `DAYS` entries, newest last, filled by a per-index rule. */
function series(fill: (daysAgo: number) => number): number[] {
  return Array.from({ length: DAYS }, (_, i) => fill(DAYS - 1 - i));
}

function summaryWith(trends: Partial<Summary['trends']> = {}): Summary {
  return {
    subscribers: { total: 1000, active: 900 },
    lists: 10,
    campaigns: { total: 20, sent: 12 },
    messages: {
      total: 500,
      delivered: 400,
      trackedDelivered: 200,
      failed: 50,
      sentToday: 5,
      opened: 100,
      clicked: 8,
    },
    trends: {
      since: SINCE,
      subscribers: series(() => 0),
      lists: series(() => 0),
      campaigns: series(() => 0),
      trackedDelivered: series(() => 0),
      opened: series(() => 0),
      clicked: series(() => 0),
      ...trends,
    },
  };
}

const card = (s: Summary, days: number, key: string) =>
  buildKpis(s, [], days).find((k) => k.key === key)!;

describe('buildKpis window', () => {
  it('slices exactly the days the range names, not the nearest whole weeks', () => {
    // 1 signup per day, every day. A correct 30-day window sums to 30; the
    // weekly-rounded window this replaced summed 28.
    const s = summaryWith({ subscribers: series(() => 1) });
    expect(card(s, 7, 'subscribers').value).toBe('7');
    expect(card(s, 30, 'subscribers').value).toBe('30');
    expect(card(s, 90, 'subscribers').value).toBe('90');
    expect(card(s, 365, 'subscribers').value).toBe('365');
  });

  it('compares against the equally-sized window immediately before it', () => {
    // 2/day inside the last 30, 1/day for the 30 before that: +100%.
    const s = summaryWith({ subscribers: series((ago) => (ago < 30 ? 2 : 1)) });
    expect(card(s, 30, 'subscribers').value).toBe('60');
    expect(card(s, 30, 'subscribers').delta).toBe('↑ 100.0%');
  });

  it('has no prior window to compare a 12-month range against', () => {
    const s = summaryWith({ subscribers: series(() => 1) });
    expect(card(s, 365, 'subscribers').delta).toBe('—');
  });
});

describe('buildKpis rate cards', () => {
  it('divides the window sums rather than averaging daily rates', () => {
    // Day A: 1 of 100 opened. Day B: 9 of 10. The window rate is 10/110 = 9.1%,
    // while a mean of the two daily rates would read 45.5%.
    const s = summaryWith({
      trackedDelivered: series((ago) => (ago === 0 ? 10 : ago === 1 ? 100 : 0)),
      opened: series((ago) => (ago === 0 ? 9 : ago === 1 ? 1 : 0)),
    });
    expect(card(s, 7, 'open').value).toBe('9.1%');
  });

  it('states the delta in percentage points, not as a relative change', () => {
    // 50% this week against 25% last week: 25 points, not 100%.
    const s = summaryWith({
      trackedDelivered: series(() => 100),
      opened: series((ago) => (ago < 7 ? 50 : 25)),
    });
    expect(card(s, 7, 'open').value).toBe('50.0%');
    expect(card(s, 7, 'open').delta).toBe('↑ 25.0pp');
  });

  it('never plots a spark point above 100%', () => {
    // The defect this replaces divided all-channel reads by tracked
    // deliveries; both sides now come from the same set, so each point is a
    // real rate of its own day.
    const s = summaryWith({
      trackedDelivered: series(() => 100),
      opened: series((ago) => (ago % 2 === 0 ? 100 : 40)),
    });
    for (const point of card(s, 30, 'open').spark) {
      expect(point.value).toBeLessThanOrEqual(100);
    }
  });

  it('drops days that delivered nothing trackable instead of plotting 0%', () => {
    const s = summaryWith({
      trackedDelivered: series((ago) => (ago % 2 === 0 ? 100 : 0)),
      opened: series((ago) => (ago % 2 === 0 ? 50 : 0)),
    });
    const spark = card(s, 30, 'open').spark;
    expect(spark).toHaveLength(15);
    expect(spark.every((p) => p.value === 50)).toBe(true);
  });

  it('reports no rate at all for a window that measured nothing', () => {
    const s = summaryWith({ trackedDelivered: series(() => 0), opened: series(() => 0) });
    expect(card(s, 7, 'open').value).toBe('—');
    expect(card(s, 7, 'open').delta).toBe('No deliveries yet');
  });

  it('prints the all-time tracked opens the rate is built from as context', () => {
    const s = summaryWith({ trackedDelivered: series(() => 10), opened: series(() => 5) });
    expect(card(s, 7, 'open').context).toBe('100 total opens');
  });
});

describe('buildKpis sparklines', () => {
  it('plots the same quantity the headline prints, not a running total', () => {
    const s = summaryWith({ subscribers: series((ago) => (ago === 0 ? 5 : 1)) });
    const kpi = card(s, 7, 'subscribers');
    expect(kpi.value).toBe('11');
    expect(kpi.spark).toHaveLength(7);
    // Per-day adds: flat at 1 with today's 5 on the end. A cumulative series
    // would rise monotonically and end near the workspace total instead.
    expect(kpi.spark.map((p) => p.value)).toEqual([1, 1, 1, 1, 1, 1, 5]);
  });

  it('draws nothing when the window is entirely empty', () => {
    expect(card(summaryWith(), 7, 'subscribers').spark).toEqual([]);
  });

  it("labels points with the server's dates, not the reader's calendar", () => {
    // The series has no dates of its own; only `trends.since` says which day
    // entry 0 is. Reconstructing from the reader's midnight instead labelled
    // every point a day late for any viewer ahead of the host.
    const s = summaryWith({ subscribers: series(() => 1) });
    expect(card(s, 7, 'subscribers').spark.map((p) => p.label)).toEqual([
      'Aug 11',
      'Aug 12',
      'Aug 13',
      'Aug 14',
      'Aug 15',
      'Aug 16',
      'Aug 17',
    ]);
  });

  it('labels a rate spark from the same anchor, gaps included', () => {
    // Only every other day delivered anything, so the surviving points must
    // still carry their own dates rather than a compacted run.
    const s = summaryWith({
      trackedDelivered: series((ago) => (ago % 2 === 0 ? 100 : 0)),
      opened: series((ago) => (ago % 2 === 0 ? 50 : 0)),
    });
    expect(card(s, 7, 'open').spark.map((p) => p.label)).toEqual([
      'Aug 11',
      'Aug 13',
      'Aug 15',
      'Aug 17',
    ]);
  });

  it('omits the spark entirely when the payload carries no anchor', () => {
    // A cache entry written before the anchor existed. No line beats a line
    // dated from the wrong calendar.
    const s = summaryWith({ subscribers: series(() => 1) });
    delete (s.trends as { since?: string }).since;
    expect(card(s, 7, 'subscribers').spark).toEqual([]);
  });
});
