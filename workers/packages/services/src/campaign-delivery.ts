import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { config } from '@maildrill/config';
import { settleCampaignReservation } from '@maildrill/billing';
import { campaigns, db, messages, type MessageRow } from '@maildrill/database';
import {
  OPEN_DELIVERY_STATES,
  QUEUE_PENDING_STATES,
  isCampaignDispatched,
  outcomeFromInfobipStatusGroup,
  type MessageState,
} from '@maildrill/domain';
import {
  cellString,
  columnIndex,
  createLogger,
  hogqlLiteralList,
  runHogQL,
} from '@maildrill/observability';
import {
  applyProviderOutcome,
  applyTrackingOutcome,
  type TrackingNotificationType,
} from './events';
import { getProvider } from '@maildrill/providers';

const log = createLogger({ component: 'campaign-delivery' });

const HOGQL_CHUNK = 200;
const OPEN_MESSAGE_LIMIT = 1000;
/** Cap Infobip log lookups per poll so a large backlog can't stall the loop. */
const INFOBIP_STATUS_LIMIT = 50;
/**
 * Messages in these states can still advance to `read` from a seen report.
 * Delivered is intentionally outside OPEN_DELIVERY_STATES (campaign completion
 * doesn't wait for opens) — so engagement sync loads them separately.
 */
const ENGAGEMENT_CANDIDATE_STATES = [
  'submitted',
  'sent',
  'delivered',
] as const satisfies readonly MessageState[];
/** How far back to look for delivered rows still awaiting a seen report. */
const ENGAGEMENT_LOOKBACK_DAYS = 14;

export interface DeliveryPollResult {
  openMessages: number;
  updated: number;
  campaignsCompleted: number;
}

export interface StatusGroupRow {
  maildrillMessageId: string;
  statusGroup: string;
  errorName?: string;
  errorDescription?: string;
  /** Real call length in seconds from a voice DLR; absent for other channels. */
  voiceSeconds?: number;
}

/** Pure: map HogQL rows → latest status_group (+ error) per maildrill message id. */
export function mapLatestStatusGroups(columns: string[], results: unknown[][]): StatusGroupRow[] {
  const iId = columnIndex(columns, 'maildrill_message_id');
  const iGroup = columnIndex(columns, 'status_group');
  const iErrName = columnIndex(columns, 'error_name');
  const iErrDesc = columnIndex(columns, 'error_description');
  const iVoice = columnIndex(columns, 'voice_seconds');
  if (iId < 0 || iGroup < 0) return [];

  // Query already returns argMax / latest; keep first row per id if duplicates.
  const seen = new Set<string>();
  const out: StatusGroupRow[] = [];
  for (const row of results) {
    const id = cellString(row, iId);
    const statusGroup = cellString(row, iGroup);
    if (!id || !statusGroup || seen.has(id)) continue;
    seen.add(id);
    const errorName = iErrName >= 0 ? cellString(row, iErrName) : undefined;
    const errorDescription = iErrDesc >= 0 ? cellString(row, iErrDesc) : undefined;
    // 0 is a real answer (an unanswered call) — only a missing/NaN cell is
    // "no report yet", so guard on finiteness rather than truthiness.
    const voiceRaw = iVoice >= 0 ? Number(row[iVoice]) : Number.NaN;
    const voiceSeconds = Number.isFinite(voiceRaw) && voiceRaw >= 0 ? voiceRaw : undefined;
    out.push({
      maildrillMessageId: id,
      statusGroup,
      ...(errorName ? { errorName } : {}),
      ...(errorDescription ? { errorDescription } : {}),
      ...(voiceSeconds === undefined ? {} : { voiceSeconds }),
    });
  }
  return out;
}

