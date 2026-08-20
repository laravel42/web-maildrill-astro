import { and, eq } from 'drizzle-orm';
import { db, paymentCustomers } from '@maildrill/database';
import { getPaymentProvider } from './provider/registry';
import type { BillingInvoice, PortalSession } from './provider/types';

/**
 * Provider-side customer handles. One per (tenant, provider), created lazily
 * the first time a workspace checks out or opens the portal.
 */

export async function ensurePaymentCustomer(
  tenantId: string,
  opts: { email?: string; name?: string } = {},
): Promise<string> {
  const provider = getPaymentProvider();
  const [existing] = await db
    .select()
    .from(paymentCustomers)
    .where(
      and(eq(paymentCustomers.tenantId, tenantId), eq(paymentCustomers.provider, provider.name)),
    );
  if (existing) return existing.externalCustomerId;

  const externalCustomerId = await provider.createCustomer({
    tenantId,
    email: opts.email,
    name: opts.name,
  });
  // Concurrent first-touch: the unique (tenant, provider) index arbitrates.
  const [created] = await db
    .insert(paymentCustomers)
    .values({ tenantId, provider: provider.name, externalCustomerId })
    .onConflictDoNothing({ target: [paymentCustomers.tenantId, paymentCustomers.provider] })
    .returning();
  if (created) return created.externalCustomerId;
  const [raced] = await db
    .select()
    .from(paymentCustomers)
    .where(
      and(eq(paymentCustomers.tenantId, tenantId), eq(paymentCustomers.provider, provider.name)),
    );
  return raced!.externalCustomerId;
}

/** Hosted customer portal (payment methods, billing info, tax details). */
export async function createPortalSession(
  tenantId: string,
  returnUrl: string,
  opts: { email?: string } = {},
): Promise<PortalSession> {
  const customerId = await ensurePaymentCustomer(tenantId, opts);
  return getPaymentProvider().createPortalSession(customerId, returnUrl);
}

/** Invoices as domain objects — Stripe internals never reach the API. */
export async function listTenantInvoices(tenantId: string): Promise<BillingInvoice[]> {
  const provider = getPaymentProvider();
  const [existing] = await db
    .select()
    .from(paymentCustomers)
    .where(
      and(eq(paymentCustomers.tenantId, tenantId), eq(paymentCustomers.provider, provider.name)),
    );
  // No customer yet = never checked out = no invoices.
  if (!existing) return [];
  return provider.listInvoices(existing.externalCustomerId);
}
