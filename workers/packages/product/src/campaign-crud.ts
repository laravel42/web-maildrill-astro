import { and, desc, eq, sql } from "drizzle-orm";
import {
  campaigns,
  db,
  lists,
  messages,
  segments,
  type Campaign,
  type NewCampaign,
} from "@maildrill/database";
import type { Channel } from "@maildrill/domain";

/**
 * Campaign drafts. The stored shape mirrors the `/v1/campaigns/send` contract
 * (channel + audience selector + template/content + schedule) so a saved draft
 * can be handed straight to the messaging engine.
 *
 * Delivery counters are derived from the `messages` table rather than stored,
 * so they can never drift from reality. Open/click rates are intentionally
 * absent: no provider open/click events are normalized yet, and inventing them
 * would be worse than reporting nothing.
 */

export interface UpsertCampaignInput {
  tenantId: string;
  name: string;
  channel?: Channel;
  status?: string;
  listId?: string | null;
  segmentId?: string | null;
  templateId?: string | null;
  content?: Record<string, unknown>;
  scheduledAt?: Date | null;
}

/** A campaign plus its derived audience label and delivery counters. */
export interface CampaignWithStats extends Campaign {
  /** Human label for the target: list name, segment name, or "All subscribers". */
  audience: string;
  recipients: number;
  delivered: number;
  failed: number;
  /**
   * Messages past the queue (submitted/sent/terminal). Used for the in-send
   * progress bar so it advances when Infobip accepts, not only after DLRs.
   */
  accepted: number;
  /** Most recent provider error when any message failed (detail GET only). */
  lastErrorMessage?: string | null;
}

/** Per-campaign message counters, keyed by campaign id. */
async function statsFor(
  tenantId: string,
): Promise<
  Map<string, { recipients: number; delivered: number; failed: number; accepted: number }>
> {
  const rows = await db
    .select({
      campaignId: messages.campaignId,
      recipients: sql<number>`count(*)::int`,
      // Progress treats engagement-after-delivery as done; match CAMPAIGN_COMPLETE_STATES.
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} in ('failed', 'cancelled', 'expired'))::int`,
      // Accepted by provider (or finished): everything except still waiting in queue.
      accepted: sql<number>`count(*) filter (where ${messages.status} not in ('queued', 'processing', 'draft', 'scheduled'))::int`,
    })
    .from(messages)
    .where(eq(messages.tenantId, tenantId))
    .groupBy(messages.campaignId);

  const map = new Map<
    string,
    { recipients: number; delivered: number; failed: number; accepted: number }
  >();
  for (const r of rows) {
    if (r.campaignId) {
      map.set(r.campaignId, {
        recipients: Number(r.recipients),
        delivered: Number(r.delivered),
        failed: Number(r.failed),
        accepted: Number(r.accepted),
      });
    }
  }
  return map;
}

async function lastFailedMessageError(
  tenantId: string,
  campaignId: string,
): Promise<string | null> {
  const rows = await db
    .select({ message: messages.lastErrorMessage })
    .from(messages)
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messages.campaignId, campaignId),
        eq(messages.status, "failed"),
      ),
    )
    .orderBy(desc(messages.updatedAt))
    .limit(1);
  const msg = rows[0]?.message;
  return typeof msg === "string" && msg.trim() ? msg.trim() : null;
}

function audienceLabel(listName: string | null, segmentName: string | null): string {
  return listName ?? segmentName ?? "All subscribers";
}

export async function listCampaigns(tenantId: string): Promise<CampaignWithStats[]> {
  const rows = await db
    .select({
      campaign: campaigns,
      listName: lists.name,
      segmentName: segments.name,
    })
    .from(campaigns)
    .leftJoin(lists, eq(campaigns.listId, lists.id))
    .leftJoin(segments, eq(campaigns.segmentId, segments.id))
    .where(eq(campaigns.tenantId, tenantId))
    .orderBy(desc(campaigns.createdAt));

  const stats = await statsFor(tenantId);
  return rows.map((r) => ({
    ...r.campaign,
    audience: audienceLabel(r.listName, r.segmentName),
    recipients: stats.get(r.campaign.id)?.recipients ?? 0,
    delivered: stats.get(r.campaign.id)?.delivered ?? 0,
    failed: stats.get(r.campaign.id)?.failed ?? 0,
    accepted: stats.get(r.campaign.id)?.accepted ?? 0,
  }));
}

export async function getCampaign(
  tenantId: string,
  id: string,
): Promise<CampaignWithStats | null> {
  const rows = await db
    .select({
      campaign: campaigns,
      listName: lists.name,
      segmentName: segments.name,
    })
    .from(campaigns)
    .leftJoin(lists, eq(campaigns.listId, lists.id))
    .leftJoin(segments, eq(campaigns.segmentId, segments.id))
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const stats = await statsFor(tenantId);
  const counters = stats.get(row.campaign.id);
  const failed = counters?.failed ?? 0;
  return {
    ...row.campaign,
    audience: audienceLabel(row.listName, row.segmentName),
    recipients: counters?.recipients ?? 0,
    delivered: counters?.delivered ?? 0,
    failed,
    accepted: counters?.accepted ?? 0,
    lastErrorMessage:
      failed > 0 ? await lastFailedMessageError(tenantId, row.campaign.id) : null,
  };
}

export async function createCampaign(input: UpsertCampaignInput): Promise<CampaignWithStats> {
  const rows = await db
    .insert(campaigns)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      status: input.status ?? "draft",
      channel: input.channel ?? "email",
      listId: input.listId ?? null,
      segmentId: input.segmentId ?? null,
      templateId: input.templateId ?? null,
      content: input.content ?? {},
      scheduledAt: input.scheduledAt ?? null,
    })
    .returning();
  const created = rows[0]!;
  return (await getCampaign(input.tenantId, created.id))!;
}

export async function updateCampaign(
  tenantId: string,
  id: string,
  patch: Partial<Omit<UpsertCampaignInput, "tenantId">>,
): Promise<CampaignWithStats | null> {
  const set: Partial<NewCampaign> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.status !== undefined) set.status = patch.status;
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.listId !== undefined) set.listId = patch.listId;
  if (patch.segmentId !== undefined) set.segmentId = patch.segmentId;
  if (patch.templateId !== undefined) set.templateId = patch.templateId;
  if (patch.content !== undefined) set.content = patch.content;
  if (patch.scheduledAt !== undefined) set.scheduledAt = patch.scheduledAt;

  const rows = await db
    .update(campaigns)
    .set(set)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning({ id: campaigns.id });
  if (rows.length === 0) return null;
  return getCampaign(tenantId, id);
}

export async function deleteCampaign(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(campaigns)
    .where(and(eq(campaigns.id, id), eq(campaigns.tenantId, tenantId)))
    .returning({ id: campaigns.id });
  return rows.length > 0;
}
