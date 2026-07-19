import { describe, expect, it } from 'vitest';
import { channelRates, estimate, makeFormatters } from '@/lib/pricing-math';
import { CURRENCIES, TIERS, isPromoActive, tierCommit, tierDisc } from '@/config/pricing';
import ratesData from '@/config/pricing-rates.json';

const US = ratesData.countries.find((c) => c.code === 'US')!;
const USD = CURRENCIES.find((c) => c.code === 'USD')!;
const EUR = CURRENCIES.find((c) => c.code === 'EUR')!;

const defaults = { email: 250_000, sms: 20_000, whatsapp: 8_000, voice: 4_000 };

describe('pricing estimator math', () => {
  it('computes the pay-as-you-go worked example (US, tier 0)', () => {
    const est = estimate(defaults, channelRates(US), 0);
    // US = Tier 1: email 125 + sms 158 + whatsapp 224 + voice 50 = 557
    expect(est.usageFull).toBeCloseTo(557, 5);
    expect(est.usage).toBeCloseTo(557, 5);
    expect(est.setup).toBe(49); // single flat number fee (SMS/WhatsApp/voice)
    expect(est.activeCount).toBe(4);
    expect(est.hasDiscount).toBe(false);
    expect(est.firstMonth).toBeCloseTo(606, 5); // 557 + 49
  });

  it('applies the Growth (−20%) tier discount and annual savings', () => {
    const est = estimate(defaults, channelRates(US), 2);
    expect(est.usage).toBeCloseTo(445.6, 5); // 557 × 0.8
    expect(est.annualSave).toBeCloseTo(1336.8, 4); // (557 − 445.6) × 12
    expect(est.discountPct).toBe('20%');
    expect(est.setup).toBe(49); // setup is never discounted
  });

  it('applies the launch promo discount when active (Growth → −30%)', () => {
    const reg = estimate(defaults, channelRates(US), 2, false);
    const promo = estimate(defaults, channelRates(US), 2, true);
    // usageFull 557 → 30% off = 389.9 (vs 445.6 at the regular 20%)
    expect(promo.usage).toBeCloseTo(389.9, 5);
    expect(promo.discountPct).toBe('30%');
    expect(promo.annualSave).toBeCloseTo(2005.2, 4); // (557 − 389.9) × 12
    expect(promo.setup).toBe(49); // setup still never discounted
    expect(promo.usage).toBeLessThan(reg.usage);
  });

  it('charges a single flat number setup only when a number channel is active', () => {
    const rates = channelRates(US);
    const emailOnly = estimate({ email: 1000, sms: 0, whatsapp: 0, voice: 0 }, rates, 0);
    expect(emailOnly.activeCount).toBe(1);
    expect(emailOnly.setup).toBe(0); // email needs no number

    const smsOnly = estimate({ email: 0, sms: 1000, whatsapp: 0, voice: 0 }, rates, 0);
    expect(smsOnly.setup).toBe(49); // one number → flat $49

    const allNumber = estimate({ email: 0, sms: 1000, whatsapp: 1000, voice: 1000 }, rates, 0);
    expect(allNumber.setup).toBe(49); // still one fee, not per channel
  });

  it('formats money, rates and whole numbers per currency', () => {
    const usd = makeFormatters(USD);
    expect(usd.money(542)).toBe('$542.00');
    expect(usd.money(1300.8)).toBe('$1,301');
    expect(usd.money(0)).toBe('$0.00');
    expect(usd.rate(0.0005)).toBe('$0.00050'); // < 0.001 → 5 decimals (flat email rate)
    expect(usd.rate(0.0083)).toBe('$0.0083'); // < 0.01 → 4 decimals
    expect(usd.rate(0.025)).toBe('$0.025'); // ≥ 0.01 → 3 decimals
    expect(usd.whole(49)).toBe('$49');

    const eur = makeFormatters(EUR); // fx 0.8737, symbol €
    expect(eur.money(542)).toBe('€473.55'); // 542 × 0.8737
    expect(eur.rate(0.0005)).toBe('€0.00044'); // 0.0005 × 0.8737 → 5 decimals
  });
});

describe('launch promo', () => {
  it('is active through 2026-12-31 and expires from 2027-01-01 (UTC)', () => {
    expect(isPromoActive(new Date('2026-07-18T00:00:00Z'))).toBe(true);
    expect(isPromoActive(new Date('2026-12-31T23:59:59Z'))).toBe(true);
    expect(isPromoActive(new Date('2027-01-01T00:00:00Z'))).toBe(false);
  });

  it('tier helpers return promo values only when active', () => {
    const [payg, starter, growth, scale] = TIERS;

    // regular (promo off) matches the standard tiers
    expect([starter, growth, scale].map((t) => tierDisc(t, false))).toEqual([0.1, 0.2, 0.3]);
    expect([starter, growth, scale].map((t) => tierCommit(t, false))).toEqual([3000, 6000, 12000]);

    // promo on: deeper discount, lower commitment
    expect([starter, growth, scale].map((t) => tierDisc(t, true))).toEqual([0.15, 0.3, 0.5]);
    expect([starter, growth, scale].map((t) => tierCommit(t, true))).toEqual([1500, 3000, 6000]);

    // pay-as-you-go is unaffected by the promo
    expect(tierDisc(payg, true)).toBe(0);
    expect(tierCommit(payg, true)).toBe(0);
  });
});
