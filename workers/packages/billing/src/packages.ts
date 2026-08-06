import { asc, eq } from 'drizzle-orm';
import {
  db,
  creditPackages,
  pricingTiers,
  type CreditPackageRow,
  type PricingTierRow,
} from '@maildrill/database';
import { quotePackage, type PackageQuote } from './pricing';

/**
 * Credit packages + commitment tiers are pure database configuration —
 * repricing or adding a package is an INSERT, not a deploy. These are the
 * read models the catalog APIs and checkout validation share.
 */

export interface PackageView extends PackageQuote {
  name: string;
  description: string | null;
  grantsTier: Pick<PricingTierRow, 'code' | 'name' | 'discountBps' | 'commitmentMonths'> | null;
}

export async function listActivePackages(): Promise<PackageView[]> {
  const rows = await db
    .select({ pkg: creditPackages, tier: pricingTiers })
    .from(creditPackages)
    .leftJoin(pricingTiers, eq(creditPackages.grantsTierId, pricingTiers.id))
    .where(eq(creditPackages.active, true))
    .orderBy(asc(creditPackages.sortOrder), asc(creditPackages.priceCents));
  return rows.map(({ pkg, tier }) => ({
    ...quotePackage(pkg),
    name: pkg.name,
    description: pkg.description,
    grantsTier: tier
      ? {
          code: tier.code,
          name: tier.name,
          discountBps: tier.discountBps,
          commitmentMonths: tier.commitmentMonths,
        }
      : null,
  }));
}

/** Load one active package by its public code (checkout validation). */
export async function getActivePackage(code: string): Promise<CreditPackageRow | null> {
  const [row] = await db.select().from(creditPackages).where(eq(creditPackages.code, code));
  return row && row.active ? row : null;
}

export async function listActiveTiers(): Promise<PricingTierRow[]> {
  return db
    .select()
    .from(pricingTiers)
    .where(eq(pricingTiers.active, true))
    .orderBy(asc(pricingTiers.sortOrder));
}
