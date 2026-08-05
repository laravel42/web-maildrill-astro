/* eslint-disable no-console */
import { closeDb, db } from './client';
import { channelPricing, creditPackages, pricingTiers } from './schema';

/**
 * Idempotent billing catalog seed: commitment tiers, credit packages, and the
 * channel rate card. Mirrors the marketing pricing config
 * (`src/config/pricing.ts` — TIERS discounts, EMAIL_RATE, REGION_TIERS) so
 * what the site advertises is what the wallet charges. Rerunnable: upserts by
 * code / (channel, region), never deletes.
 *
 *   pnpm --dir workers db:seed:billing
 */

const MICRO = 1_000_000;
const usd = (v: number): number => Math.round(v * MICRO);

/** Commitment tiers — discounts match marketing `TIERS` (base, non-promo). */
const TIER_SEED = [
  { code: 'payg', name: 'Pay as you go', discountBps: 0, minPurchaseCents: 0, commitmentMonths: 0, sortOrder: 0 },
  { code: 'starter', name: 'Starter', discountBps: 1000, minPurchaseCents: 300_000, commitmentMonths: 12, sortOrder: 1 },
  { code: 'growth', name: 'Growth', discountBps: 2000, minPurchaseCents: 600_000, commitmentMonths: 12, sortOrder: 2 },
  { code: 'scale', name: 'Scale', discountBps: 3000, minPurchaseCents: 1_200_000, commitmentMonths: 12, sortOrder: 3 },
];

/**
 * Credit packages — the app's Add-balance presets ($25/$50/$100/$250) plus the
 * annual commitment packages that move a workspace onto a tier. Bonus credits
 * are the volume incentive on the one-off top-ups.
 */
const PACKAGE_SEED = [
  { code: 'topup-25', name: 'Top-up $25', priceCents: 2_500, creditsMicro: usd(25), bonusMicro: 0, tier: null, sortOrder: 0, description: 'Quick balance top-up.' },
  { code: 'topup-50', name: 'Top-up $50', priceCents: 5_000, creditsMicro: usd(50), bonusMicro: usd(2), tier: null, sortOrder: 1, description: '$2 bonus credit included.' },
  { code: 'topup-100', name: 'Top-up $100', priceCents: 10_000, creditsMicro: usd(100), bonusMicro: usd(8), tier: null, sortOrder: 2, description: '$8 bonus credit included.' },
  { code: 'topup-250', name: 'Top-up $250', priceCents: 25_000, creditsMicro: usd(250), bonusMicro: usd(30), tier: null, sortOrder: 3, description: '$30 bonus credit included.' },
  { code: 'commit-starter', name: 'Starter (annual prepay)', priceCents: 300_000, creditsMicro: usd(3000), bonusMicro: 0, tier: 'starter', sortOrder: 10, description: 'Annual prepay — unlocks 10% off every rate. Unused balance rolls over all year.' },
  { code: 'commit-growth', name: 'Growth (annual prepay)', priceCents: 600_000, creditsMicro: usd(6000), bonusMicro: 0, tier: 'growth', sortOrder: 11, description: 'Annual prepay — unlocks 20% off every rate. Unused balance rolls over all year.' },
  { code: 'commit-scale', name: 'Scale (annual prepay)', priceCents: 1_200_000, creditsMicro: usd(12000), bonusMicro: 0, tier: 'scale', sortOrder: 12, description: 'Annual prepay — unlocks 30% off every rate. Unused balance rolls over all year.' },
];

/**
 * Channel rate card — EMAIL_RATE + REGION_TIERS from marketing. Region keys:
 * na / eu / lamea / apac, with `default` as the worldwide fallback (email is
 * flat; paid channels fall back to the NA rate when the region is unknown).
 */
