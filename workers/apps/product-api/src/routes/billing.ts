import { z } from 'zod';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { authenticate } from '@maildrill/authz';
import { ConflictError, NotFoundError, ValidationError } from '@maildrill/domain';
import type { ZodTypeProvider } from '@maildrill/httpkit';
import { config } from '@maildrill/config';
import { getUser, rateLimiter, RATE_LIMITS } from '@maildrill/identity';
import {
  createCheckout,
  createPortalSession,
  getActiveChannelPricing,
  getTenantTier,
  getWalletSummary,
  listActivePackages,
  listActiveTiers,
  listTenantInvoices,
  listWalletTransactions,
  microToUsd,
  quotePrice,
  reconcileWallet,
} from '@maildrill/billing';

const TAG = ['Billing'];

/**
 * Billing surface: wallet, ledger history, catalog (packages/pricing/tiers),
 * checkout, portal, invoices. Every response is a Maildrill domain object —
 * Stripe ids and objects never cross this boundary. The tenant always comes
 * from the credential; the browser only ever names a package code.
 */

const checkoutBody = z.object({
  /** Which package to buy — the ONLY client input. Amounts live server-side. */
  packageCode: z.string().min(1).max(64),
});

const transactionsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
});

function mapError(err: unknown, reply: FastifyReply) {
  if (err instanceof ValidationError) return reply.code(400).send({ error: err.message });
  if (err instanceof NotFoundError) return reply.code(404).send({ error: err.message });
  if (err instanceof ConflictError) return reply.code(409).send({ error: err.message });
  throw err;
}

/** Money moves are for humans with standing — owner/admin sessions only. */
function requireManager(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.role === 'owner' || req.role === 'admin') return true;
  void reply.code(403).send({ error: 'owner_or_admin_required' });
  return false;
}

function rateLimited(req: FastifyRequest, reply: FastifyReply): boolean {
  const { max, windowMs } = RATE_LIMITS.sensitiveMutation;
  if (rateLimiter.hit(`billing:${req.tenantId}`, max, windowMs).ok) return false;
  void reply.code(429).send({ error: 'rate_limited' });
  return true;
}

