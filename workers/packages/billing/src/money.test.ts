import { describe, expect, it } from 'vitest';
import {
  applyDiscountBps,
  assertMicro,
  bpsToPercent,
  centsToMicro,
  formatMicroUsd,
  microToUsd,
  usdToMicro,
} from './money';

describe('money', () => {
  it('converts between USD, cents, and micro exactly', () => {
    expect(usdToMicro(1)).toBe(1_000_000);
    expect(usdToMicro(0.0005)).toBe(500); // the email rate stays exact
    expect(centsToMicro(2500)).toBe(25_000_000);
    expect(microToUsd(25_000_000)).toBe(25);
  });

  it('rejects non-integer micro amounts', () => {
    expect(() => assertMicro(1.5)).toThrow(TypeError);
    expect(() => assertMicro(Number.MAX_SAFE_INTEGER + 1)).toThrow(TypeError);
    expect(assertMicro(42)).toBe(42);
  });

  it('applies basis-point discounts with stable rounding', () => {
    expect(applyDiscountBps(1_000_000, 0)).toBe(1_000_000);
    expect(applyDiscountBps(1_000_000, 1000)).toBe(900_000); // 10%
    expect(applyDiscountBps(1_000_000, 3000)).toBe(700_000); // 30%
    expect(applyDiscountBps(500, 2000)).toBe(400); // sub-cent unit price
    expect(applyDiscountBps(1_000_000, 10_000)).toBe(0); // 100%
    expect(applyDiscountBps(1_000_000, 15_000)).toBe(0); // clamped
    expect(applyDiscountBps(1_000_000, -500)).toBe(1_000_000); // negative = none
  });

  it('formats display values', () => {
    expect(formatMicroUsd(1_234_500, 4)).toBe('1.2345');
    expect(formatMicroUsd(25_000_000)).toBe('25.00');
    expect(bpsToPercent(1500)).toBe('15%');
    expect(bpsToPercent(1550)).toBe('15.5%');
  });
});
