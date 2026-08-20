import { describe, expect, it } from 'vitest';
import {
  eventRateSeries,
  type CampaignEventPoint,
} from '@/components/react/shared/campaign-events';

const pt = (over: Partial<CampaignEventPoint>): CampaignEventPoint => ({
  at: '2026-07-01T10:00:00Z',
  delivered: 0,
  opened: 0,
  clicked: 0,
  unsubscribed: 0,
  ...over,
});

describe('eventRateSeries', () => {
  it('uses recipients for delivery and delivered-so-far for open/click', () => {
    const series = eventRateSeries(
      [
        pt({ at: '2026-07-01T10:00:00Z', delivered: 2 }),
        pt({ at: '2026-07-01T10:02:00Z', delivered: 3, opened: 1 }),
        pt({ at: '2026-07-01T10:03:00Z', delivered: 4, opened: 2, clicked: 1 }),
      ],
      10,
    );

    const last = <T>(arr: T[]) => arr[arr.length - 1]!;
    // 4 of 10 recipients reached a delivered+ stage → 40% delivery.
    expect(last(series.delivery).value).toBe(40);
    // 2 of 4 delivered opened → 50% open (not 20% of recipients).
    expect(last(series.open).value).toBe(50);
    // 1 of 4 delivered clicked → 25% click.
    expect(last(series.click).value).toBe(25);
  });

  it('seeds a zero point so a single-bucket campaign still draws', () => {
    const series = eventRateSeries([pt({ delivered: 5 })], 5);
    expect(series.delivery).toHaveLength(2);
    expect(series.delivery[0]!.value).toBe(0);
    expect(series.delivery[1]!.value).toBe(100);
  });

  it('is empty when the campaign has no messages', () => {
    expect(eventRateSeries([], 0).delivery).toEqual([]);
  });
});
