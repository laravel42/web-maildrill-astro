/**
 * Give the dev workspace a funded, non-trial wallet.
 *
 * Without this the seeded workspace looks exactly like a brand-new account to
 * the trial gate — no purchase, no commitment tier — while carrying six months
 * of demo history. The gate would then read that history as trial spend and
 * refuse every further send (744 emails against an allowance of 100), making
 * the local workspace unusable for exactly the thing it exists to demo.
 *
 * Recording a real purchase entry rather than poking the balance keeps the
 * ledger invariant intact (balance + reserved = SUM(entries)) and makes the
 * billing screens show something believable.
 */
import { appendLedgerEntry, getOrCreateWallet } from '@maildrill/billing';
import { db, tenants } from '@maildrill/database';
import { eq } from 'drizzle-orm';

/** Starting credit for the dev workspace, in micro-USD (1 USD = 1e6). */
const SEED_CREDIT_MICRO = 500_000_000; // $500

export async function seedDevWallet(tenantId?: string): Promise<void> {
  const id =
    tenantId ?? (await db.select({ id: tenants.id }).from(tenants).limit(1))[0]?.id ?? null;
  if (!id) {
    console.log('wallet: skipped — no tenant to fund');
    return;
  }

  const wallet = await getOrCreateWallet(id);
  const { duplicate } = await db.transaction((tx) =>
    appendLedgerEntry(tx, {
      tenantId: id,
      walletId: wallet.id,
      entryType: 'purchase',
      amountMicro: SEED_CREDIT_MICRO,
      referenceType: 'seed',
      referenceId: wallet.id,
      // Stable key: re-running the seed tops the workspace up once, not again.
      idempotencyKey: `seed:wallet:${wallet.id}`,
      description: 'Dev workspace starting credit (seed)',
    }),
  );

  console.log(
    duplicate
      ? 'wallet: already funded — dev workspace is off the trial gate'
      : `wallet: +$${SEED_CREDIT_MICRO / 1_000_000} credited — dev workspace is off the trial gate`,
  );
}

// Runnable alone, like the other seeders: `tsx packages/product/src/seed-wallet.ts`
const isMain = process.argv[1]?.endsWith('seed-wallet.ts');
if (isMain) {
  seedDevWallet()
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
