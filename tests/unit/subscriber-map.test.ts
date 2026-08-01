import { describe, expect, it } from 'vitest';
import { toRichSubscriber, type ApiSubscriber } from '@/lib/app/subscriber-map';

const base: ApiSubscriber = { id: 's1', email: 'ada@example.com', status: 'active' };

describe('toRichSubscriber', () => {
  it('folds unknown statuses (complained) into unsubscribed', () => {
    expect(toRichSubscriber({ ...base, status: 'complained' }).status).toBe('unsubscribed');
    expect(toRichSubscriber({ ...base, status: 'weird' }).status).toBe('unsubscribed');
    expect(toRichSubscriber({ ...base, status: 'bounced' }).status).toBe('bounced');
    expect(toRichSubscriber(base).status).toBe('active');
  });

  it('falls back to the email when the name is empty', () => {
    expect(toRichSubscriber(base).name).toBe('ada@example.com');
    expect(toRichSubscriber({ ...base, name: 'Ada' }).name).toBe('Ada');
  });

  it('prefers relational tags over the legacy attributes blob', () => {
    const withBoth = toRichSubscriber({
      ...base,
      tagNames: ['vip'],
      attributes: { tags: ['legacy'] },
    });
    expect(withBoth.tags).toEqual(['vip']);
    const legacyOnly = toRichSubscriber({ ...base, attributes: { tags: ['legacy'] } });
    expect(legacyOnly.tags).toEqual(['legacy']);
  });

  it('rates use the tracked-delivery denominator and dash when empty', () => {
    const engaged = toRichSubscriber({
      ...base,
      delivered: 20,
      trackedDelivered: 10,
      opened: 5,
      clicked: 1,
    });
    expect(engaged.opens).toBe('50%');
    expect(engaged.clicks).toBe('10%');
    expect(toRichSubscriber(base).opens).toBe('—');
  });

  it('assigns a deterministic avatar gradient per id', () => {
    const a = toRichSubscriber(base).av;
    const b = toRichSubscriber(base).av;
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    expect(a[0]).toMatch(/^#/);
  });

  it('maps list names and ids in parallel', () => {
    const row = toRichSubscriber({
      ...base,
      lists: [
        { id: 'l1', name: 'News' },
        { id: 'l2', name: 'VIP' },
      ],
    });
    expect(row.lists).toEqual(['News', 'VIP']);
    expect(row.listIds).toEqual(['l1', 'l2']);
  });
});
