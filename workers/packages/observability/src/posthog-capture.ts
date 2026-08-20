import { config } from '@maildrill/config';
import { createLogger } from './index';
import { metrics } from './metrics';

/**
 * Built on first use, not at import time. This module is re-exported from
 * `./index`, so evaluating `createLogger` at module scope runs before that
 * file's `logger` binding is initialized — a temporal-dead-zone crash that
 * takes down every importer of @maildrill/observability.
 */
let cached: ReturnType<typeof createLogger> | null = null;
function log(): ReturnType<typeof createLogger> {
  cached ??= createLogger({ component: 'posthog-capture' });
  return cached;
}

/**
 * Fire-and-forget event capture into PostHog.
 *
 * The rest of the platform READS from PostHog (`posthog-query.ts` runs HogQL);
 * this is the only place workers WRITE to it. It exists because delivery
 * events reach PostHog through Infobip's own webhook → Hog function path,
 * which nothing server-side can hook into — a billing result that arrives on
 * our callback has to be put there by us.
 *
 * Deliberately never throws and never blocks the caller's transaction:
 * analytics is downstream of money, so a PostHog outage must not roll back a
 * ledger entry or fail a webhook we have already accepted. A dropped event is
 * recoverable (the authoritative rows are in Postgres and can be replayed); a
 * rolled-back charge is not.
 */
export async function capturePostHogEvent(input: {
  event: string;
  distinctId: string;
  properties?: Record<string, unknown>;
  /** Dedupe key. PostHog drops repeats of the same uuid, so replays are safe. */
  uuid?: string;
  timestamp?: Date;
}): Promise<boolean> {
  if (!config.posthog.captureEnabled) return false;
  try {
    const res = await fetch(`${config.posthog.ingestHost}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: config.posthog.projectToken,
        event: input.event,
        distinct_id: input.distinctId,
        properties: input.properties ?? {},
        ...(input.uuid ? { uuid: input.uuid } : {}),
        timestamp: (input.timestamp ?? new Date()).toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      metrics.inc('posthog_capture_total', { outcome: 'rejected' });
      log().warn({ status: res.status, event: input.event }, 'posthog capture rejected');
      return false;
    }
    metrics.inc('posthog_capture_total', { outcome: 'ok' });
    return true;
  } catch (err) {
    metrics.inc('posthog_capture_total', { outcome: 'error' });
    log().warn(
      { err: err instanceof Error ? err.message : String(err), event: input.event },
      'posthog capture failed',
    );
    return false;
  }
}

/** Capture many events without letting one failure hide the others. */
export async function capturePostHogEvents(
  events: Parameters<typeof capturePostHogEvent>[0][],
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  for (const e of events) {
    if (await capturePostHogEvent(e)) sent += 1;
  }
  return { sent, failed: events.length - sent };
}
