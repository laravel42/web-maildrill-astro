import type { Channel } from '@maildrill/domain';
import type { ChannelPricingRow, PricingTierRow } from '@maildrill/database';
import { applyDiscountBps, assertMicro } from './money';

/**
 * The pricing engine — pure functions over database rows. It never talks to
 * Stripe (or the database): callers load `channel_pricing` / `pricing_tiers`
 * rows and the engine resolves the final effective unit price by applying,
 * in order:
 *
 *   1. the channel/region base price,
 *   2. the volume ladder (highest `minUnits` step ≤ requested units wins),
 *   3. the workspace's commitment-tier discount (basis points),
 *   4. the minimum-billable-units floor.
 *
 * Changing prices is a data change, never a deploy.
 */

export interface VolumeTierStep {
  minUnits: number;
  priceMicro: number;
}

export interface PriceQuote {
  channel: Channel;
  region: string;
  units: number;
  /** Units actually billed after the min-billable floor. */
  billableUnits: number;
  /** Micro-USD per unit before the commitment discount. */
  baseUnitPriceMicro: number;
  /** Micro-USD per unit after volume + commitment discounts. */
  effectiveUnitPriceMicro: number;
  /** Total micro-USD for the billable units. */
  totalMicro: number;
  volumeStepApplied: boolean;
  tierDiscountBps: number;
}

/** Pick the volume-ladder step for a unit count (ladder may be unsorted). */
export function resolveVolumeStep(
  steps: readonly VolumeTierStep[],
  units: number,
): VolumeTierStep | null {
  let best: VolumeTierStep | null = null;
  for (const step of steps) {
    if (units >= step.minUnits && (best === null || step.minUnits > best.minUnits)) {
      best = step;
    }
  }
  return best;
}

/**
 * Quote a consumption price. `tier` is the wallet's commitment tier (null =
 * pay-as-you-go, no discount).
 */
export function quotePrice(
  pricing: Pick<
    ChannelPricingRow,
    'channel' | 'region' | 'basePriceMicro' | 'minBillableUnits' | 'volumeTiers'
  >,
  units: number,
  tier?: Pick<PricingTierRow, 'discountBps'> | null,
): PriceQuote {
  if (!Number.isSafeInteger(units) || units < 0) {
    throw new TypeError(`units must be a non-negative integer, got ${units}`);
  }
  const billableUnits = Math.max(units, units === 0 ? 0 : pricing.minBillableUnits);
  const step = resolveVolumeStep(pricing.volumeTiers ?? [], billableUnits);
  const volumeUnitPrice = step ? assertMicro(step.priceMicro) : pricing.basePriceMicro;
  const tierDiscountBps = tier?.discountBps ?? 0;
  const effectiveUnitPriceMicro = applyDiscountBps(volumeUnitPrice, tierDiscountBps);
  return {
    channel: pricing.channel,
    region: pricing.region,
    units,
    billableUnits,
    baseUnitPriceMicro: pricing.basePriceMicro,
    effectiveUnitPriceMicro,
    totalMicro: effectiveUnitPriceMicro * billableUnits,
    volumeStepApplied: step !== null,
    tierDiscountBps,
  };
}

export interface PackageQuote {
  code: string;
  priceCents: number;
  currency: string;
  creditsMicro: number;
  bonusMicro: number;
  /** Total credits the wallet receives (credits + bonus). */
  totalCreditsMicro: number;
  /** Bonus expressed against the paid credits, in basis points. */
  bonusBps: number;
  /** Effective $ of credit per $ paid (1.0 = face value, >1 = bonus). */
  effectiveMultiplier: number;
}

/** Effective economics of a credit package (what the packages API returns). */
export function quotePackage(pkg: {
  code: string;
  priceCents: number;
  currency: string;
  creditsMicro: number;
  bonusMicro: number;
}): PackageQuote {
  assertMicro(pkg.creditsMicro, 'creditsMicro');
  assertMicro(pkg.bonusMicro, 'bonusMicro');
  const total = pkg.creditsMicro + pkg.bonusMicro;
  const paidMicro = pkg.priceCents * 10_000;
  return {
    code: pkg.code,
    priceCents: pkg.priceCents,
    currency: pkg.currency,
    creditsMicro: pkg.creditsMicro,
    bonusMicro: pkg.bonusMicro,
    totalCreditsMicro: total,
    bonusBps: pkg.creditsMicro > 0 ? Math.round((pkg.bonusMicro / pkg.creditsMicro) * 10_000) : 0,
    effectiveMultiplier: paidMicro > 0 ? total / paidMicro : 0,
  };
}

/**
 * Pick the pricing row for a channel+region with fallback to the `default`
 * region (email is flat worldwide; SMS/WhatsApp/voice are regional).
 */
export function resolveChannelPricing<T extends Pick<ChannelPricingRow, 'channel' | 'region'>>(
  rows: readonly T[],
  channel: Channel,
  region: string,
): T | null {
  let fallback: T | null = null;
  for (const row of rows) {
    if (row.channel !== channel) continue;
    if (row.region === region) return row;
    if (row.region === 'default') fallback = row;
  }
  return fallback;
}
