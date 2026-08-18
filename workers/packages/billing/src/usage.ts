import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import type { Channel } from '@maildrill/domain';
import { knownTenantInfobipEntityId } from '@maildrill/identity';
import {
  capturePostHogEvent,
  createLogger,
  hogqlLiteralList,
  metrics,
  runHogQL,
} from '@maildrill/observability';
import {
  billingUsageLines,
  billingUsageRequests,
  campaigns,
  db,
  type BillingUsageRequestRow,
} from '@maildrill/database';
import { appendLedgerEntry } from './ledger';
import { rebuildRechargeSpending } from './recharges';
import { getOrCreateWallet } from './wallet';
import {
  CAMPAIGN_AGGREGATES,
  submitBillingUsageQuery,
  utcDay,
  withinRetentionWindow,
} from './usage-provider';

const log = createLogger({ component: 'billing-usage' });

/**
 * Provider-billed usage: ask Infobip what a campaign actually cost, then move
 * the wallet by the difference against what we estimated.
 *
 * WHY THIS EXISTS
 * ---------------
 * Every cost figure in the product used to come from the local rate card:
 * `quoteTenantPrice` × delivered messages. That is a *guess* — a good one, but
 * nothing ever compared it to the invoice, so it could drift indefinitely
 * without anyone noticing. These functions close the loop with the provider's
 * own numbers.
 *
 * THE TWO-PASS SHAPE
 * ------------------
 * Usage is not final when a campaign finishes. Infobip exposes this directly
 * (`metadata.billingPeriods[].volumeFinalized`) and gates it behind
 * `options.includeUnfinalizedData`. So:
 *
 *   pass 1  fired at campaign completion, includeUnfinalizedData: true
 *           → provisional cost, reconciled immediately so the wallet is never
 *             stale
 *   pass 2+ fired by the sweeper once the period closes, includeUnfinalized:
 *           false → final cost; the delta against pass 1 is reconciled again
 *
 * Each pass reconciles against the CUMULATIVE total charged so far for the
 * campaign, never against "the estimate" alone — see `reconcileCampaignCost`.
 * That is what makes running it twice, or ten times, converge instead of
 * double-charging.
 */

/** Ledger reference type for every provider-usage adjustment. */
const RECONCILE_REF = 'campaign_usage';

// ---------------------------------------------------------------------------
// Column resolution
// ---------------------------------------------------------------------------

/**
 * The callback is columnar: `columns: [{name, dataType}]` + `rows: [[...]]`,
 * and which columns appear depends on the `aggregateBy` we sent. Infobip's
 * published examples name the metric columns inconsistently across API
 * versions, so each field is resolved through an alias list rather than a
 * fixed offset.
 *
 * When a REQUIRED column cannot be resolved the whole ingest fails loudly
 * instead of defaulting to zero. A zero here would read as "this campaign cost
 * nothing", which is indistinguishable from a genuinely free campaign and
 * would quietly credit the tenant on the next reconciliation.
 */
const COLUMN_ALIASES = {
  campaignReference: ['CAMPAIGN_REFERENCE', 'CAMPAIGN_REFERENCE_ID', 'CAMPAIGN_REF'],
  categoryCode: ['CATEGORY_CODE', 'CATEGORY_NAME', 'CATEGORY'],
  countryName: ['COUNTRY_NAME'],
  countryCode: ['COUNTRY_CODE'],
  sender: ['SENDER'],
  trafficType: ['TRAFFIC_TYPE'],
  day: ['DAY', 'DATE', 'USAGE_DAY'],
  quantity: ['QUANTITY', 'MESSAGE_COUNT', 'COUNT', 'VOLUME'],
  unitPrice: ['UNIT_PRICE', 'PRICE_PER_UNIT', 'RATE'],
  total: ['TOTAL_PRICE', 'TOTAL', 'TOTAL_PER_UNIT', 'PRICE', 'AMOUNT'],
  currency: ['CURRENCY', 'CURRENCY_CODE'],
} as const;

