import { describe, expect, it } from 'vitest';
import {
  applyAxisPreset,
  axisPresetValue,
  AXIS_PRESET_PX,
  parseSides,
  serializeSides,
} from '@/builder/inspector/panel/controls/SidesGrid';

// Presets sm/md/lg por eje (packages/builder42/docs/spacing-simple-presets-plan.md).
// Cubre las funciones puras que alimentan `SidesAxisPresets` — sin React/DOM,
// mismo criterio que el resto de `SidesGrid.tsx` (parseSides/serializeSides).

describe('AXIS_PRESET_PX', () => {
  it('matches the BASE_TOKENS.spacing scale (sm/md/lg)', () => {
    expect(AXIS_PRESET_PX).toEqual({ sm: '8px', md: '16px', lg: '24px' });
  });
});

describe('applyAxisPreset', () => {
  it('sets both sides of the X axis (left+right), leaving Y untouched', () => {
    const sides = parseSides('4px 8px 4px 8px'); // top right bottom left
    const next = applyAxisPreset(sides, 'x', 'lg');
    expect(next.left).toEqual({ num: 24, unit: 'px' });
    expect(next.right).toEqual({ num: 24, unit: 'px' });
    expect(next.top).toEqual({ num: 4, unit: 'px' });
    expect(next.bottom).toEqual({ num: 4, unit: 'px' });
  });

  it('sets both sides of the Y axis (top+bottom), leaving X untouched', () => {
    const sides = parseSides('4px 8px 4px 8px');
    const next = applyAxisPreset(sides, 'y', 'sm');
    expect(next.top).toEqual({ num: 8, unit: 'px' });
    expect(next.bottom).toEqual({ num: 8, unit: 'px' });
    expect(next.left).toEqual({ num: 8, unit: 'px' });
    expect(next.right).toEqual({ num: 8, unit: 'px' });
  });

  it('round-trips through serializeSides into a compact shorthand', () => {
    const sides = parseSides('');
    const withX = applyAxisPreset(sides, 'x', 'md');
    const withY = applyAxisPreset(withX, 'y', 'md');
    expect(serializeSides(withY)).toBe('16px');
  });

  it('produces an asymmetric shorthand when axes differ', () => {
    const sides = parseSides('');
    const withX = applyAxisPreset(sides, 'x', 'sm');
    const withY = applyAxisPreset(withX, 'y', 'lg');
    expect(serializeSides(withY)).toBe('24px 8px');
  });
});

describe('axisPresetValue', () => {
  it('reads back the active preset for a uniform axis', () => {
    const sides = parseSides('16px 8px 16px 8px'); // top right bottom left
    expect(axisPresetValue(sides, 'y')).toBe('md');
    expect(axisPresetValue(sides, 'x')).toBe('sm');
  });

  it('returns undefined when the axis sides disagree (edited independently)', () => {
    const sides = parseSides('16px 8px 16px 12px'); // left=12px, right=8px
    expect(axisPresetValue(sides, 'x')).toBeUndefined();
  });

  it('returns undefined for a value outside the sm/md/lg scale', () => {
    const sides = parseSides('37px');
    expect(axisPresetValue(sides, 'x')).toBeUndefined();
    expect(axisPresetValue(sides, 'y')).toBeUndefined();
  });

  it('returns undefined for "auto" (margin-only, non-numeric)', () => {
    const sides = parseSides('0 auto');
    expect(axisPresetValue(sides, 'x')).toBeUndefined();
  });

  it('returns undefined for an empty/zeroed value (no preset matches 0)', () => {
    const sides = parseSides('');
    expect(axisPresetValue(sides, 'x')).toBeUndefined();
    expect(axisPresetValue(sides, 'y')).toBeUndefined();
  });
});