/** Pure: HogQL rows → maildrill message ids that have a seen report. */
export function mapSeenMessageIds(columns: string[], results: unknown[][]): string[] {
  const iId = columnIndex(columns, 'maildrill_message_id');
  if (iId < 0) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of results) {
    const id = cellString(row, iId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export interface TrackingRow {
  maildrillMessageId: string;
  notificationType: TrackingNotificationType;
  url?: string;
  deviceType?: string;
  deviceName?: string;
  os?: string;
  fingerprint: string;
}

const TRACKING_TYPES = new Set<string>([
  'OPENED',
  'CLICKED',
  'UNSUBSCRIBED',
  'COMPLAINED',
  'LATE_BOUNCE',
]);

/** Pure: map HogQL tracking rows into typed engagement events. */
export function mapTrackingRows(columns: string[], results: unknown[][]): TrackingRow[] {
  const iId = columnIndex(columns, 'maildrill_message_id');
  const iType = columnIndex(columns, 'notification_type');
  const iUrl = columnIndex(columns, 'url');
  const iDevice = columnIndex(columns, 'device_type');
  const iName = columnIndex(columns, 'device_name');
  const iOs = columnIndex(columns, 'os');
  const iFp = columnIndex(columns, 'fingerprint');
  if (iId < 0 || iType < 0) return [];

  const out: TrackingRow[] = [];
  for (const row of results) {
    const id = cellString(row, iId);
    const notificationType = cellString(row, iType).toUpperCase();
    if (!id || !TRACKING_TYPES.has(notificationType)) continue;
    const fingerprint =
      (iFp >= 0 ? cellString(row, iFp) : '') ||
      `${id}:${notificationType}:${iUrl >= 0 ? cellString(row, iUrl) : ''}`;
    out.push({
      maildrillMessageId: id,
      notificationType: notificationType as TrackingNotificationType,
      fingerprint,
      ...(iUrl >= 0 && cellString(row, iUrl) ? { url: cellString(row, iUrl) } : {}),
      ...(iDevice >= 0 && cellString(row, iDevice) ? { deviceType: cellString(row, iDevice) } : {}),
      ...(iName >= 0 && cellString(row, iName) ? { deviceName: cellString(row, iName) } : {}),
      ...(iOs >= 0 && cellString(row, iOs) ? { os: cellString(row, iOs) } : {}),
    });
  }
  return out;
}

/** Pure: flip to `sent` once every message has left the send queue. */
export function shouldCompleteCampaign(statuses: MessageState[]): boolean {
  if (statuses.length === 0) return true;
  return statuses.every(isCampaignDispatched);
}

async function loadOpenMessages(): Promise<MessageRow[]> {
  // Oldest-updated first so a stable set of stuck rows cannot starve newer
  // campaigns when OPEN_MESSAGE_LIMIT is hit. Successful outcome writes bump
  // updatedAt and rotate them out of the front of the queue.
  return db
    .select()
    .from(messages)
    .where(inArray(messages.status, [...OPEN_DELIVERY_STATES]))
    .orderBy(asc(messages.updatedAt), asc(messages.createdAt))
    .limit(OPEN_MESSAGE_LIMIT);
}

async function loadEngagementCandidates(): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(
        inArray(messages.status, [...ENGAGEMENT_CANDIDATE_STATES]),
        sql`${messages.updatedAt} > now() - (${ENGAGEMENT_LOOKBACK_DAYS} * interval '1 day')`,
      ),
    )
    .orderBy(asc(messages.updatedAt), asc(messages.createdAt))
    .limit(OPEN_MESSAGE_LIMIT);
}

/** Delivered / read rows still eligible for click / unsub / complaint sync. */
async function loadTrackingCandidates(): Promise<MessageRow[]> {
  return db
    .select()
    .from(messages)
    .where(
      and(
        inArray(messages.status, ['submitted', 'sent', 'delivered', 'read']),
        sql`${messages.updatedAt} > now() - (${ENGAGEMENT_LOOKBACK_DAYS} * interval '1 day')`,
      ),
    )
    .orderBy(asc(messages.updatedAt), asc(messages.createdAt))
    .limit(OPEN_MESSAGE_LIMIT);
}

