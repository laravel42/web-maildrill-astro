import { describe, expect, it } from 'vitest';
import { toListRow, type ApiList } from '@/lib/app/list-map';

const base: ApiList = { id: 'l1', name: 'Newsletter' };

describe('toListRow', () => {
  it('applies safe defaults for a bare list', () => {
    const row = toListRow(base);
    expect(row.subscribers).toBe(0);
    expect(row.color).toBe('#4f46e5');
    expect(row.tags).toEqual([]);
    expect(row.notes).toBe('');
    expect(row.trend).toEqual([0]);
    expect(row.openRate).toBe('—');
    expect(row.clickRate).toBe('—');
    expect(row.gdprConsent).toBe(false);
  });

  it('computes growth from the last-7 vs previous-7 windows', () => {
    expect(toListRow({ ...base, addedLast7: 30, addedPrev7: 20 }).growthPct).toBeCloseTo(50);
    expect(toListRow({ ...base, addedLast7: 10, addedPrev7: 0 }).growthPct).toBe(100);
    expect(toListRow({ ...base, addedLast7: 0, addedPrev7: 0 }).growthPct).toBe(0);
    expect(toListRow({ ...base, addedLast7: 5, addedPrev7: 10 }).growthPct).toBeCloseTo(-50);
  });

  it('rates divide by tracked deliveries, not total deliveries', () => {
    const row = toListRow({
      ...base,
      delivered: 200, // includes SMS/voice which can never open
      trackedDelivered: 100,
      opened: 50,
      clicked: 10,
    });
    expect(row.openRate).toBe('50%');
    expect(row.clickRate).toBe('10%');
  });

  it('falls back to delivered when tracked deliveries are absent', () => {
    const row = toListRow({ ...base, delivered: 50, opened: 25 });
    expect(row.openRate).toBe('50%');
  });

  it('shows an em dash when nothing was delivered', () => {
    const row = toListRow({ ...base, opened: 5, clicked: 2 });
    expect(row.openRate).toBe('—');
    expect(row.clickRate).toBe('—');
  });

  it('keeps the weekly "+N" chip and gdpr flag', () => {
    const row = toListRow({ ...base, addedLast7: 12, gdprConsent: true });
    expect(row.more).toBe('+12');
    expect(row.gdprConsent).toBe(true);
  });
});
