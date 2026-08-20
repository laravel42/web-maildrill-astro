import { describe, expect, it } from 'vitest';
import { quotePackage, quotePrice, resolveChannelPricing, resolveVolumeStep } from './pricing';

const emailPricing = {
  channel: 'email' as const,
  region: 'default',
  basePriceMicro: 500, // $0.0005
  minBillableUnits: 1,
  volumeTiers: [
    { minUnits: 10_000, priceMicro: 450 },
    { minUnits: 100_000, priceMicro: 400 },
  ],
};

describe('pricing engine', () => {
  it('resolves the highest matching volume step', () => {
    const steps = emailPricing.volumeTiers;
    expect(resolveVolumeStep(steps, 5_000)).toBeNull();
    expect(resolveVolumeStep(steps, 10_000)?.priceMicro).toBe(450);
    expect(resolveVolumeStep(steps, 250_000)?.priceMicro).toBe(400);
    // order-independent: reversed ladder gives the same answer
    expect(resolveVolumeStep([...steps].reverse(), 250_000)?.priceMicro).toBe(400);
  });

  it('quotes base price with no tier and no volume', () => {
    const quote = quotePrice(emailPricing, 100);
    expect(quote.effectiveUnitPriceMicro).toBe(500);
    expect(quote.totalMicro).toBe(50_000); // $0.05
    expect(quote.volumeStepApplied).toBe(false);
  });

  it('stacks volume then commitment discount', () => {
    const quote = quotePrice(emailPricing, 100_000, { discountBps: 2000 });
    // volume step 400 → −20% tier → 320
    expect(quote.effectiveUnitPriceMicro).toBe(320);
    expect(quote.totalMicro).toBe(32_000_000);
    expect(quote.volumeStepApplied).toBe(true);
    expect(quote.tierDiscountBps).toBe(2000);
  });

  it('bills at least the minimum billable units (voice)', () => {
    const voice = {
      channel: 'voice' as const,
      region: 'na',
      basePriceMicro: 12_500,
      minBillableUnits: 1,
      volumeTiers: [],
    };
    expect(quotePrice(voice, 1).billableUnits).toBe(1);
    expect(quotePrice({ ...voice, minBillableUnits: 3 }, 1).billableUnits).toBe(3);
    expect(quotePrice({ ...voice, minBillableUnits: 3 }, 10).billableUnits).toBe(10);
    // zero units bill nothing even with a floor
    expect(quotePrice({ ...voice, minBillableUnits: 3 }, 0).totalMicro).toBe(0);
  });

  it('rejects invalid unit counts', () => {
    expect(() => quotePrice(emailPricing, -1)).toThrow(TypeError);
    expect(() => quotePrice(emailPricing, 1.5)).toThrow(TypeError);
  });

  it('quotes package economics', () => {
    const quote = quotePackage({
      code: 'topup-100',
      priceCents: 10_000,
      currency: 'USD',
      creditsMicro: 100_000_000,
      bonusMicro: 8_000_000,
    });
    expect(quote.totalCreditsMicro).toBe(108_000_000);
    expect(quote.bonusBps).toBe(800); // 8%
    expect(quote.effectiveMultiplier).toBeCloseTo(1.08);
  });

  it('falls back to the default region', () => {
    const rows = [
      { channel: 'sms' as const, region: 'default' },
      { channel: 'sms' as const, region: 'eu' },
    ];
    expect(resolveChannelPricing(rows, 'sms', 'eu')?.region).toBe('eu');
    expect(resolveChannelPricing(rows, 'sms', 'apac')?.region).toBe('default');
    expect(resolveChannelPricing(rows, 'voice', 'na')).toBeNull();
  });
});