type ColumnKey = keyof typeof COLUMN_ALIASES;

function resolveColumns(columns: Array<{ name?: unknown }>): Partial<Record<ColumnKey, number>> {
  const names = columns.map((c) => String(c?.name ?? '').trim().toUpperCase());
  const out: Partial<Record<ColumnKey, number>> = {};
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES) as Array<
    [ColumnKey, readonly string[]]
  >) {
    const idx = names.findIndex((n) => aliases.includes(n));
    if (idx >= 0) out[key] = idx;
  }
  return out;
}

/** Infobip category → our channel. Unmapped categories keep a null channel. */
function channelForCategory(category: string): Channel | null {
  switch (category.trim().toUpperCase()) {
    case 'SMS':
    case 'SMS_OPERATOR_FEE':
      return 'sms';
    case 'EMAIL':
      return 'email';
    case 'WHATSAPP':
      return 'whatsapp';
    case 'VOICE_VIDEO':
      return 'voice';
    default:
      return null;
  }
}

/**
 * Money arrives as a decimal number of currency units (e.g. 0.0072 EUR) and is
 * stored as integer micro-units. Rounding is half-up on the absolute value so
 * a price never rounds toward zero and silently under-bills.
 */
function toMicro(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  if (!Number.isFinite(n)) return 0;
  return Math.sign(n) * Math.round(Math.abs(n) * 1_000_000);
}

function toInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function cell(row: unknown[], idx: number | undefined): unknown {
  return idx === undefined ? undefined : row[idx];
}

function str(value: unknown): string | null {
  const s = value == null ? '' : String(value).trim();
  return s ? s : null;
}

// ---------------------------------------------------------------------------
// Submitting a query
// ---------------------------------------------------------------------------

export interface RequestUsageResult {
  submitted: boolean;
  reason?: string;
  requestId?: string;
}

/**
 * Ask Infobip what one campaign cost.
 *
 * The window is [first send day, last send day + 1) in UTC, widened by a day
 * on each side: Infobip buckets by ITS OWN send timestamp, which can differ
 * from ours by the queue latency either side of midnight, and the interval is
 * day-granular so there is no finer knob. Over-wide is safe because the
 * `campaignReferenceIds` filter already pins the rows to this campaign.
 */
