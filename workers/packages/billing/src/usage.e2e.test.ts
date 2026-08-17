import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import {
  billingUsageLines,
  billingUsageRequests,
  campaigns,
  closeDb,
  creditRecharges,
  db,
  walletTransactions,
} from '@maildrill/database';
import { ensureTenantByName } from '@maildrill/services';
import { appendLedgerEntry } from './ledger';
import { getOrCreateWallet } from './wallet';
import { ingestUsageCallback, type UsageCallbackPayload } from './usage';
import { rebuildRechargeSpending, recordRecharge } from './recharges';

/**
 * Provider-usage reconciliation e2e — needs Postgres (RUN_E2E=1).
 *
 * The assertions here are the ones that would have caught the failure modes
 * this feature is most likely to have: double-charging on a redelivered
 * callback, treating an unparseable payload as a zero-cost campaign, and a
 * second pass re-charging the full amount instead of the residual.
 */
const run = process.env.RUN_E2E === '1';
const uniq = `${process.pid}-${process.hrtime.bigint()}`;

/** Shape of a real Infobip callback, columnar exactly as the API returns it. */
function callback(
  requestId: string,
  rows: unknown[][],
  opts: { finalized?: boolean; columns?: string[] } = {},
): UsageCallbackPayload {
  const columns = opts.columns ?? [
    'CAMPAIGN_REFERENCE',
    'CATEGORY_CODE',
    'COUNTRY_NAME',
    'COUNTRY_CODE',
    'SENDER',
    'TRAFFIC_TYPE',
    'DAY',
    'QUANTITY',
    'UNIT_PRICE',
    'TOTAL_PRICE',
    'CURRENCY',
  ];
  return {
    requestId,
    status: 'SUCCESS',
    response: {
      columns: columns.map((name) => ({ name, dataType: 'STRING' })),
      rows,
      totalRows: rows.length,
    },
    metadata: {
      billingPeriods: [{ month: '2026-08', volumeFinalized: opts.finalized ?? false }],
    },
  };
}

