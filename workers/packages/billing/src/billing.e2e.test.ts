import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ConflictError } from '@maildrill/domain';
import {
  closeDb,
  db,
  memberships,
  messages,
  paymentAttempts,
  pricingTiers,
  users,
  wallets,
} from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import { appendLedgerEntry } from './ledger';
import { getOrCreateWallet, listWalletTransactions, reconcileWallet } from './wallet';
import { commitReservedCredits, releaseReservation, reserveCredits } from './reservations';
import { processPaymentWebhook } from './webhooks';
import { assertTrialAllowance, isTenantOnTrial, trialAllowance } from './trial';
import { MockPaymentProvider } from './provider/mock';
import { setPaymentProviderForTests } from './provider/registry';

/**
 * Billing e2e — needs Postgres (docker compose up -d && pnpm db:migrate).
 * Enable with RUN_E2E=1. Uses a throwaway tenant per run; the ledger is
 * append-only by design, so rows accumulate and assertions are relative.
 */
const run = process.env.RUN_E2E === '1';

const uniq = `${process.pid}-${process.hrtime.bigint()}`;

describe.skipIf(!run)('billing wallet + ledger (e2e — needs Postgres)', () => {
  let tenantId: string;
  let walletId: string;
  const mock = new MockPaymentProvider();

  beforeAll(async () => {
    setPaymentProviderForTests(mock);
    const tenant = await ensureTenantByName(`billing-e2e-${uniq}`);
    tenantId = tenant.id;
    const wallet = await getOrCreateWallet(tenantId);
    walletId = wallet.id;
  });

  afterAll(async () => {
    setPaymentProviderForTests(null);
    await closeDb();
  });

  async function walletRow() {
    const [row] = await db.select().from(wallets).where(eq(wallets.id, walletId));
    return row!;
  }

  async function newAttempt(creditsMicro: number, bonusMicro = 0) {
    const [attempt] = await db
      .insert(paymentAttempts)
      .values({
        tenantId,
        walletId,
        provider: 'mock',
        packageCode: 'topup-test',
        amountCents: Math.round(creditsMicro / 10_000),
        creditsMicro: creditsMicro + bonusMicro,
        providerSessionId: `sess-${uniq}-${Math.random().toString(36).slice(2)}`,
        metadata: { baseCreditsMicro: creditsMicro, bonusMicro },
      })
      .returning();
    return attempt!;
  }

  it('creates exactly one wallet per tenant under concurrency', async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => getOrCreateWallet(tenantId)));
    expect(new Set(results.map((w) => w.id)).size).toBe(1);
  });

  it('grants a purchase exactly once across duplicate webhook deliveries', async () => {
    const attempt = await newAttempt(25_000_000, 2_000_000);
    const before = (await walletRow()).balanceMicro;
    const event = JSON.stringify({
      eventId: `evt-${attempt.id}`,
      eventType: 'checkout.session.completed',
      kind: 'checkout_completed',
      sessionId: attempt.providerSessionId,
      attemptId: attempt.id,
    });

    const first = await processPaymentWebhook(event, undefined);
    expect(first.outcome).toBe('processed');
    // Same event id redelivered → duplicate, no financial effect.
    const second = await processPaymentWebhook(event, undefined);
    expect(second.outcome).toBe('duplicate');
    // A *different* event granting the same attempt → ledger key dedupes.
    const sibling = JSON.stringify({
      eventId: `evt-sibling-${attempt.id}`,
      eventType: 'payment_intent.succeeded',
      kind: 'payment_succeeded',
      attemptId: attempt.id,
    });
    const third = await processPaymentWebhook(sibling, undefined);
    expect(third.outcome).toBe('processed');

    const after = (await walletRow()).balanceMicro;
    expect(after - before).toBe(27_000_000); // credited exactly once (incl. bonus)

    const [attemptAfter] = await db
      .select()
      .from(paymentAttempts)
      .where(eq(paymentAttempts.id, attempt.id));
    expect(attemptAfter!.status).toBe('succeeded');
  });

  it('marks failed payments without touching the balance', async () => {
    const attempt = await newAttempt(10_000_000);
    const before = (await walletRow()).balanceMicro;
    const outcome = await processPaymentWebhook(
      JSON.stringify({
        eventId: `evt-fail-${attempt.id}`,
        eventType: 'payment_intent.payment_failed',
        kind: 'payment_failed',
        attemptId: attempt.id,
        failureReason: 'card_declined',
      }),
      undefined,
    );
    expect(outcome.outcome).toBe('processed');
    expect((await walletRow()).balanceMicro).toBe(before);
    const [row] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id));
    expect(row!.status).toBe('failed');
    expect(row!.failureReason).toBe('card_declined');
  });

  it('reserve → commit → release keeps the wallet invariant', async () => {
    const before = await walletRow();
    const reservation = await reserveCredits({
      tenantId,
      amountMicro: 5_000_000,
      referenceType: 'campaign',
      referenceId: `camp-${uniq}`,
    });
    expect(reservation.status).toBe('held');

    let during = await walletRow();
    expect(during.balanceMicro).toBe(before.balanceMicro - 5_000_000);
    expect(during.reservedMicro).toBe(before.reservedMicro + 5_000_000);

    // Reserving again for the same reference is idempotent.
    const again = await reserveCredits({
      tenantId,
      amountMicro: 5_000_000,
      referenceType: 'campaign',
      referenceId: `camp-${uniq}`,
    });
    expect(again.id).toBe(reservation.id);
    expect((await walletRow()).reservedMicro).toBe(during.reservedMicro);

    // Commit two messages from the hold; the second commit of msg-1 is a no-op.
    for (const msg of ['msg-1', 'msg-2', 'msg-1']) {
      await commitReservedCredits({
        tenantId,
        referenceType: 'campaign',
        referenceId: `camp-${uniq}`,
        amountMicro: 1_000_000,
        channel: 'email',
        idempotencyKey: `consume:${uniq}:${msg}`,
        messageId: `${uniq}:${msg}`,
      });
    }
    during = await walletRow();
    expect(during.reservedMicro).toBe(before.reservedMicro + 3_000_000);

    // Release returns the remainder to available.
    expect(await releaseReservation(tenantId, 'campaign', `camp-${uniq}`)).toBe(true);
    const after = await walletRow();
    expect(after.reservedMicro).toBe(before.reservedMicro);
    expect(after.balanceMicro).toBe(before.balanceMicro - 2_000_000);
    // Releasing again is a safe no-op.
    expect(await releaseReservation(tenantId, 'campaign', `camp-${uniq}`)).toBe(false);

    const check = await reconcileWallet(tenantId);
    expect(check.consistent).toBe(true);
  });

  it('rejects reservations beyond the available balance', async () => {
    const balance = (await walletRow()).balanceMicro;
    await expect(
      reserveCredits({
        tenantId,
        amountMicro: balance + 1,
        referenceType: 'campaign',
        referenceId: `camp-over-${uniq}`,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('keeps the ledger consistent under concurrent direct debits', async () => {
    const before = await walletRow();
    const n = 8;
    await Promise.all(
      Array.from({ length: n }, (_, i) =>
        commitReservedCredits({
          tenantId,
          referenceType: 'oneoff',
          referenceId: `direct-${uniq}-${i}`,
          amountMicro: 100_000,
          channel: 'sms',
          idempotencyKey: `consume:${uniq}:direct-${i}`,
        }),
      ),
    );
    const after = await walletRow();
    expect(before.balanceMicro - after.balanceMicro).toBe(n * 100_000);
    expect((await reconcileWallet(tenantId)).consistent).toBe(true);
  });

  it('claws back refunds proportionally, allowing negative balances', async () => {
    const attempt = await newAttempt(10_000_000);
    await processPaymentWebhook(
      JSON.stringify({
        eventId: `evt-grant-${attempt.id}`,
        eventType: 'checkout.session.completed',
        kind: 'checkout_completed',
        attemptId: attempt.id,
      }),
      undefined,
    );
    const before = (await walletRow()).balanceMicro;
    const outcome = await processPaymentWebhook(
      JSON.stringify({
        eventId: `evt-refund-${attempt.id}`,
        eventType: 'charge.refunded',
        kind: 'refund',
        attemptId: attempt.id,
        chargeId: `ch-${attempt.id}`,
        refundedCents: 500, // half of the $10 attempt
      }),
      undefined,
    );
    expect(outcome.outcome).toBe('processed');
    expect((await walletRow()).balanceMicro).toBe(before - 5_000_000);
    expect((await reconcileWallet(tenantId)).consistent).toBe(true);
  });

  it('refuses ledger appends that would overdraw (and honors the override)', async () => {
    const balance = (await walletRow()).balanceMicro;
    await expect(
      db.transaction((tx) =>
        appendLedgerEntry(tx, {
          tenantId,
          walletId,
          entryType: 'consumption',
          amountMicro: -(balance + 1_000_000),
          channel: 'email',
        }),
      ),
    ).rejects.toThrow('insufficient_credits');

    const result = await db.transaction((tx) =>
      appendLedgerEntry(tx, {
        tenantId,
        walletId,
        entryType: 'adjustment',
        amountMicro: -(balance + 1_000_000),
        description: 'manual clawback (test)',
        allowNegativeBalance: true,
      }),
    );
    expect(result.wallet.balanceMicro).toBe(-1_000_000);
    // Put it back so later assertions in reruns start sane.
    await db.transaction((tx) =>
      appendLedgerEntry(tx, {
        tenantId,
        walletId,
        entryType: 'adjustment',
        amountMicro: balance + 1_000_000,
        description: 'manual restore (test)',
      }),
    );
    expect((await reconcileWallet(tenantId)).consistent).toBe(true);
  });

  it('pages the ledger newest-first', async () => {
    const page = await listWalletTransactions(tenantId, { limit: 5 });
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data.length).toBeLessThanOrEqual(5);
    const times = page.data.map((t) => t.createdAt.getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  describe('users.tier follows what was purchased', () => {
    let userId: string;

    /** A member of the purchasing workspace, fresh on the trial default. */
    async function newMember() {
      const [user] = await db
        .insert(users)
        .values({ email: `tier-${uniq}-${Math.random().toString(36).slice(2)}@example.com` })
        .returning();
      await db.insert(memberships).values({ userId: user!.id, tenantId, role: 'owner' });
      return user!.id;
    }

    async function tierOf(id: string) {
      const [row] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, id));
      return row!.tier;
    }

    /** Drive a purchase all the way through the webhook path. */
    async function purchase(attemptId: string, sessionId: string) {
      const res = await processPaymentWebhook(
        JSON.stringify({
          eventId: `evt-tier-${attemptId}`,
          eventType: 'checkout.session.completed',
          kind: 'checkout_completed',
          sessionId,
          attemptId,
        }),
        undefined,
      );
      expect(res.outcome).toBe('processed');
    }

    beforeAll(async () => {
      userId = await newMember();
    });

    it('starts on trial', async () => {
      expect(await tierOf(userId)).toBe('trial');
    });

    it('moves to payg on a plain top-up', async () => {
      const attempt = await newAttempt(5_000_000);
      await purchase(attempt.id, attempt.providerSessionId!);
      expect(await tierOf(userId)).toBe('payg');
    });

    it('takes the tier code when a commitment package is bought', async () => {
      const [tier] = await db
        .select({ id: pricingTiers.id, code: pricingTiers.code })
        .from(pricingTiers)
        .where(eq(pricingTiers.code, 'growth'));
      expect(tier, 'seed-billing has run (pnpm db:seed:billing)').toBeTruthy();

      const [attempt] = await db
        .insert(paymentAttempts)
        .values({
          tenantId,
          walletId,
          provider: 'mock',
          packageCode: 'commit-growth',
          amountCents: 300_000,
          creditsMicro: 3_000_000_000,
          providerSessionId: `sess-commit-${uniq}-${Math.random().toString(36).slice(2)}`,
          metadata: { baseCreditsMicro: 3_000_000_000, bonusMicro: 0, grantsTierId: tier!.id },
        })
        .returning();

      await purchase(attempt!.id, attempt!.providerSessionId!);
      expect(await tierOf(userId)).toBe(tier!.code);
      // The wallet, which is what discounts actually read, moved too.
      expect((await walletRow()).pricingTierId).toBe(tier!.id);
    });

    it('a later top-up does not demote a committed plan', async () => {
      const before = await tierOf(userId);
      expect(before).toBe('growth');
      const attempt = await newAttempt(5_000_000);
      await purchase(attempt.id, attempt.providerSessionId!);
      // payg only ever overwrites trial — a contract mid-term stays put.
      expect(await tierOf(userId)).toBe('growth');
    });

    it('applies to every member of the workspace, not just the buyer', async () => {
      const second = await newMember();
      expect(await tierOf(second)).toBe('trial');
      const attempt = await newAttempt(5_000_000);
      await purchase(attempt.id, attempt.providerSessionId!);
      expect(await tierOf(second)).toBe('payg');
    });
  });

  describe('trial allowance gate', () => {
    let trialTenantId: string;

    /** Record messages as already sent, so they consume allowance. */
    async function spend(
      channel: 'email' | 'sms' | 'whatsapp' | 'voice',
      n: number,
      status: 'sent' | 'queued' | 'failed' = 'sent',
    ) {
      if (n === 0) return;
      await db.insert(messages).values(
        Array.from({ length: n }, () => ({
          tenantId: trialTenantId,
          channel,
          toAddress: `trial-${Math.random().toString(36).slice(2)}@example.com`,
          status,
          provider: 'mock',
        })),
      );
    }

    beforeAll(async () => {
      // A tenant of its own: the suite's main tenant has purchases by now.
      const tenant = await ensureTenantByName(`trial-e2e-${uniq}`);
      trialTenantId = tenant.id;
    });

    it('treats a workspace that never paid as on trial', async () => {
      expect(await isTenantOnTrial(trialTenantId)).toBe(true);
    });

    it('allows sending inside the advertised allowance', async () => {
      await expect(assertTrialAllowance(trialTenantId, 'sms', 15)).resolves.toBeUndefined();
    });

    it('rejects a batch that would exceed the allowance, all or nothing', async () => {
      await expect(assertTrialAllowance(trialTenantId, 'sms', 16)).rejects.toThrow(
        /trial_allowance_exhausted/,
      );
    });

    it('counts only messages that actually went out', async () => {
      await spend('sms', 5, 'sent');
      await spend('sms', 3, 'queued'); // never left — must not consume
      await spend('sms', 2, 'failed');
      const state = await trialAllowance(trialTenantId, 'sms');
      expect(state.used).toBe(5);
      expect(state.remaining).toBe(10);
      await expect(assertTrialAllowance(trialTenantId, 'sms', 10)).resolves.toBeUndefined();
      await expect(assertTrialAllowance(trialTenantId, 'sms', 11)).rejects.toThrow(ConflictError);
    });

    it('keeps each channel on its own budget', async () => {
      const email = await trialAllowance(trialTenantId, 'email');
      expect(email.used).toBe(0);
      expect(email.remaining).toBe(100);
      await expect(assertTrialAllowance(trialTenantId, 'email', 100)).resolves.toBeUndefined();
    });

    it('exhausts precisely at the limit', async () => {
      await spend('whatsapp', 100);
      const state = await trialAllowance(trialTenantId, 'whatsapp');
      expect(state.remaining).toBe(0);
      await expect(assertTrialAllowance(trialTenantId, 'whatsapp', 1)).rejects.toThrow(
        /trial_allowance_exhausted/,
      );
    });

    it('stops gating once the workspace has paid', async () => {
      expect(await isTenantOnTrial(tenantId)).toBe(false);
      const state = await trialAllowance(tenantId, 'sms');
      expect(state.onTrial).toBe(false);
      expect(state.remaining).toBe(Number.POSITIVE_INFINITY);
      await expect(assertTrialAllowance(tenantId, 'sms', 10_000)).resolves.toBeUndefined();
    });
  });
});
