import { eq } from 'drizzle-orm';
import type { Channel } from '@maildrill/domain';
import {
  db,
  channelPricing,
  pricingTiers,
  type ChannelPricingRow,
  type PricingTierRow,
} from '@maildrill/database';
import { getOrCreateWallet } from './wallet';
import { quotePrice, resolveChannelPricing, type PriceQuote } from './pricing';

/**
 * Database-backed entry points to the pure pricing engine: load the active
 * rate card and the workspace's commitment tier, then quote.
 */

export async function getActiveChannelPricing(): Promise<ChannelPricingRow[]> {
  return db.select().from(channelPricing).where(eq(channelPricing.active, true));
}

export async function getTenantTier(tenantId: string): Promise<PricingTierRow | null> {
  const wallet = await getOrCreateWallet(tenantId);
  if (!wallet.pricingTierId) return null;
  const [tier] = await db
    .select()
    .from(pricingTiers)
    .where(eq(pricingTiers.id, wallet.pricingTierId));
  return tier ?? null;
}

/**
 * Quote what `units` on `channel` costs this workspace right now, or null
 * when no rate card row covers the channel (unpriced channels send free —
 * enforcement treats "no price" as zero cost rather than blocking sends).
 */
export async function quoteTenantPrice(
  tenantId: string,
  channel: Channel,
  units: number,
  region = 'default',
): Promise<PriceQuote | null> {
  const [rows, tier] = await Promise.all([getActiveChannelPricing(), getTenantTier(tenantId)]);
  const pricing = resolveChannelPricing(rows, channel, region);
  if (!pricing) return null;
  return quotePrice(pricing, units, tier);
}
