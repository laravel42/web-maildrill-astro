import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildSubscriberDetailView,
  scoreArcLength,
  subscriberFrequency,
  type ApiSubscriberActivity,
} from '@/lib/app/subscriber-detail';
import type { RichSubscriber } from '@/lib/app/subscribers-data';

const sub = (over: Partial<RichSubscriber> = {}): RichSubscriber => ({
  id: 'sub-1',
  email: 'ada@example.com',
  phone: '',
  name: 'Ada Lovelace',
  status: 'active',
  lists: [],
  listIds: [],
  tags: [],
  updatedAt: '2026-07-30T12:00:00Z',
  createdAt: '2026-01-31T12:00:00Z', // six months before the frozen clock
  location: '—',
  joined: 'Jan 31, 2026',
  opens: '—',
  clicks: '—',
  av: ['#818cf8', '#4f46e5'],
  ...over,
});

const activity: ApiSubscriberActivity = {
  lastActiveAt: '2026-07-31T09:00:00Z',
  channels: [
    { channel: 'email', sent: 10, delivered: 8, read: 4, clicked: 2 },
    { channel: 'sms', sent: 2, delivered: 2, read: 0, clicked: 0 },
  ],
  recent: [
    {
      id: 'm1',
      channel: 'email',
      status: 'read',
      campaignName: 'July digest',
      at: '2026-07-30T10:00:00Z',
    },
    {
      id: 'm2',
      channel: 'email',
      status: 'failed',
      campaignName: 'Promo',
      at: '2026-07-20T10:00:00Z',
    },
    {
      id: 'm3',
      channel: 'whatsapp',
      status: 'delivered',
      campaignName: null,
      at: '2026-06-01T10:00:00Z',
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-31T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('buildSubscriberDetailView', () => {
  it('computes open/click rates over all delivered messages', () => {
    const v = buildSubscriberDetailView(sub(), activity);
    expect(v.openRate).toBe(40); // 4 / 10 delivered
    expect(v.clickRate).toBe(20); // 2 / 10 delivered
  });

  it('falls back to sent when nothing is delivered yet', () => {
    const v = buildSubscriberDetailView(sub(), {
      channels: [{ channel: 'email', sent: 4, delivered: 0, read: 1, clicked: 0 }],
    });
    expect(v.openRate).toBe(25);
  });

  it('scores engagement and names the tier', () => {
    const v = buildSubscriberDetailView(sub(), activity);
    // 40 * 0.7 + 20 * 1.2 = 52 → moderately engaged
    expect(v.score).toBe(52);
    expect(v.scoreTier).toBe('Moderately engaged');
    const none = buildSubscriberDetailView(sub(), null);
    expect(none.score).toBe(0);
    expect(none.scoreTier).toBe('No engagement yet');
  });

  it('maps recent messages onto typed events', () => {
    const v = buildSubscriberDetailView(sub(), activity);
    expect(v.events.map((e) => e.type)).toEqual(['open', 'life', 'send']);
    expect(v.events[0].title).toBe('Opened July digest');
    expect(v.events[1].title).toBe('Delivery issue on Promo');
    expect(v.events[2].title).toBe('Received message');
  });

  it('labels campaign outcomes with their result color', () => {
    const v = buildSubscriberDetailView(sub(), activity);
    expect(v.campaigns[0]).toMatchObject({ result: 'Opened', resultColor: '#16a34a' });
    expect(v.campaigns[1]).toMatchObject({ result: 'Failed', resultColor: '#dc2626' });
    expect(v.campaigns[2]).toMatchObject({ name: 'Untitled campaign', result: 'Delivered' });
  });

  it('filters tags and notes out of the custom-field grid', () => {
    const v = buildSubscriberDetailView(sub(), null, {
      plan: 'pro',
      empty: '',
      listy: ['a', 'b'],
      tags: ['x'],
      notes: 'private',
    });
    expect(v.fields).toEqual([
      { key: 'plan', value: 'pro' },
      { key: 'empty', value: '—' },
      { key: 'listy', value: 'a, b' },
    ]);
  });

  it('falls back to twelve empty weeks without a weekly series', () => {
    const v = buildSubscriberDetailView(sub(), null);
    expect(v.weeks).toHaveLength(12);
    expect(v.weeks.every((w) => w.opens === 0 && w.clicks === 0)).toBe(true);
  });

  it('derives the month-over-month delta from the weekly series', () => {
    const weekly = Array.from({ length: 12 }, (_, i) => ({
      label: `W${30 + i}`,
      weekStart: '',
      opens: i >= 8 ? 3 : 1, // last 4 weeks: 12 events; previous 4: 4
      clicks: 0,
    }));
    const v = buildSubscriberDetailView(sub(), { ...activity, weekly });
    expect(v.scoreDeltaLabel).toBe('+8 vs. last month');
    const silent = buildSubscriberDetailView(sub(), null);
    expect(silent.scoreDeltaLabel).toBeNull();
  });

  it('derives frequency from tenure and counts the last 30 days of sends', () => {
    const v = buildSubscriberDetailView(sub(), activity);
    // 10 emails over ~6 months ≈ 1.7 / mo
    expect(v.frequencyLabel).toMatch(/\/ mo$/);
    expect(Number.parseFloat(v.frequencyLabel)).toBeGreaterThan(1);
    expect(Number.parseFloat(v.frequencyLabel)).toBeLessThan(2.5);
    expect(v.sentLast30).toBe(2); // m1 + m2 fall inside the window, m3 does not
    expect(v.deliveryRate).toBeCloseTo(83.3, 1); // 10 delivered of 12 sent
    expect(v.lastCampaignLabel).not.toBe('—');
  });

  it('scopes frequency to the selected channel send volume', () => {
    // Same tenure as the fixture (~6 months). 3 SMS sends → ~0.5 / mo.
    const sms = subscriberFrequency(3, sub().createdAt);
    expect(sms.label).toMatch(/\/ mo$/);
    expect(Number.parseFloat(sms.label)).toBeGreaterThan(0.3);
    expect(Number.parseFloat(sms.label)).toBeLessThan(0.7);
    expect(sms.pct).toBeLessThan(20);
    // Zero sends on a channel reads as 0.0 / mo, not the email rate.
    expect(subscriberFrequency(0, sub().createdAt).label).toBe('0.0 / mo');
  });
});

describe('scoreArcLength', () => {
  it('maps 0–100 onto the ring circumference', () => {
    const c = 2 * Math.PI * 41;
    expect(scoreArcLength(0)).toBe('0.0 999');
    expect(scoreArcLength(100)).toBe(`${c.toFixed(1)} 999`);
    expect(scoreArcLength(50)).toBe(`${(c / 2).toFixed(1)} 999`);
    expect(scoreArcLength(150)).toBe(`${c.toFixed(1)} 999`); // clamped
  });
});