const PRICING_SEED = [
  { channel: 'email' as const, region: 'default', basePriceMicro: usd(0.0005), unit: 'message' },
  { channel: 'sms' as const, region: 'default', basePriceMicro: usd(0.0079), unit: 'message' },
  { channel: 'sms' as const, region: 'na', basePriceMicro: usd(0.0079), unit: 'message' },
  { channel: 'sms' as const, region: 'eu', basePriceMicro: usd(0.055), unit: 'message' },
  { channel: 'sms' as const, region: 'lamea', basePriceMicro: usd(0.035), unit: 'message' },
  { channel: 'sms' as const, region: 'apac', basePriceMicro: usd(0.02), unit: 'message' },
  { channel: 'whatsapp' as const, region: 'default', basePriceMicro: usd(0.028), unit: 'message' },
  { channel: 'whatsapp' as const, region: 'na', basePriceMicro: usd(0.028), unit: 'message' },
  { channel: 'whatsapp' as const, region: 'eu', basePriceMicro: usd(0.085), unit: 'message' },
  { channel: 'whatsapp' as const, region: 'lamea', basePriceMicro: usd(0.05), unit: 'message' },
  { channel: 'whatsapp' as const, region: 'apac', basePriceMicro: usd(0.025), unit: 'message' },
  { channel: 'voice' as const, region: 'default', basePriceMicro: usd(0.0125), unit: 'minute' },
  { channel: 'voice' as const, region: 'na', basePriceMicro: usd(0.0125), unit: 'minute' },
  { channel: 'voice' as const, region: 'eu', basePriceMicro: usd(0.022), unit: 'minute' },
  { channel: 'voice' as const, region: 'lamea', basePriceMicro: usd(0.03), unit: 'minute' },
  { channel: 'voice' as const, region: 'apac', basePriceMicro: usd(0.022), unit: 'minute' },
];

export async function seedBilling(): Promise<void> {
  const tierIds = new Map<string, string>();
  for (const tier of TIER_SEED) {
    const [row] = await db
      .insert(pricingTiers)
      .values(tier)
      .onConflictDoUpdate({
        target: [pricingTiers.code],
        set: {
          name: tier.name,
          discountBps: tier.discountBps,
          minPurchaseCents: tier.minPurchaseCents,
          commitmentMonths: tier.commitmentMonths,
          sortOrder: tier.sortOrder,
          active: true,
          updatedAt: new Date(),
        },
      })
      .returning();
    tierIds.set(tier.code, row!.id);
  }

  for (const pkg of PACKAGE_SEED) {
    await db
      .insert(creditPackages)
      .values({
        code: pkg.code,
        name: pkg.name,
        description: pkg.description,
        priceCents: pkg.priceCents,
        creditsMicro: pkg.creditsMicro,
        bonusMicro: pkg.bonusMicro,
        grantsTierId: pkg.tier ? tierIds.get(pkg.tier) : null,
        sortOrder: pkg.sortOrder,
      })
      .onConflictDoUpdate({
        target: [creditPackages.code],
        set: {
          name: pkg.name,
          description: pkg.description,
          priceCents: pkg.priceCents,
          creditsMicro: pkg.creditsMicro,
          bonusMicro: pkg.bonusMicro,
          grantsTierId: pkg.tier ? tierIds.get(pkg.tier) : null,
          sortOrder: pkg.sortOrder,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  for (const price of PRICING_SEED) {
    await db
      .insert(channelPricing)
      .values(price)
      .onConflictDoUpdate({
        target: [channelPricing.channel, channelPricing.region],
        set: {
          basePriceMicro: price.basePriceMicro,
          unit: price.unit,
          active: true,
          updatedAt: new Date(),
        },
      });
  }

  console.log(
    `seeded billing catalog: ${TIER_SEED.length} tiers, ${PACKAGE_SEED.length} packages, ${PRICING_SEED.length} channel prices`,
  );
}

const isMain = process.argv[1]?.endsWith('seed-billing.ts');
if (isMain) {
  seedBilling()
    .catch((err) => {
      console.error('billing seed failed', err);
      process.exitCode = 1;
    })
    .finally(() => closeDb());
}