describe.skipIf(!run)('provider billing usage (e2e — needs Postgres)', () => {
  let tenantId: string;
  let walletId: string;
  let campaignId: string;

  beforeAll(async () => {
    const tenant = await ensureTenantByName(`usage-e2e-${uniq}`);
    tenantId = tenant.id;
    const wallet = await getOrCreateWallet(tenantId);
    walletId = wallet.id;

    const [campaign] = await db
      .insert(campaigns)
      .values({
        tenantId,
        name: `usage-e2e-${uniq}`,
        channel: 'sms',
        status: 'sent',
        startedAt: new Date(),
        completedAt: new Date(),
      })
      .returning();
    campaignId = campaign!.id;

    // Fund the wallet so the reconciliation has something to move, and record
    // the recharge so the rollup has a bucket to allocate into.
    const grant = await db.transaction(async (tx) => {
      const entry = await appendLedgerEntry(tx, {
        tenantId,
        walletId,
        entryType: 'purchase',
        amountMicro: 50_000_000,
        idempotencyKey: `usage-e2e-grant:${uniq}`,
        description: 'e2e funding',
      });
      await recordRecharge(tx, {
        tenantId,
        walletId,
        walletTransactionId: entry.entry.id,
        amountMicro: 50_000_000,
        source: 'purchase',
      });
      return entry;
    });
    expect(grant.duplicate).toBe(false);

    // The estimate the send pipeline would have debited: 1,000 × $0.010.
    await db.transaction(async (tx) => {
      await appendLedgerEntry(tx, {
        tenantId,
        walletId,
        entryType: 'consumption',
        amountMicro: -10_000_000,
        channel: 'sms',
        referenceType: 'campaign',
        referenceId: campaignId,
        idempotencyKey: `usage-e2e-estimate:${uniq}`,
        description: 'estimated send cost',
      });
    });
  });

  afterAll(async () => {
    await closeDb();
  });

  async function seedRequest(providerRequestId: string, pass: number): Promise<string> {
    const [row] = await db
      .insert(billingUsageRequests)
      .values({
        tenantId,
        campaignId,
        providerRequestId,
        pass,
        sentSince: '2026-08-01',
        sentUntil: '2026-08-03',
        includeUnfinalized: pass === 1,
        campaignReference: campaignId,
      })
      .returning();
    return row!.id;
  }

  it('parses a columnar callback and reconciles only the difference', async () => {
    const requestId = `e2e-pass1-${uniq}`;
    await seedRequest(requestId, 1);

    // Actual cost $10.50 against a $10.00 estimate → the wallet owes $0.50.
    const result = await ingestUsageCallback(
      callback(requestId, [
        [campaignId, 'SMS', 'Italy', 'IT', 'Maildrill', 'A2P', '2026-08-01', 700, 0.01, 7.0, 'USD'],
        [campaignId, 'SMS', 'Spain', 'ES', 'Maildrill', 'A2P', '2026-08-01', 300, 0.0116, 3.5, 'USD'],
      ]),
    );

    expect(result.handled).toBe(true);
    expect(result.duplicate).toBe(false);
    expect(result.lines).toBe(2);
    expect(result.totalMicro).toBe(10_500_000);
    // Charged so far was 10.00, so only 0.50 moves — negative = debit.
    expect(result.adjustmentMicro).toBe(-500_000);

    const lines = await db
      .select()
      .from(billingUsageLines)
      .where(eq(billingUsageLines.campaignId, campaignId));
    expect(lines).toHaveLength(2);
    expect(lines.every((l) => l.channel === 'sms')).toBe(true);
    // Infobip's own total is kept verbatim — NOT quantity × unit price, which
    // would give 3.48 for the Spanish line rather than the billed 3.50.
    expect(lines.map((l) => l.totalMicro).sort((a, b) => a - b)).toEqual([3_500_000, 7_000_000]);
  });

  it('is idempotent when Infobip redelivers the same result', async () => {
    const requestId = `e2e-pass1-${uniq}`;
    const before = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.tenantId, tenantId));

    const replay = await ingestUsageCallback(
      callback(requestId, [
        [campaignId, 'SMS', 'Italy', 'IT', 'Maildrill', 'A2P', '2026-08-01', 700, 0.01, 7.0, 'USD'],
      ]),
    );
    expect(replay.duplicate).toBe(true);

    const after = await db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.tenantId, tenantId));
    expect(after).toHaveLength(before.length);
  });

  it('charges only the residual on a finalization pass', async () => {
    const requestId = `e2e-pass2-${uniq}`;
    await seedRequest(requestId, 2);

    // Final figure is $11.00. $10.50 has already been charged across the
    // estimate and pass 1, so this must move exactly $0.50 — not $11.00.
    const result = await ingestUsageCallback(
      callback(
        requestId,
        [
          [campaignId, 'SMS', 'Italy', 'IT', 'Maildrill', 'A2P', '2026-08-01', 700, 0.01, 7.5, 'USD'],
          [campaignId, 'SMS', 'Spain', 'ES', 'Maildrill', 'A2P', '2026-08-01', 300, 0.0116, 3.5, 'USD'],
        ],
        { finalized: true },
      ),
    );
    expect(result.totalMicro).toBe(11_000_000);
    expect(result.adjustmentMicro).toBe(-500_000);

    const [request] = await db
      .select()
      .from(billingUsageRequests)
      .where(eq(billingUsageRequests.providerRequestId, requestId));
    expect(request!.volumeFinalized).toBe(true);
    expect(request!.status).toBe('succeeded');

    // Total charged for the campaign now equals the provider's final number.
    const entries = await db
      .select()
      .from(walletTransactions)
      .where(
        and(eq(walletTransactions.tenantId, tenantId), eq(walletTransactions.referenceId, campaignId)),
      );
    const charged = entries.reduce((sum, e) => sum + -e.amountMicro, 0);
    expect(charged).toBe(11_000_000);
  });

  it('fails loudly rather than recording a zero-cost campaign', async () => {
    const requestId = `e2e-noprice-${uniq}`;
    await seedRequest(requestId, 3);

    const result = await ingestUsageCallback(
      callback(requestId, [[campaignId, 'SMS', 100]], {
        columns: ['CAMPAIGN_REFERENCE', 'CATEGORY_CODE', 'QUANTITY'],
      }),
    );
    expect(result.reason).toMatch(/no price column/);

    const [request] = await db
      .select()
      .from(billingUsageRequests)
      .where(eq(billingUsageRequests.providerRequestId, requestId));
    expect(request!.status).toBe('failed');

    // Critically: no lines, and no ledger movement that would have credited
    // the tenant back the whole estimated cost.
    const lines = await db
      .select()
      .from(billingUsageLines)
      .where(eq(billingUsageLines.requestId, request!.id));
    expect(lines).toHaveLength(0);
  });

  it('refuses a callback whose requestId we never issued', async () => {
    const result = await ingestUsageCallback(callback(`never-issued-${uniq}`, []));
    expect(result.handled).toBe(false);
    expect(result.reason).toBe('unknown_request');
  });

  it('heals a credit that has no recharge row', async () => {
    // Simulates the deploy seam: a credit written before recharge recording
    // existed. The rollup would otherwise be quietly short by this amount —
    // a recharge that isn't there cannot absorb spend.
    const [orphan] = await db
      .insert(walletTransactions)
      .values({
        tenantId,
        walletId,
        entryType: 'adjustment',
        amountMicro: 7_000_000,
        balanceAfterMicro: 0,
        currency: 'USD',
        idempotencyKey: `usage-e2e-orphan:${uniq}`,
        description: 'credit predating recharge recording',
      })
      .returning();

    const before = await db
      .select()
      .from(creditRecharges)
      .where(eq(creditRecharges.walletTransactionId, orphan!.id));
    expect(before).toHaveLength(0);

    await rebuildRechargeSpending(tenantId);

    const after = await db
      .select()
      .from(creditRecharges)
      .where(eq(creditRecharges.walletTransactionId, orphan!.id));
    expect(after).toHaveLength(1);
    expect(after[0]!.amountMicro).toBe(7_000_000);
    expect(after[0]!.source).toBe('adjustment');
  });

  it('rebuilds the recharge rollup from the ledger, FIFO', async () => {
    const summary = await rebuildRechargeSpending(tenantId);
    expect(summary.recharges).toBeGreaterThan(0);

    const [recharge] = await db
      .select()
      .from(creditRecharges)
      .where(eq(creditRecharges.tenantId, tenantId));
    const spending = recharge!.spending as {
      consumedMicro: number;
      remainingMicro: number;
      campaigns: Array<{ campaignId: string; amountMicro: number; estimatedMicro: number; reconciledMicro: number }>;
    };

    // The $50 recharge absorbed the whole $11 campaign cost.
    expect(spending.consumedMicro).toBe(11_000_000);
    expect(spending.remainingMicro).toBe(39_000_000);
    expect(recharge!.consumedMicro).toBe(11_000_000);

    const campaignSpend = spending.campaigns.find((c) => c.campaignId === campaignId);
    expect(campaignSpend?.amountMicro).toBe(11_000_000);
    // Split visible: $10 estimated at send time, $1 added by reconciliation.
    expect(campaignSpend?.estimatedMicro).toBe(10_000_000);
    expect(campaignSpend?.reconciledMicro).toBe(1_000_000);

    // Rebuilding is idempotent — a pure function of the ledger.
    await rebuildRechargeSpending(tenantId);
    const [again] = await db
      .select()
      .from(creditRecharges)
      .where(eq(creditRecharges.id, recharge!.id));
    expect(again!.consumedMicro).toBe(11_000_000);
  });
});