export async function requestCampaignUsage(
  tenantId: string,
  campaignId: string,
  pass = 1,
): Promise<RequestUsageResult> {
  if (!config.infobip.billingUsageEnabled) {
    return { submitted: false, reason: 'not_configured' };
  }

  const [campaign] = await db
    .select({
      id: campaigns.id,
      channel: campaigns.channel,
      startedAt: campaigns.startedAt,
      completedAt: campaigns.completedAt,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)));
  if (!campaign) return { submitted: false, reason: 'campaign_not_found' };

  // Only channels that actually carried the tag can be filtered on; anything
  // else would come back as the whole account's traffic and be attributed to
  // this one campaign.
  if (!config.infobip.campaignRefChannels.includes(campaign.channel)) {
    return { submitted: false, reason: 'channel_not_tagged' };
  }

  const started = campaign.startedAt ?? campaign.createdAt;
  const ended = campaign.completedAt ?? new Date();
  const sentSince = utcDay(new Date(started.getTime() - 86_400_000));
  const sentUntil = utcDay(new Date(ended.getTime() + 2 * 86_400_000));

  if (!withinRetentionWindow(sentSince, new Date())) {
    // Past the current-month + previous-two window: the data is gone for good.
    return { submitted: false, reason: 'outside_retention_window' };
  }

  // Persist BEFORE submitting. The callback can land before this function's
  // next line runs, and without the row it would have nothing to correlate to
  // — and Infobip never redelivers.
  const [row] = await db
    .insert(billingUsageRequests)
    .values({
      tenantId,
      campaignId,
      providerRequestId: `pending:${campaignId}:${pass}`,
      status: 'pending',
      pass,
      sentSince,
      sentUntil,
      includeUnfinalized: pass === 1,
      campaignReference: campaignId,
    })
    .onConflictDoNothing({
      target: [billingUsageRequests.campaignId, billingUsageRequests.pass],
    })
    .returning();
  // Conflict = this pass already ran. Not an error; the sweeper retries by
  // opening a NEW pass, never by re-firing an existing one.
  if (!row) return { submitted: false, reason: 'pass_already_submitted' };

  // Scope the query to the workspace that owns the campaign, so the answer is
  // this workspace's spend rather than whatever else shared the account and the
  // window. Null entity (a workspace predating entity assignment) falls back to
  // the campaign-tag filter alone — the previous behaviour.
  const entityId = (await knownTenantInfobipEntityId(tenantId)) ?? undefined;
  const result = await submitBillingUsageQuery({
    sentSince,
    sentUntil,
    campaignReferenceIds: [campaignId],
    includeUnfinalizedData: pass === 1,
    aggregateBy: CAMPAIGN_AGGREGATES,
    ...(entityId ? { entityId } : {}),
  });

  if (!result.ok) {
    await db
      .update(billingUsageRequests)
      .set({ status: 'failed', failureMessage: result.error, respondedAt: new Date() })
      .where(eq(billingUsageRequests.id, row.id));
    log.warn({ campaignId, pass, err: result.error }, 'billing usage query not accepted');
    return { submitted: false, reason: result.error };
  }

  await db
    .update(billingUsageRequests)
    .set({ providerRequestId: result.requestId })
    .where(eq(billingUsageRequests.id, row.id));

  log.info({ campaignId, pass, requestId: result.requestId }, 'billing usage query submitted');
  return { submitted: true, requestId: result.requestId };
}

// ---------------------------------------------------------------------------
// Ingesting the callback
// ---------------------------------------------------------------------------

export interface UsageCallbackPayload {
  requestId?: unknown;
  status?: unknown;
  failureMessage?: unknown;
  response?: {
    columns?: Array<{ name?: unknown; dataType?: unknown }>;
    rows?: unknown[][];
    totalRows?: unknown;
  };
  metadata?: {
    billingPeriods?: Array<{ month?: unknown; volumeFinalized?: unknown }>;
  };
}

export interface IngestResult {
  handled: boolean;
  duplicate: boolean;
  reason?: string;
  lines?: number;
  totalMicro?: number;
  adjustmentMicro?: number;
}

/**
 * Accept one billing-usage callback.
 *
 * Idempotent on `providerRequestId`: a redelivery finds the request already
 * `succeeded` and returns without touching money. Beyond that, the ledger's own
 * `reconcile:<campaign>:<pass>` key is a second, independent guard — even if a
 * request row were somehow reprocessed, the entry could not be written twice.
 */
