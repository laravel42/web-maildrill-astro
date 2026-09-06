/**
 * Pure pricing math for the usage estimator — extracted so it can be unit
 * tested independently of the React island. Mirrors the design's exact formulas.
 */
import {
  EMAIL_RATE,
  SETUP_CHANNELS,
  SETUP_FEE,
  TIERS,
  tierDisc,
  type ChannelKey,
  type Currency,
} from '@/config/pricing';

export type CountryRate = { sms: number; whatsapp: number; voice: number };

export const CHANNEL_ORDER: ChannelKey[] = ['email', 'sms', 'whatsapp', 'voice'];

/** Per-channel USD rates for a destination country (email is flat worldwide). */
export function channelRates(country: CountryRate): Record<ChannelKey, number> {
  return { email: EMAIL_RATE, sms: country.sms, whatsapp: country.whatsapp, voice: country.voice };
}

/** Currency-aware display formatters (flat fx multiply, exactly like the design). */
export function makeFormatters(cur: Currency) {
  const { fx, sym } = cur;
  return {
    money: (n: number) => {
      const v = n * fx;
      if (v === 0) return `${sym}0.00`;
      if (v < 1000) return `${sym}${v.toFixed(2)}`;
      return `${sym}${Math.round(v).toLocaleString('en-US')}`;
    },
    // Up to 4 decimals (USD base), trailing zeros trimmed — email $0.0005,
    // voice $0.0125 — so nothing rounds to $0.013 or pads to $0.00050.
    rate: (n: number) =>
      `${sym}${(n * fx).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`,
    whole: (n: number) => `${sym}${Math.round(n * fx).toLocaleString('en-US')}`,
    fmt: (n: number) => Math.round(n).toLocaleString('en-US'),
  };
}

export type Estimate = {
  usageFull: number;
  usage: number;
  setup: number;
  activeCount: number;
  annualSave: number;
  hasDiscount: boolean;
  discountPct: string;
  firstMonth: number;
};

/**
 * Monthly usage + one-time setup for a given usage mix, country rates, and tier.
 * When `promo` is true the tier's launch-promo discount is applied instead of
 * its regular discount.
 */
export function estimate(
  usage: Record<ChannelKey, number>,
  rates: Record<ChannelKey, number>,
  tierId: number,
  promo = false,
): Estimate {
  const tier = TIERS[tierId];
  const disc = tier ? tierDisc(tier, promo) : 0;
  const usageFull = CHANNEL_ORDER.reduce((sum, k) => sum + usage[k] * rates[k], 0);
  // Single flat number fee when any number-based channel is active (email needs none).
  const setup = SETUP_CHANNELS.some((k) => usage[k] > 0) ? SETUP_FEE : 0;
  const activeCount = CHANNEL_ORDER.filter((k) => usage[k] > 0).length;
  const usageDisc = usageFull * (1 - disc);
  return {
    usageFull,
    usage: usageDisc,
    setup,
    activeCount,
    annualSave: (usageFull - usageDisc) * 12,
    hasDiscount: disc > 0,
    discountPct: `${Math.round(disc * 100)}%`,
    firstMonth: usageDisc + setup,
  };
}