export async function billingRoutes(appRaw: FastifyInstance): Promise<void> {
  const app = appRaw.withTypeProvider<ZodTypeProvider>();
  app.addHook('preHandler', authenticate);

  app.get(
    '/v1/billing/wallet',
    { schema: { tags: TAG, summary: 'Current wallet: balance, reserved credits, tier' } },
    async (req) => {
      const summary = await getWalletSummary(req.tenantId);
      return {
        ...summary,
        balanceUsd: microToUsd(summary.balanceMicro),
        reservedUsd: microToUsd(summary.reservedMicro),
        lowBalanceUsd: microToUsd(summary.lowBalanceMicro),
      };
    },
  );

  app.get(
    '/v1/billing/transactions',
    {
      schema: {
        tags: TAG,
        summary: 'Immutable wallet ledger, newest first (keyset-paginated)',
        querystring: transactionsQuery,
      },
    },
    async (req) => {
      const page = await listWalletTransactions(req.tenantId, {
        limit: req.query.limit,
        cursor: req.query.cursor ?? null,
      });
      return {
        data: page.data.map((tx) => ({
          id: tx.id,
          type: tx.entryType,
          amountMicro: tx.amountMicro,
          amountUsd: microToUsd(tx.amountMicro),
          balanceAfterUsd: microToUsd(tx.balanceAfterMicro),
          currency: tx.currency,
          channel: tx.channel,
          referenceType: tx.referenceType,
          referenceId: tx.referenceId,
          description: tx.description,
          createdAt: tx.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      };
    },
  );

  app.get(
    '/v1/billing/packages',
    { schema: { tags: TAG, summary: 'Purchasable credit packages with effective economics' } },
    async () => {
      const packages = await listActivePackages();
      return {
        data: packages.map((pkg) => ({
          code: pkg.code,
          name: pkg.name,
          description: pkg.description,
          priceCents: pkg.priceCents,
          priceUsd: pkg.priceCents / 100,
          currency: pkg.currency,
          creditsUsd: microToUsd(pkg.creditsMicro),
          bonusUsd: microToUsd(pkg.bonusMicro),
          totalCreditsUsd: microToUsd(pkg.totalCreditsMicro),
          bonusBps: pkg.bonusBps,
          grantsTier: pkg.grantsTier,
        })),
      };
    },
  );

  app.get(
    '/v1/billing/pricing',
    { schema: { tags: TAG, summary: 'Effective per-channel unit pricing for this workspace' } },
    async (req) => {
      const [rows, tier] = await Promise.all([
        getActiveChannelPricing(),
        getTenantTier(req.tenantId),
      ]);
      return {
        tier: tier ? { code: tier.code, name: tier.name, discountBps: tier.discountBps } : null,
        data: rows.map((row) => {
          const quote = quotePrice(row, 1, tier);
          return {
            channel: row.channel,
            region: row.region,
            unit: row.unit,
            minBillableUnits: row.minBillableUnits,
            baseUnitPriceUsd: microToUsd(row.basePriceMicro),
            effectiveUnitPriceUsd: microToUsd(quote.effectiveUnitPriceMicro),
            volumeTiers: (row.volumeTiers ?? []).map((step) => ({
              minUnits: step.minUnits,
              unitPriceUsd: microToUsd(step.priceMicro),
            })),
          };
        }),
      };
    },
  );

  app.get(
    '/v1/billing/tier',
    { schema: { tags: TAG, summary: 'Current commitment tier and available levels' } },
    async (req) => {
      const [current, tiers] = await Promise.all([getTenantTier(req.tenantId), listActiveTiers()]);
      return {
        current: current
          ? {
              code: current.code,
              name: current.name,
              discountBps: current.discountBps,
              commitmentMonths: current.commitmentMonths,
            }
          : null,
        available: tiers.map((tier) => ({
          code: tier.code,
          name: tier.name,
          discountBps: tier.discountBps,
          commitmentMonths: tier.commitmentMonths,
          minPurchaseUsd: tier.minPurchaseCents / 100,
        })),
      };
    },
  );

  app.post(
    '/v1/billing/checkout',
    {
      schema: {
        tags: TAG,
        summary: 'Start a hosted checkout for a credit package',
        body: checkoutBody,
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      if (rateLimited(req, reply)) return;
      if (!config.billing.configured) {
        return reply.code(409).send({ error: 'billing_not_configured' });
      }
      try {
        const user = req.userId ? await getUser(req.userId) : null;
        const result = await createCheckout({
          tenantId: req.tenantId,
          packageCode: req.body.packageCode,
          userEmail: user?.email,
        });
        return reply.code(201).send({ url: result.url });
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.post(
    '/v1/billing/portal',
    {
      schema: {
        tags: TAG,
        summary: 'Open the hosted customer portal (payment methods, invoices, tax)',
      },
    },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      if (rateLimited(req, reply)) return;
      if (!config.billing.configured) {
        return reply.code(409).send({ error: 'billing_not_configured' });
      }
      try {
        const user = req.userId ? await getUser(req.userId) : null;
        const session = await createPortalSession(
          req.tenantId,
          `${config.app.url}/dashboard/settings`,
          { email: user?.email },
        );
        return reply.code(201).send({ url: session.url });
      } catch (err) {
        return mapError(err, reply);
      }
    },
  );

  app.get(
    '/v1/billing/invoices',
    { schema: { tags: TAG, summary: 'Invoices/receipts for past credit purchases' } },
    async (req) => {
      const invoices = await listTenantInvoices(req.tenantId);
      return { data: invoices };
    },
  );

  app.get(
    '/v1/billing/reconciliation',
    { schema: { tags: TAG, summary: 'Ledger-vs-wallet consistency check (audit)' } },
    async (req, reply) => {
      if (!requireManager(req, reply)) return;
      return reconcileWallet(req.tenantId);
    },
  );
}
