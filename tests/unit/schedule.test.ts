import { describe, expect, it } from 'vitest';
import {
  isScheduleTimeSlotDisabled,
  isScheduledInFuture,
  minScheduleTimeForDate,
  nextValidScheduleTime,
  scheduleTimeOptions,
} from '@/lib/app/schedule';

const noon = new Date(2026, 6, 22, 12, 0, 0); // Jul 22 2026 12:00 local

describe('schedule time slot helpers', () => {
  it('enables all window slots for a future date', () => {
    const date = '2026-08-01' as const;
    for (const slot of scheduleTimeOptions()) {
      expect(isScheduleTimeSlotDisabled(date, slot, noon)).toBe(false);
    }
    expect(minScheduleTimeForDate(date, noon)).toBe('08:00');
  });

  it('disables past slots on today', () => {
    const date = '2026-07-22' as const;
    expect(isScheduleTimeSlotDisabled(date, '08:00', noon)).toBe(true);
    expect(isScheduleTimeSlotDisabled(date, '12:00', noon)).toBe(true);
    expect(isScheduleTimeSlotDisabled(date, '12:30', noon)).toBe(false);
    expect(nextValidScheduleTime(date, noon)).toBe('12:30');
    expect(minScheduleTimeForDate(date, noon)).toBe('12:30');
  });

  it('disables slots at or before now on today', () => {
    const date = '2026-07-22' as const;
    const exactlyNoon = new Date(2026, 6, 22, 12, 0, 0);
    expect(isScheduledInFuture(date, '12:00', exactlyNoon)).toBe(false);
    expect(isScheduleTimeSlotDisabled(date, '12:00', exactlyNoon)).toBe(true);
    expect(nextValidScheduleTime(date, exactlyNoon)).toBe('12:30');
  });

  it('returns null when every slot on today is in the past', () => {
    const date = '2026-07-22' as const;
    const late = new Date(2026, 6, 22, 22, 30, 0);
    expect(nextValidScheduleTime(date, late)).toBeNull();
    expect(minScheduleTimeForDate(date, late)).toBeNull();
    expect(isScheduleTimeSlotDisabled(date, '22:00', late)).toBe(true);
  });
});
