/**
 * Pure pricing math for the usage estimator — extracted so it can be unit
 * tested independently of the React island. Mirrors the design's exact formulas.
 */
import { EMAIL_RATE, SETUP, TIERS, type ChannelKey, type Currency } from '@/config/pricing';

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
    rate: (n: number) => `${sym}${(n * fx).toFixed(n < 0.01 ? 4 : 3)}`,
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

/** Monthly usage + one-time setup for a given usage mix, country rates, and tier. */
export function estimate(
  usage: Record<ChannelKey, number>,
  rates: Record<ChannelKey, number>,
  tierId: number
): Estimate {
  const disc = TIERS[tierId]?.disc ?? 0;
  const usageFull = CHANNEL_ORDER.reduce((sum, k) => sum + usage[k] * rates[k], 0);
  const setup = CHANNEL_ORDER.reduce((sum, k) => sum + (usage[k] > 0 ? SETUP[k] : 0), 0);
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