async function fetchStatusGroupsFromPostHog(
  messageIds: string[],
): Promise<Map<string, StatusGroupRow>> {
  const byId = new Map<string, StatusGroupRow>();
  if (messageIds.length === 0 || !config.posthog.statsEnabled) return byId;

  for (let i = 0; i < messageIds.length; i += HOGQL_CHUNK) {
    const chunk = messageIds.slice(i, i + HOGQL_CHUNK);
    const lits = hogqlLiteralList(chunk);
    if (!lits) {
      log.warn({ chunkSize: chunk.length }, 'skip hogql chunk: unsafe message id');
      continue;
    }

    // Voice DLRs land as message_voice_report when Infobip notify is routed via
    // the portal's ?kind=voice URL — same status_group shape as delivery.
    // error_* come from Infobip DLR payloads (e.g. EC_FREQUENCY_CAPPING).
    const query = `
SELECT
  toString(properties.maildrill_message_id) AS maildrill_message_id,
  argMax(toString(properties.status_group), timestamp) AS status_group,
  argMax(toString(properties.error_name), timestamp) AS error_name,
  argMax(toString(properties.error_description), timestamp) AS error_description,
  -- Voice only: what the call actually ran, so the trial gate can settle its
  -- pre-send estimate. chargedDuration is what Infobip bills; duration is the
  -- wall-clock fallback when the report omits it.
  argMax(
    coalesce(
      toFloat(properties.voice_call.chargedDuration),
      toFloat(properties.voice_call.duration)
    ),
    timestamp
  ) AS voice_seconds
FROM events
WHERE event IN ('message_delivery_report', 'message_voice_report')
  AND toString(properties.maildrill_message_id) IN (${lits.join(', ')})
GROUP BY maildrill_message_id
`.trim();

    const result = await runHogQL(query, 'maildrill-campaign-delivery');
    if (!result) continue;

    for (const row of mapLatestStatusGroups(result.columns, result.results)) {
      byId.set(row.maildrillMessageId, row);
    }
  }

  return byId;
}

async function fetchSeenMessageIdsFromPostHog(messageIds: string[]): Promise<Set<string>> {
  const ids = new Set<string>();
  if (messageIds.length === 0 || !config.posthog.statsEnabled) return ids;

  for (let i = 0; i < messageIds.length; i += HOGQL_CHUNK) {
    const chunk = messageIds.slice(i, i + HOGQL_CHUNK);
    const lits = hogqlLiteralList(chunk);
    if (!lits) {
      log.warn({ chunkSize: chunk.length }, 'skip hogql seen chunk: unsafe message id');
      continue;
    }

    // Seen reports have no status.groupName (Infobip payload is seenAt-only).
    // Presence of the event is the open signal — apply outcome `read`.
    const query = `
SELECT
  toString(properties.maildrill_message_id) AS maildrill_message_id
FROM events
WHERE event = 'message_seen_report'
  AND timestamp > now() - INTERVAL 30 DAY
  AND toString(properties.maildrill_message_id) IN (${lits.join(', ')})
GROUP BY maildrill_message_id
`.trim();

    const result = await runHogQL(query, 'maildrill-campaign-seen');
    if (!result) continue;

    for (const id of mapSeenMessageIds(result.columns, result.results)) {
      ids.add(id);
    }
  }

  return ids;
}

async function syncSeenReports(candidates: MessageRow[]): Promise<number> {
  const seenIds = await fetchSeenMessageIdsFromPostHog(candidates.map((m) => m.id));
  let updated = 0;

  for (const msg of candidates) {
    if (!seenIds.has(msg.id)) continue;

    const changed = await applyProviderOutcome({
      messageId: msg.id,
      tenantId: msg.tenantId,
      channel: msg.channel,
      provider: msg.provider,
      currentStatus: msg.status,
      outcome: 'read',
      statusGroup: 'SEEN',
    });
    if (changed) updated += 1;
  }

  if (candidates.length > 0 || updated > 0) {
    log.debug(
      { candidates: candidates.length, seen: seenIds.size, updated },
      'posthog seen report sync',
    );
  }
  return updated;
}

async function fetchTrackingRowsFromPostHog(messageIds: string[]): Promise<TrackingRow[]> {
  const out: TrackingRow[] = [];
  if (messageIds.length === 0 || !config.posthog.statsEnabled) return out;

  for (let i = 0; i < messageIds.length; i += HOGQL_CHUNK) {
    const chunk = messageIds.slice(i, i + HOGQL_CHUNK);
    const lits = hogqlLiteralList(chunk);
    if (!lits) {
      log.warn({ chunkSize: chunk.length }, 'skip hogql tracking chunk: unsafe message id');
      continue;
    }

    const query = `
SELECT
  toString(properties.maildrill_message_id) AS maildrill_message_id,
  upper(toString(properties.notification_type)) AS notification_type,
  toString(properties.url) AS url,
  toString(properties.device_type) AS device_type,
  toString(properties.device_name) AS device_name,
  toString(properties.os) AS os,
  toString(properties.$insert_id) AS fingerprint
FROM events
WHERE event = 'message_tracking_report'
  AND timestamp > now() - INTERVAL 30 DAY
  AND toString(properties.maildrill_message_id) IN (${lits.join(', ')})
`.trim();

    const result = await runHogQL(query, 'maildrill-campaign-tracking');
    if (!result) continue;
    out.push(...mapTrackingRows(result.columns, result.results));
  }

  return out;
}

