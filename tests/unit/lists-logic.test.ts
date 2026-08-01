import { describe, expect, it } from 'vitest';
import { fmtPct, trendPath, weeklyGain } from '@/components/react/AppLists.logic';

describe('fmtPct', () => {
  it('renders signed arrows with one decimal', () => {
    expect(fmtPct(4.25)).toBe('↑ 4.3%');
    expect(fmtPct(-3.1)).toBe('↓ 3.1%');
    expect(fmtPct(0)).toBe('↑ 0.0%');
  });
});

describe('weeklyGain', () => {
  it('is the delta of the last two points', () => {
    expect(weeklyGain([100, 120, 150])).toBe(30);
    expect(weeklyGain([100, 80])).toBe(-20);
  });

  it('is zero without enough points', () => {
    expect(weeklyGain([])).toBe(0);
    expect(weeklyGain([42])).toBe(0);
  });
});

describe('trendPath', () => {
  it('spans the padded box from min to max', () => {
    const { line, area, last } = trendPath([0, 10], 100, 50, 5);
    // First point: bottom-left of the inner box; last point: top-right.
    expect(line).toBe('5.0,45.0 95.0,5.0');
    expect(last[0]).toBeCloseTo(95);
    expect(last[1]).toBeCloseTo(5);
    // Area closes down to the baseline on both ends.
    expect(area.startsWith('5,45 ')).toBe(true);
    expect(area.endsWith(' 95,45')).toBe(true);
  });

  it('centers a single point and survives a flat series', () => {
    const single = trendPath([7], 100, 50);
    expect(single.last[0]).toBeCloseTo(50);
    const flat = trendPath([5, 5, 5], 100, 50);
    // Flat range guards against division by zero; all Ys equal.
    const ys = flat.line.split(' ').map((p) => Number(p.split(',')[1]));
    expect(new Set(ys).size).toBe(1);
  });
});
