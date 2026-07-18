import { describe, expect, it } from 'vitest';
import { channelRates, estimate, makeFormatters } from '@/lib/pricing-math';
import { CURRENCIES } from '@/config/pricing';
import ratesData from '@/config/pricing-rates.json';

const US = ratesData.countries.find((c) => c.code === 'US')!;
const USD = CURRENCIES.find((c) => c.code === 'USD')!;
const EUR = CURRENCIES.find((c) => c.code === 'EUR')!;

const defaults = { email: 250_000, sms: 20_000, whatsapp: 8_000, voice: 4_000 };

describe('pricing estimator math', () => {
  it('computes the pay-as-you-go worked example (US, tier 0)', () => {
    const est = estimate(defaults, channelRates(US), 0);
    // 100 + 166 + 200 + 76 = 542
    expect(est.usageFull).toBeCloseTo(542, 5);
    expect(est.usage).toBeCloseTo(542, 5);
    expect(est.setup).toBe(297); // 0 + 49 + 99 + 149
    expect(est.activeCount).toBe(4);
    expect(est.hasDiscount).toBe(false);
    expect(est.firstMonth).toBeCloseTo(839, 5);
  });

  it('applies the Growth (−20%) tier discount and annual savings', () => {
    const est = estimate(defaults, channelRates(US), 2);
    expect(est.usage).toBeCloseTo(433.6, 5);
    expect(est.annualSave).toBeCloseTo(1300.8, 4);
    expect(est.discountPct).toBe('20%');
    expect(est.setup).toBe(297); // setup is never discounted
  });

  it('only charges setup for channels with usage', () => {
    const est = estimate({ email: 1000, sms: 0, whatsapp: 0, voice: 0 }, channelRates(US), 0);
    expect(est.activeCount).toBe(1);
    expect(est.setup).toBe(0); // email setup is free
  });

  it('formats money, rates and whole numbers per currency', () => {
    const usd = makeFormatters(USD);
    expect(usd.money(542)).toBe('$542.00');
    expect(usd.money(1300.8)).toBe('$1,301');
    expect(usd.money(0)).toBe('$0.00');
    expect(usd.rate(0.0083)).toBe('$0.0083'); // < 0.01 → 4 decimals
    expect(usd.rate(0.025)).toBe('$0.025'); // ≥ 0.01 → 3 decimals
    expect(usd.whole(49)).toBe('$49');

    const eur = makeFormatters(EUR); // fx 0.92, symbol €
    expect(eur.money(542)).toBe('€498.64');
  });
});