export async function ingestUsageCallback(payload: UsageCallbackPayload): Promise<IngestResult> {
  const providerRequestId = str(payload.requestId);
  if (!providerRequestId) return { handled: false, duplicate: false, reason: 'missing_request_id' };

  const [request] = await db
    .select()
    .from(billingUsageRequests)
    .where(eq(billingUsageRequests.providerRequestId, providerRequestId));
  if (!request) {
    // Unknown requestId: either a forged call or a result for a request whose
    // row was lost. Refused rather than guessed at — there is no safe default.
    log.warn({ providerRequestId }, 'billing usage callback for unknown request');
    return { handled: false, duplicate: false, reason: 'unknown_request' };
  }
  if (request.status === 'succeeded') {
    metrics.inc('billing_usage_callback_total', { outcome: 'duplicate' });
    return { handled: true, duplicate: true, lines: 0 };
  }

  const status = String(payload.status ?? '').trim().toUpperCase();
  if (status !== 'SUCCESS') {
    const failureMessage = str(payload.failureMessage) ?? `status=${status || 'unknown'}`;
    await db
      .update(billingUsageRequests)
      .set({
        status: 'failed',
        failureMessage,
        respondedAt: new Date(),
        rawResponse: payload as Record<string, unknown>,
      })
      .where(eq(billingUsageRequests.id, request.id));
    metrics.inc('billing_usage_callback_total', { outcome: 'failed' });
    return { handled: true, duplicate: false, reason: failureMessage };
  }

  const columns = payload.response?.columns ?? [];
  const rows = payload.response?.rows ?? [];
  const idx = resolveColumns(columns);

  // A payload we cannot price is a failure, not an empty result. Ingesting it
  // as zero rows would let the reconciliation credit back the whole estimate.
  if (rows.length > 0 && idx.total === undefined && idx.unitPrice === undefined) {
    const failureMessage = `no price column in callback; got [${columns
      .map((c) => String(c?.name ?? ''))
      .join(', ')}]`;
    await db
      .update(billingUsageRequests)
      .set({
        status: 'failed',
        failureMessage,
        respondedAt: new Date(),
        rawResponse: payload as Record<string, unknown>,
      })
      .where(eq(billingUsageRequests.id, request.id));
    log.error({ providerRequestId, columns }, 'billing usage callback had no price column');
    metrics.inc('billing_usage_callback_total', { outcome: 'unparseable' });
    return { handled: true, duplicate: false, reason: failureMessage };
  }

  // Every period the answer covers must be closed for the totals to be final.
  const periods = payload.metadata?.billingPeriods ?? [];
  const volumeFinalized =
    periods.length > 0 && periods.every((p) => p?.volumeFinalized === true);

  const parsed = rows.map((row, ordinal) => {
    const categoryCode = str(cell(row, idx.categoryCode)) ?? 'UNKNOWN';
    const quantity = toInt(cell(row, idx.quantity));
    const unitPriceMicro = toMicro(cell(row, idx.unitPrice));
    // Prefer Infobip's own total. Falling back to quantity × unit price is a
    // last resort: it silently disagrees with the invoice whenever a line
    // carries a surcharge or a partial-unit price.
    const totalMicro =
      idx.total !== undefined ? toMicro(cell(row, idx.total)) : unitPriceMicro * quantity;
    return {
      requestId: request.id,
      tenantId: request.tenantId,
      campaignId: request.campaignId,
      ordinal,
      categoryCode,
      channel: channelForCategory(categoryCode),
      countryName: str(cell(row, idx.countryName)),
      countryCode: str(cell(row, idx.countryCode)),
      sender: str(cell(row, idx.sender)),
      trafficType: str(cell(row, idx.trafficType)),
      usageDay: str(cell(row, idx.day)),
      quantity,
      unitPriceMicro,
      totalMicro,
      currency: str(cell(row, idx.currency)) ?? 'EUR',
    };
  });

  if (parsed.length > 0) {
    await db
      .insert(billingUsageLines)
      .values(parsed)
      .onConflictDoNothing({
        target: [billingUsageLines.requestId, billingUsageLines.ordinal],
      });
  }

  await db
    .update(billingUsageRequests)
    .set({
      status: 'succeeded',
      respondedAt: new Date(),
      volumeFinalized,
      rawResponse: payload as Record<string, unknown>,
    })
    .where(eq(billingUsageRequests.id, request.id));

  const totalMicro = parsed.reduce((sum, l) => sum + l.totalMicro, 0);
  const currency = parsed[0]?.currency ?? 'EUR';
  metrics.inc('billing_usage_callback_total', { outcome: 'ok' });

  // Analytics mirror. Emitted per line so PostHog can break spend down the same
  // way the API aggregated it, and keyed by request+ordinal so a replay of the
  // callback cannot double-count in the analytics store either.
  for (const line of parsed) {
    await capturePostHogEvent({
      event: 'infobip_billing_usage',
      distinctId: request.tenantId,
      uuid: `${request.id}:${line.ordinal}`,
      properties: {
        tenant_id: request.tenantId,
        campaign_id: request.campaignId,
        provider_request_id: providerRequestId,
        pass: request.pass,
        category_code: line.categoryCode,
        channel: line.channel,
        country_name: line.countryName,
        country_code: line.countryCode,
        sender: line.sender,
        traffic_type: line.trafficType,
        usage_day: line.usageDay,
        quantity: line.quantity,
        unit_price_micro: line.unitPriceMicro,
        total_micro: line.totalMicro,
        currency: line.currency,
        volume_finalized: volumeFinalized,
      },
    });
  }

  const adjustmentMicro = await reconcileCampaignCost(request, totalMicro, currency);

  // The rollup is derived, so it goes stale the moment the ledger moves.
  // Rebuilt out-of-band: it is a display convenience, and a slow rebuild must
  // not delay the 200 that tells Infobip we have the result (which it will
  // never send again).
  if (adjustmentMicro !== 0) {
    void rebuildRechargeSpending(request.tenantId).catch((err) =>
      log.warn(
        { err: err instanceof Error ? err.message : String(err), tenantId: request.tenantId },
        'recharge rollup rebuild failed — figures are stale until the next rebuild',
      ),
    );
  }

  log.info(
    {
      campaignId: request.campaignId,
      pass: request.pass,
      lines: parsed.length,
      totalMicro,
      currency,
      volumeFinalized,
      adjustmentMicro,
    },
    'billing usage callback ingested',
  );

  return {
    handled: true,
    duplicate: false,
    lines: parsed.length,
    totalMicro,
    adjustmentMicro,
  };
}

