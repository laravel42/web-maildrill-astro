import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { config } from "@maildrill/config";
import { campaigns, db, messages, type MessageRow } from "@maildrill/database";
import {
  OPEN_DELIVERY_STATES,
  QUEUE_PENDING_STATES,
  isCampaignDispatched,
  outcomeFromInfobipStatusGroup,
  type MessageState,
} from "@maildrill/domain";
import {
  cellString,
  columnIndex,
  createLogger,
  hogqlLiteralList,
  runHogQL,
} from "@maildrill/observability";
import { applyProviderOutcome } from "./events";
import { getProvider } from "@maildrill/providers";

const log = createLogger({ component: "campaign-delivery" });

const HOGQL_CHUNK = 200;
const OPEN_MESSAGE_LIMIT = 1000;
/** Cap Infobip log lookups per poll so a large backlog can't stall the loop. */
const INFOBIP_STATUS_LIMIT = 50;

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
}

/** Pure: map HogQL rows → latest status_group (+ error) per maildrill message id. */
export function mapLatestStatusGroups(
  columns: string[],
  results: unknown[][],
): StatusGroupRow[] {
  const iId = columnIndex(columns, "maildrill_message_id");
  const iGroup = columnIndex(columns, "status_group");
  const iErrName = columnIndex(columns, "error_name");
  const iErrDesc = columnIndex(columns, "error_description");
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
    out.push({
      maildrillMessageId: id,
      statusGroup,
      ...(errorName ? { errorName } : {}),
      ...(errorDescription ? { errorDescription } : {}),
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

async function fetchStatusGroupsFromPostHog(
  messageIds: string[],
): Promise<Map<string, StatusGroupRow>> {
  const byId = new Map<string, StatusGroupRow>();
  if (messageIds.length === 0 || !config.posthog.statsEnabled) return byId;

  for (let i = 0; i < messageIds.length; i += HOGQL_CHUNK) {
    const chunk = messageIds.slice(i, i + HOGQL_CHUNK);
    const lits = hogqlLiteralList(chunk);
    if (!lits) {
      log.warn({ chunkSize: chunk.length }, "skip hogql chunk: unsafe message id");
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
  argMax(toString(properties.error_description), timestamp) AS error_description
FROM events
WHERE event IN ('message_delivery_report', 'message_voice_report')
  AND toString(properties.maildrill_message_id) IN (${lits.join(", ")})
GROUP BY maildrill_message_id
`.trim();

    const result = await runHogQL(query, "maildrill-campaign-delivery");
    if (!result) continue;

    for (const row of mapLatestStatusGroups(result.columns, result.results)) {
      byId.set(row.maildrillMessageId, row);
    }
  }

  return byId;
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
    });
    if (changed) updated += 1;
  }

  // PostHog miss → pull Infobip logs for remaining submitted/sent rows.
  updated += await syncOpenMessagesFromInfobip(
    open.filter((m) => !statusById.has(m.id)),
  );

  return updated;
}

async function syncOpenMessagesFromInfobip(open: MessageRow[]): Promise<number> {
  const provider = getProvider();
  if (!provider.getDeliveryStatusGroup && !provider.pullDeliveryReports) return 0;

  const byProviderId = new Map(
    open
      .filter((m) => m.providerMessageId)
      .map((m) => [m.providerMessageId!, m] as const),
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
        if (outcome === "submitted") continue;
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
      log.debug({ updated, resolved: resolved.size }, "infobip delivery report sync");
    }
    return updated;
  }

  let checked = 0;
  for (const msg of open) {
    if (resolved.has(msg.id)) continue;
    if (checked >= INFOBIP_STATUS_LIMIT) break;
    if (!msg.providerMessageId) continue;
    if (msg.status !== "submitted" && msg.status !== "sent") continue;
    checked += 1;

    const statusGroup = await provider.getDeliveryStatusGroup(
      msg.channel,
      msg.providerMessageId,
    );
    if (!statusGroup) continue;

    const outcome = outcomeFromInfobipStatusGroup(statusGroup);
    // PENDING maps to submitted — no transition; skip.
    if (outcome === "submitted") continue;

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
    log.debug({ checked, updated, resolved: resolved.size }, "infobip delivery report sync");
  }
  return updated;
}

/**
 * Flip a single campaign to `sent` when every message has left the send queue.
 * Safe to call after each dispatch; no-ops if still pending or already sent.
 */
export async function tryCompleteCampaign(
  campaignId: string,
  tenantId: string,
): Promise<boolean> {
  const camp = await db
    .select({ id: campaigns.id, status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  if (camp[0]?.status !== "sending") return false;

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
      and(
        eq(messages.campaignId, campaignId),
        inArray(messages.status, [...QUEUE_PENDING_STATES]),
      ),
    );
  if (Number(queuedLeft[0]?.n ?? 0) > 0) return false;

  await db
    .update(campaigns)
    .set({ status: "sent", completedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.status, "sending")));

  log.info(
    { campaignId, tenantId, messages: statuses.length },
    "campaign dispatch complete",
  );
  return true;
}

async function completeFinishedCampaigns(): Promise<number> {
  const sending = await db
    .select({ id: campaigns.id, tenantId: campaigns.tenantId })
    .from(campaigns)
    .where(eq(campaigns.status, "sending"))
    .orderBy(asc(campaigns.updatedAt), asc(campaigns.createdAt))
    .limit(200);

  let completed = 0;
  for (const camp of sending) {
    if (await tryCompleteCampaign(camp.id, camp.tenantId)) completed += 1;
  }

  return completed;
}

/**
 * Sync open message DLRs from PostHog and flip fully-dispatched campaigns to
 * `sent`. Safe to call when PostHog is unset — completion is queue-based.
 */
export async function pollCampaignDelivery(): Promise<DeliveryPollResult> {
  const open = await loadOpenMessages();
  let updated = 0;
  try {
    updated = await syncOpenMessages(open);
  } catch (err) {
    log.warn({ err }, "posthog delivery sync failed");
  }

  const campaignsCompleted = await completeFinishedCampaigns();

  return {
    openMessages: open.length,
    updated,
    campaignsCompleted,
  };
}
