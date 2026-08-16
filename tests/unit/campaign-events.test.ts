import { describe, expect, it } from 'vitest';
import {
  buildEventRateSeries,
  type RecipientEvent,
} from '@/components/react/shared/campaign-events';

const ev = (over: Partial<RecipientEvent>): RecipientEvent => ({
  id: 'm1',
  recipientId: 's1',
  name: null,
  address: 'a@x.com',
  channel: 'email',
  status: 'delivered',
  at: '2026-07-01T10:00:00Z',
  ...over,
});

describe('buildEventRateSeries', () => {
  it('uses recipients for delivery and delivered-so-far for open/click', () => {
    const series = buildEventRateSeries(
      [
        ev({ id: '1', status: 'delivered', at: '2026-07-01T10:00:00Z' }),
        ev({ id: '2', status: 'delivered', at: '2026-07-01T10:01:00Z' }),
        ev({ id: '3', status: 'read', at: '2026-07-01T10:02:00Z' }),
        ev({ id: '4', status: 'read', clicked: true, at: '2026-07-01T10:03:00Z' }),
      ],
      10,
      'email',
    );

    const last = <T,>(arr: T[]) => arr[arr.length - 1]!;
    // 4 of 10 recipients reached a delivered+ stage → 40% delivery.
    expect(last(series.delivery).value).toBe(40);
    // 2 of 4 delivered opened → 50% open (not 20% of recipients).
    expect(last(series.open).value).toBe(50);
    // 1 of 4 delivered clicked → 25% click.
    expect(last(series.click).value).toBe(25);
  });
});