// ---------------------------------------------------------------------------
// Wallet reconciliation
// ---------------------------------------------------------------------------

/**
 * Move the wallet by the difference between what Infobip actually charged for
 * this campaign and what we have charged for it so far.
 *
 * The delta is computed against the CUMULATIVE ledger position for the
 * campaign — estimate debits (`consume:<messageId>`, tagged with the campaign)
 * plus every prior reconciliation — not against the estimate alone. That is
 * what makes pass 2 correct after pass 1 already moved money: each pass only
 * ever posts the residual, so running it again posts zero.
 *
 * Currency: the wallet is denominated in one currency and Infobip bills in
 * another (typically EUR). Rather than invent an FX rate — which would make
 * every figure downstream quietly wrong — a mismatch skips the wallet entirely
 * and is recorded on the request. The usage rows and the PostHog events are
 * still written, so reporting is complete even when the ledger cannot move.
 */
async function reconcileCampaignCost(
  request: BillingUsageRequestRow,
  actualMicro: number,
  currency: string,
): Promise<number> {
  if (!request.campaignId) return 0;
  if (actualMicro <= 0) return 0;

  const wallet = await getOrCreateWallet(request.tenantId);
  if (wallet.currency.toUpperCase() !== currency.toUpperCase()) {
    const reason = `currency_mismatch: wallet ${wallet.currency}, provider ${currency}`;
    await db
      .update(billingUsageRequests)
      .set({ failureMessage: reason })
      .where(eq(billingUsageRequests.id, request.id));
    log.warn(
      { campaignId: request.campaignId, walletCurrency: wallet.currency, currency },
      'skipping wallet reconciliation — no FX rate, refusing to guess one',
    );
    metrics.inc('billing_usage_reconcile_total', { outcome: 'currency_mismatch' });
    return 0;
  }

  // Everything already charged against this campaign, whatever its entry type:
  // estimates are negative consumption, prior reconciliations are signed
  // adjustments. Sum of both = what the tenant has paid for this campaign.
  const chargedRows = await db.execute<{ micro: string | number | null }>(sql`
    SELECT COALESCE(SUM(-amount_micro), 0) AS micro
    FROM wallet_transactions
    WHERE tenant_id = ${request.tenantId}
      AND (
        (reference_type = 'campaign' AND reference_id = ${request.campaignId})
        OR (reference_type = ${RECONCILE_REF} AND reference_id = ${request.campaignId})
      )
  `);
  // `db.execute` yields a QueryResult, not an array — the sum is on `.rows[0]`.
  const chargedMicro = Number(chargedRows.rows[0]?.micro ?? 0);
  const deltaMicro = actualMicro - chargedMicro;
  if (deltaMicro === 0) {
    metrics.inc('billing_usage_reconcile_total', { outcome: 'already_settled' });
    return 0;
  }

  // A positive delta means we under-charged, so the wallet must lose more:
  // ledger amounts are signed with debits negative, hence the inversion.
  const amountMicro = -deltaMicro;

  try {
    const result = await db.transaction(async (tx) =>
      appendLedgerEntry(tx, {
        tenantId: request.tenantId,
        walletId: wallet.id,
        entryType: 'adjustment',
        amountMicro,
        referenceType: RECONCILE_REF,
        referenceId: request.campaignId!,
        idempotencyKey: `reconcile:${request.campaignId}:${request.pass}`,
        description:
          deltaMicro > 0
            ? 'Provider billed more than estimated'
            : 'Provider billed less than estimated',
        metadata: {
          providerRequestId: request.providerRequestId,
          pass: request.pass,
          actualMicro,
          previouslyChargedMicro: chargedMicro,
          currency,
          volumeFinalized: request.volumeFinalized,
        },
        // A correction that pushes the balance below zero is still the true
        // number; refusing it would leave the ledger disagreeing with the
        // invoice, which is the exact drift this whole feature exists to end.
        allowNegativeBalance: true,
      }),
    );
    metrics.inc('billing_usage_reconcile_total', {
      outcome: result.duplicate ? 'duplicate' : 'applied',
    });
    return result.duplicate ? 0 : amountMicro;
  } catch (err) {
    log.error(
      { err: err instanceof Error ? err.message : String(err), campaignId: request.campaignId },
      'billing usage reconciliation failed',
    );
    metrics.inc('billing_usage_reconcile_total', { outcome: 'error' });
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Sweeper
// ---------------------------------------------------------------------------

/**
 * Two jobs, both consequences of "delivered once, no retry":
 *
 *   1. Time out `pending` requests whose callback never arrived. Without this
 *      they sit pending forever and the campaign looks like it is still being
 *      priced when in fact the answer was lost.
 *   2. Open a finalization pass for campaigns whose provisional numbers came
 *      back unfinalized, once the billing period has had time to close.
 */
export async function sweepBillingUsage(now = new Date()): Promise<{
  expired: number;
  refired: number;
}> {
  if (!config.infobip.billingUsageEnabled) return { expired: 0, refired: 0 };

  const callbackDeadline = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const expired = await db
    .update(billingUsageRequests)
    .set({
      status: 'expired',
      failureMessage: 'callback never arrived (Infobip delivers results once, with no retry)',
    })
    .where(
      and(
        eq(billingUsageRequests.status, 'pending'),
        lt(billingUsageRequests.requestedAt, callbackDeadline),
        isNull(billingUsageRequests.respondedAt),
      ),
    )
    .returning({ id: billingUsageRequests.id });

  // Finalization: a provisional pass whose periods were still open, left to
  // settle for two days. Anything already retried is skipped by the unique
  // (campaign, pass) index when the new pass is inserted.
  const refireCutoff = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const candidates = await db
    .select({
      tenantId: billingUsageRequests.tenantId,
      campaignId: billingUsageRequests.campaignId,
      pass: billingUsageRequests.pass,
    })
    .from(billingUsageRequests)
    .where(
      and(
        eq(billingUsageRequests.status, 'succeeded'),
        eq(billingUsageRequests.volumeFinalized, false),
        lt(billingUsageRequests.respondedAt, refireCutoff),
      ),
    )
    .limit(50);

  let refired = 0;
  for (const c of candidates) {
    if (!c.campaignId) continue;
    const result = await requestCampaignUsage(c.tenantId, c.campaignId, c.pass + 1);
    if (result.submitted) refired += 1;
  }

  if (expired.length || refired) {
    log.info({ expired: expired.length, refired }, 'billing usage sweep');
  }
  return { expired: expired.length, refired };
}

// ---------------------------------------------------------------------------
// PostHog transport
// ---------------------------------------------------------------------------

/**
 * Event the PostHog webhook emits for a billing-usage result.
 *
 * The Hog function behind `…/webhooks/…?kind=billing` needs one branch:
 *
 *   if (inputs.kind == 'billing') {
 *     postHogCapture({
 *       event: 'infobip_billing_usage_result',
 *       distinct_id: request.body.requestId,
 *       properties: {
 *         requestId: request.body.requestId,
 *         payload: jsonStringify(request.body),
 *       },
 *     })
 *   }
 *
 * `payload` is stringified deliberately. Property values survive the round
 * trip as opaque text, whereas a nested object comes back through HogQL with
 * its arrays reshaped — and `response.rows` is an array of arrays whose ORDER
 * carries the meaning, since the columns are positional.
 */
const USAGE_RESULT_EVENT = 'infobip_billing_usage_result';

/**
 * Pull billing-usage results that Infobip delivered to PostHog.
 *
 * Only used when the callback transport is `posthog`: the result lands in
 * PostHog rather than in this process, so nothing is ingested until something
 * goes and fetches it. Queried by the requestIds WE are waiting on rather than
 * "all recent events", which bounds the query, and means a forged event for a
 * requestId we never issued is never even looked at.
 *
 * Ingestion itself stays idempotent, so re-reading the same PostHog event on
 * the next tick (before the request flips to `succeeded`) cannot double-charge.
 */
export async function pullBillingUsageResults(limit = 100): Promise<{
  pending: number;
  ingested: number;
}> {
  const callback = config.infobip.billingCallback;
  if (!callback || callback.transport !== 'posthog') return { pending: 0, ingested: 0 };

  const pending = await db
    .select({ providerRequestId: billingUsageRequests.providerRequestId })
    .from(billingUsageRequests)
    .where(eq(billingUsageRequests.status, 'pending'))
    .limit(limit);
  if (pending.length === 0) return { pending: 0, ingested: 0 };

  // A request whose submission failed keeps its placeholder id; there is no
  // PostHog event to find for it.
  const ids = pending
    .map((p) => p.providerRequestId)
    .filter((id) => !id.startsWith('pending:'));
  const literals = hogqlLiteralList(ids);
  if (!literals || literals.length === 0) return { pending: pending.length, ingested: 0 };

  const result = await runHogQL(
    `SELECT properties.requestId, properties.payload
     FROM events
     WHERE event = '${USAGE_RESULT_EVENT}'
       AND properties.requestId IN (${literals.join(', ')})
       AND timestamp > now() - INTERVAL 7 DAY
     ORDER BY timestamp DESC
     LIMIT ${Math.max(1, limit)}`,
    'maildrill-billing-usage-pull',
  );
  if (!result) return { pending: pending.length, ingested: 0 };

  let ingested = 0;
  for (const row of result.results ?? []) {
    const raw = row?.[1];
    if (typeof raw !== 'string' || !raw) continue;
    let payload: UsageCallbackPayload;
    try {
      payload = JSON.parse(raw) as UsageCallbackPayload;
    } catch {
      log.warn({ requestId: row?.[0] }, 'billing usage event carried unparseable payload');
      continue;
    }
    const outcome = await ingestUsageCallback(payload);
    if (outcome.handled && !outcome.duplicate) ingested += 1;
  }

  if (ingested > 0) log.info({ pending: pending.length, ingested }, 'pulled billing usage results');
  return { pending: pending.length, ingested };
}