async function syncTrackingReports(candidates: MessageRow[]): Promise<number> {
  const byId = new Map(candidates.map((m) => [m.id, m] as const));
  const rows = await fetchTrackingRowsFromPostHog([...byId.keys()]);
  let updated = 0;

  for (const row of rows) {
    const msg = byId.get(row.maildrillMessageId);
    if (!msg) continue;
    // Refresh status if an earlier row in this batch advanced it.
    const live = byId.get(msg.id)!;
    const changed = await applyTrackingOutcome({
      messageId: live.id,
      tenantId: live.tenantId,
      channel: live.channel,
      provider: live.provider,
      currentStatus: live.status,
      notificationType: row.notificationType,
      fingerprint: row.fingerprint,
      url: row.url,
      deviceType: row.deviceType,
      deviceName: row.deviceName,
      os: row.os,
    });
    if (changed) {
      updated += 1;
      if (row.notificationType === 'OPENED' || row.notificationType === 'CLICKED') {
        byId.set(live.id, { ...live, status: 'read' });
      } else if (row.notificationType === 'LATE_BOUNCE') {
        byId.set(live.id, { ...live, status: 'failed' });
      }
    }
  }

  if (candidates.length > 0 || updated > 0) {
    log.debug(
      { candidates: candidates.length, events: rows.length, updated },
      'posthog tracking report sync',
    );
  }
  return updated;
}

async function syncOpenMessages(open: MessageRow[]): Promise<number> {
  const statusById = await fetchStatusGroupsFromPostHog(open.map((m) => m.id));
  let updated = 0;

  for (const msg of open) {
    const row = statusById.get(msg.id);
    if (!row) continue;

    const outcome = outcomeFromInfobipStatusGroup(row.statusGroup);
    const changed = await applyProviderOutcome({
      messageId: msg.id,
      tenantId: msg.tenantId,
      channel: msg.channel,
      provider: msg.provider,
      currentStatus: msg.status,
      outcome,
      statusGroup: row.statusGroup,
      errorCode: row.errorName,
      errorMessage: row.errorDescription,
      voiceSeconds: row.voiceSeconds,
    });
    if (changed) updated += 1;
  }

  // PostHog miss → pull Infobip logs for remaining submitted/sent rows.
  updated += await syncOpenMessagesFromInfobip(open.filter((m) => !statusById.has(m.id)));

  return updated;
}

