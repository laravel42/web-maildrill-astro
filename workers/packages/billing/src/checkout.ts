import { eq } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { NotFoundError } from '@maildrill/domain';
import { createLogger } from '@maildrill/observability';
import { db, paymentAttempts } from '@maildrill/database';
import { getActivePackage } from './packages';
import { getOrCreateWallet } from './wallet';
import { ensurePaymentCustomer } from './customer';
import { getPaymentProvider } from './provider/registry';

const log = createLogger({ component: 'billing-checkout' });

/**
 * Checkout: the browser sends ONLY a package code. Price, currency, credits,
 * and bonus all come from the `credit_packages` row server-side — client
 * amounts are never trusted. Success redirects are cosmetic; the wallet is
 * credited exclusively by the webhook processor.
 */

export interface CheckoutResult {
  url: string;
  attemptId: string;
}

export async function createCheckout(input: {
  tenantId: string;
  packageCode: string;
  userEmail?: string;
}): Promise<CheckoutResult> {
  const pkg = await getActivePackage(input.packageCode);
  if (!pkg) throw new NotFoundError(`unknown package: ${input.packageCode}`);

  const wallet = await getOrCreateWallet(input.tenantId);
  const customerId = await ensurePaymentCustomer(input.tenantId, { email: input.userEmail });

  const [attempt] = await db
    .insert(paymentAttempts)
    .values({
      tenantId: input.tenantId,
      walletId: wallet.id,
      provider: getPaymentProvider().name,
      packageId: pkg.id,
      packageCode: pkg.code,
      amountCents: pkg.priceCents,
      currency: pkg.currency,
      creditsMicro: pkg.creditsMicro + pkg.bonusMicro,
      metadata: {
        baseCreditsMicro: pkg.creditsMicro,
        bonusMicro: pkg.bonusMicro,
        grantsTierId: pkg.grantsTierId,
      },
    })
    .returning();

  const settingsUrl = `${config.app.url}/dashboard/settings`;
  const session = await getPaymentProvider().createCheckoutSession({
    attemptId: attempt!.id,
    tenantId: input.tenantId,
    customerId,
    customerEmail: input.userEmail,
    packageName: `Maildrill credits — ${pkg.name}`,
    amountCents: pkg.priceCents,
    currency: pkg.currency,
    successUrl: `${settingsUrl}?billing=success`,
    cancelUrl: `${settingsUrl}?billing=cancelled`,
  });

  await db
    .update(paymentAttempts)
    .set({ providerSessionId: session.sessionId, updatedAt: new Date() })
    .where(eq(paymentAttempts.id, attempt!.id));

  log.info(
    { tenantId: input.tenantId, attemptId: attempt!.id, packageCode: pkg.code },
    'checkout session created',
  );
  return { url: session.url, attemptId: attempt!.id };
}
