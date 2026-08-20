import { config } from '@maildrill/config';
import { createLogger, metrics } from '@maildrill/observability';

const log = createLogger({ component: 'billing-usage-provider' });

/**
 * Thin client for Infobip's Billing Usage API.
 *
 * Deliberately NOT part of `@maildrill/providers`: that package models message
 * delivery (send, DLR, templates) and billing has no business being routed
 * through a `MessagingProvider`. The only thing shared with it is the
 * `Authorization: App <key>` convention, which is one line.
 *
 * The API is asynchronous by design. `POST /billing/1/usage/query` returns
 * nothing but a `requestId`; the answer is POSTed to `callbackUrl` later —
 * ONCE, with no retry cycle. That single-delivery guarantee is the reason
 * every submission is persisted before it is sent (see `billing_usage_requests`):
 * a result that arrives while we are mid-deploy has nowhere to land unless the
 * correlation row already exists, and it will never be sent again.
 */

/** Aggregation dimensions we ask for. Order defines the response columns. */
export const CAMPAIGN_AGGREGATES = [
  // Campaign first so a per-campaign query is self-describing even when the
  // filter is widened later.
  'CAMPAIGN_REFERENCE',
  'CATEGORY_CODE',
  'COUNTRY_NAME',
  'COUNTRY_CODE',
  'SENDER',
  'TRAFFIC_TYPE',
  'DAY',
] as const;

export interface BillingUsageQueryInput {
  /** Inclusive, `yyyy-MM-dd`, UTC. */
  sentSince: string;
  /** Exclusive, `yyyy-MM-dd`, UTC. */
  sentUntil: string;
  /** Campaign tags to scope to. Empty → account-wide for the window. */
  campaignReferenceIds?: string[];
  /**
   * CPaaS X entity to scope to — the workspace that owns the traffic. Omitted
   * → the window covers every entity on the account. Only traffic that carried
   * the entity at send time is matched; Infobip does not backfill it, so a
   * campaign sent before the workspace had an entity answers empty under this
   * filter rather than falling back to account-wide numbers.
   */
  entityId?: string;
  /**
   * False only on a finalization pass. Usage for a just-finished campaign is
   * always unfinalized, so pass 1 must ask for it or the answer is empty.
   */
  includeUnfinalizedData: boolean;
  aggregateBy?: readonly string[];
}

export type BillingUsageQueryResult =
  | { ok: true; requestId: string }
  | { ok: false; error: string; retryable: boolean };

/** `yyyy-MM-dd` in UTC — the only granularity the API accepts. */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Infobip keeps billing usage for the current month plus the previous two
 * calendar months. Asking outside that window returns nothing, so a campaign
 * that finished long ago (or a finalization pass that waited too long) is
 * permanently unreconcilable — worth failing loudly rather than recording a
 * zero-cost campaign.
 */
export function withinRetentionWindow(sentSince: string, now: Date): boolean {
  const since = new Date(`${sentSince}T00:00:00Z`);
  if (Number.isNaN(since.getTime())) return false;
  const floor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 2, 1));
  return since >= floor;
}

export async function submitBillingUsageQuery(
  input: BillingUsageQueryInput,
): Promise<BillingUsageQueryResult> {
  const base = config.infobip.baseUrl.trim().replace(/\/+$/, '');
  const key = config.infobip.apiKey.trim();
  const callbackUrl = callbackUrlWithToken();
  if (!base || !key || !callbackUrl) {
    return { ok: false, error: 'infobip billing usage is not configured', retryable: false };
  }

  const body = {
    callbackUrl,
    request: {
      filterBy: {
        dateInterval: { sentSince: input.sentSince, sentUntil: input.sentUntil },
        ...(input.campaignReferenceIds?.length
          ? { campaignReferenceIds: input.campaignReferenceIds }
          : {}),
        ...(input.entityId ? { platforms: [{ entityId: input.entityId }] } : {}),
      },
      aggregateBy: [...(input.aggregateBy ?? CAMPAIGN_AGGREGATES)],
      options: { includeUnfinalizedData: input.includeUnfinalizedData },
    },
  };

  try {
    const res = await fetch(`${base}/billing/1/usage/query`, {
      method: 'POST',
      headers: {
        Authorization: `App ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });

    const text = await res.text();
    if (!res.ok) {
      metrics.inc('billing_usage_query_total', { outcome: 'rejected' });
      // 429 and 5xx are worth another attempt; a 400 means the request itself
      // is wrong and retrying it just burns quota.
      const retryable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        error: `infobip ${res.status}: ${text.slice(0, 500)}`,
        retryable,
      };
    }

    const parsed = JSON.parse(text) as { requestId?: unknown };
    const requestId = typeof parsed.requestId === 'string' ? parsed.requestId.trim() : '';
    if (!requestId) {
      metrics.inc('billing_usage_query_total', { outcome: 'malformed' });
      return { ok: false, error: 'infobip 201 carried no requestId', retryable: false };
    }
    metrics.inc('billing_usage_query_total', { outcome: 'accepted' });
    return { ok: true, requestId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn({ err: message }, 'billing usage query failed');
    metrics.inc('billing_usage_query_total', { outcome: 'error' });
    return { ok: false, error: message, retryable: true };
  }
}

/**
 * Where the result should be POSTed. Resolved by config, which picks between
 * our own token-guarded endpoint and the PostHog webhook that already receives
 * Infobip DLRs. Never logged: the direct form embeds the callback token.
 */
export function callbackUrlWithToken(): string {
  return config.infobip.billingCallback?.url ?? '';
}