async function syncOpenMessagesFromInfobip(open: MessageRow[]): Promise<number> {
  const provider = getProvider();
  if (!provider.getDeliveryStatusGroup && !provider.pullDeliveryReports) return 0;

  const byProviderId = new Map(
    open.filter((m) => m.providerMessageId).map((m) => [m.providerMessageId!, m] as const),
  );
  if (byProviderId.size === 0) return 0;

  let updated = 0;
  const resolved = new Set<string>();

  // 1) Drain recent report batches (each Infobip DLR is returned only once).
  if (provider.pullDeliveryReports) {
    const channels = [...new Set(open.map((m) => m.channel))];
    for (const channel of channels) {
      const reports = await provider.pullDeliveryReports(channel, 200);
      for (const report of reports) {
        const msg = byProviderId.get(report.providerMessageId);
        if (!msg) continue;
        const outcome = outcomeFromInfobipStatusGroup(report.statusGroup);
        if (outcome === 'submitted') continue;
        const changed = await applyProviderOutcome({
          messageId: msg.id,
          tenantId: msg.tenantId,
          channel: msg.channel,
          provider: msg.provider,
          currentStatus: msg.status,
          outcome,
          statusGroup: report.statusGroup,
        });
        if (changed) updated += 1;
        resolved.add(msg.id);
      }
    }
  }

  // 2) Per-id lookup for anything still open (messageId filter on reports API).
  if (!provider.getDeliveryStatusGroup) {
    if (updated > 0 || resolved.size > 0) {
      log.debug({ updated, resolved: resolved.size }, 'infobip delivery report sync');
    }
    return updated;
  }

  let checked = 0;
  for (const msg of open) {
    if (resolved.has(msg.id)) continue;
    if (checked >= INFOBIP_STATUS_LIMIT) break;
    if (!msg.providerMessageId) continue;
    if (msg.status !== 'submitted' && msg.status !== 'sent') continue;
    checked += 1;

    const statusGroup = await provider.getDeliveryStatusGroup(msg.channel, msg.providerMessageId);
    if (!statusGroup) continue;

    const outcome = outcomeFromInfobipStatusGroup(statusGroup);
    // PENDING maps to submitted — no transition; skip.
    if (outcome === 'submitted') continue;

    const changed = await applyProviderOutcome({
      messageId: msg.id,
      tenantId: msg.tenantId,
      channel: msg.channel,
      provider: msg.provider,
      currentStatus: msg.status,
      outcome,
      statusGroup,
    });
    if (changed) updated += 1;
  }

  if (checked > 0 || updated > 0) {
    log.debug({ checked, updated, resolved: resolved.size }, 'infobip delivery report sync');
  }
  return updated;
}

/**
 * Flip a single campaign to `sent` when every message has left the send queue.
 * Safe to call after each dispatch; no-ops if still pending or already sent.
 */
export async function tryCompleteCampaign(campaignId: string, tenantId: string): Promise<boolean> {
  const camp = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  if (camp[0]?.status !== 'sending') return false;

  const rows = await db
    .select({ status: messages.status })
    .from(messages)
    .where(and(eq(messages.campaignId, campaignId), eq(messages.tenantId, tenantId)));

  const statuses = rows.map((r) => r.status);
  if (!shouldCompleteCampaign(statuses)) return false;

  // Guard: race with concurrent queue inserts / claims still in flight.
  const queuedLeft = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(eq(messages.campaignId, campaignId), inArray(messages.status, [...QUEUE_PENDING_STATES])),
    );
  if (Number(queuedLeft[0]?.n ?? 0) > 0) return false;

  await db
    .update(campaigns)
    .set({ status: 'sent', completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, 'sending')));

  // Return the campaign's unspent credit hold now that the batch is settled
  // (no-op unless billing enforcement is on).
  await settleCampaignReservation(tenantId, campaignId);

  log.info({ campaignId, tenantId, messages: statuses.length }, 'campaign dispatch complete');
  return true;
}

async function completeFinishedCampaigns(): Promise<number> {
  const sending = await db
    .select({ id: campaigns.id, tenantId: campaigns.tenantId })
    .from(campaigns)
    .where(eq(campaigns.status, 'sending'))
    .orderBy(asc(campaigns.updatedAt), asc(campaigns.createdAt))
    .limit(200);

  let completed = 0;
  for (const camp of sending) {
    if (await tryCompleteCampaign(camp.id, camp.tenantId)) completed += 1;
  }

  return completed;
}

/**
 * Sync open message DLRs + seen reports from PostHog and flip fully-dispatched
 * campaigns to `sent`. Safe to call when PostHog is unset — completion is
 * queue-based; seen sync no-ops without the personal API key.
 */
export async function pollCampaignDelivery(): Promise<DeliveryPollResult> {
  const open = await loadOpenMessages();
  let updated = 0;
  try {
    updated = await syncOpenMessages(open);
  } catch (err) {
    log.warn({ err }, 'posthog delivery sync failed');
  }

  try {
    const candidates = await loadEngagementCandidates();
    updated += await syncSeenReports(candidates);
  } catch (err) {
    log.warn({ err }, 'posthog seen sync failed');
  }

  try {
    const trackingCandidates = await loadTrackingCandidates();
    updated += await syncTrackingReports(trackingCandidates);
  } catch (err) {
    log.warn({ err }, 'posthog tracking sync failed');
  }

  const campaignsCompleted = await completeFinishedCampaigns();

  return {
    openMessages: open.length,
    updated,
    campaignsCompleted,
  };
}
