import { and, eq, inArray, sql } from 'drizzle-orm';
import { campaigns, db, messages, subscribers, type Campaign } from '@maildrill/database';
import { ConflictError, NotFoundError, type Channel } from '@maildrill/domain';
import { submitMessage } from '@maildrill/services';
import { createLogger } from '@maildrill/observability';
import { addressForChannel, resolveAudience, type AudienceSelector } from './audience';
import { getTemplate, resolveMessageContent } from './templates';

const log = createLogger({ component: 'campaigns' });
const MAX_AUDIENCE = 5000;

export interface CampaignRecipientEvent {
  id: string;
  recipientId: string | null;
  /** Subscriber display name when the recipient still exists in the CRM. */
  name: string | null;
  /** The address the message was actually sent to (email or phone). */
  address: string;
  channel: Channel;
  status: string;
  /** Engagement beyond message status, from provider events. */
  clicked: boolean;
  unsubscribed: boolean;
  /** Most meaningful moment for the row: delivered/failed/sent, else last update. */
  at: Date | null;
}

/**
 * Per-recipient message outcomes for a campaign report, newest first. Joined
 * against subscribers for display names; messages survive recipient deletion
 * (recipient_id is a soft reference), so the name may be null.
 */
export async function listCampaignMessages(
  tenantId: string,
  campaignId: string,
  limit = 200,
): Promise<CampaignRecipientEvent[]> {
  const at = sql<Date | null>`coalesce(${messages.deliveredAt}, ${messages.failedAt}, ${messages.sentAt}, ${messages.updatedAt})`;
  return db
    .select({
      id: messages.id,
      recipientId: messages.recipientId,
      name: subscribers.name,
      address: messages.toAddress,
      channel: messages.channel,
      status: messages.status,
      clicked: sql<boolean>`exists (select 1 from message_events e where e.message_id = ${messages.id} and e.event_type = 'click')`,
      unsubscribed: sql<boolean>`exists (select 1 from message_events e where e.message_id = ${messages.id} and e.event_type = 'unsubscribed')`,
      at,
    })
    .from(messages)
    .leftJoin(
      subscribers,
      sql`${subscribers.id}::text = ${messages.recipientId} and ${subscribers.tenantId} = ${messages.tenantId}`,
    )
    .where(and(eq(messages.tenantId, tenantId), eq(messages.campaignId, campaignId)))
    .orderBy(sql`${at} desc nulls last`)
    .limit(Math.min(Math.max(limit, 1), 500));
}

/**
 * Statuses a campaign may be sent from. "sending" and "sent" are absent by
 * design: claiming the row is what makes a double-click (or a retried request)
 * unable to send the same campaign twice.
 */
const SENDABLE_STATUSES = ['draft', 'scheduled', 'paused'] as const;

export interface SendCampaignInput {
  tenantId: string;
  /**
   * Send an existing draft in place. Without it a new campaign row is created,
   * which is what the fire-and-forget `/v1/campaigns/send` API does.
   */
  campaignId?: string;
  name?: string;
  channel: Channel;
  selector: AudienceSelector;
  templateId?: string;
  content?: Record<string, unknown>;
  scheduledAt?: Date | null;
}

export interface SendCampaignResult {
  campaignId: string;
  audience: number;
  queued: number;
  truncated: boolean;
}

/**
 * Move an existing campaign into "sending" — but only from a status it is
 * legal to send from. The status predicate lives in the UPDATE itself, so two
 * concurrent sends race on a single atomic write and exactly one wins; the
 * loser gets no row back and is rejected. Without this, double-clicking "Send"
 * would deliver the campaign to every recipient twice.
 */
async function claimForSending(
  tenantId: string,
  campaignId: string,
  startedAt: Date | null,
): Promise<Campaign> {
  const claimed = await db
    .update(campaigns)
    .set({ status: 'sending', startedAt, updatedAt: new Date() })
    .where(
      and(
        eq(campaigns.id, campaignId),
        eq(campaigns.tenantId, tenantId),
        inArray(campaigns.status, [...SENDABLE_STATUSES]),
      ),
    )
    .returning();

  if (claimed[0]) return claimed[0];

  // Nothing claimed: separate "not yours / gone" from "already in flight".
  const existing = await db
    .select({ status: campaigns.status })
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  if (!existing[0]) throw new NotFoundError('campaign not found');
  throw new ConflictError(`campaign is already ${existing[0].status}`);
}

/**
 * Resolve an audience and submit one message per recipient through the messaging
 * service (transactional outbox → dispatch). Personalizes from a template when
 * `templateId` is given. This is the product → messaging hand-off.
 *
 * Pass `campaignId` to send an existing draft in place; otherwise a new campaign
 * row is created. Sending a draft claims it first, so a campaign can never be
 * sent twice.
 *
 * NOTE: v1 submits sequentially and caps the audience at MAX_AUDIENCE. Large
 * campaigns should fan out via a batched scheduler job — see the messaging
 * scheduler for the pattern.
 */
export async function sendCampaign(input: SendCampaignInput): Promise<SendCampaignResult> {
  const scheduled = input.scheduledAt != null && input.scheduledAt.getTime() > Date.now();
  const now = new Date();

  const template = input.templateId ? await getTemplate(input.tenantId, input.templateId) : null;

  // WhatsApp marketing broadcasts must send through a Meta-approved template.
  // Gate before claiming so a rejected send leaves the draft untouched (not
  // stranded in "sending").
  if (input.channel === 'whatsapp' && template && template.approvalStatus !== 'approved') {
    throw new ConflictError(
      'WhatsApp template must be approved by Meta before this campaign can send',
    );
  }

  // Claim before resolving the audience: an in-flight campaign must be rejected
  // even while a concurrent send is still building its recipient list.
  const camp = input.campaignId
    ? await claimForSending(input.tenantId, input.campaignId, scheduled ? null : now)
    : (
        await db
          .insert(campaigns)
          .values({
            tenantId: input.tenantId,
            name: input.name ?? 'campaign',
            status: scheduled ? 'scheduled' : 'sending',
            channel: input.channel,
            listId: input.selector.listId ?? null,
            segmentId: input.selector.segmentId ?? null,
            templateId: input.templateId ?? null,
            content: input.content ?? {},
            scheduledAt: input.scheduledAt ?? null,
            startedAt: scheduled ? null : now,
          })
          .returning()
      )[0]!;

  const resolved = await resolveAudience(input.tenantId, input.selector, input.channel, {
    limit: MAX_AUDIENCE,
  });
  const truncated = resolved.length >= MAX_AUDIENCE;

  let queued = 0;
  for (const sub of resolved) {
    const to = addressForChannel(sub, input.channel);
    if (!to) continue;
    const content = resolveMessageContent(template, sub, input.content, input.channel);
    await submitMessage({
      tenantId: input.tenantId,
      channel: input.channel,
      to,
      content,
      recipientId: sub.id,
      campaignId: camp.id,
      scheduledAt: input.scheduledAt ?? null,
    });
    queued += 1;
  }

  // Immediate sends stay `sending` until every message leaves the dispatch
  // queue. Empty audience has nothing to wait for.
  if (scheduled) {
    await db
      .update(campaigns)
      .set({ status: 'scheduled', completedAt: null, updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  } else if (queued === 0) {
    await db
      .update(campaigns)
      .set({ status: 'sent', completedAt: new Date(), updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  } else {
    await db
      .update(campaigns)
      .set({ status: 'sending', updatedAt: new Date() })
      .where(eq(campaigns.id, camp.id));
  }

  log.info(
    { campaignId: camp.id, channel: input.channel, audience: resolved.length, queued },
    'campaign submitted',
  );
  return { campaignId: camp.id, audience: resolved.length, queued, truncated };
}

/**
 * Send a saved draft using the audience, template, and schedule stored on it.
 * This is what the app's "Send now" button hits — the draft the user has been
 * editing becomes the campaign that sends, rather than a fresh copy of it.
 *
 * `overrideScheduledAt` lets the caller send a scheduled draft immediately
 * (pass null) without first rewriting the stored schedule.
 */
export async function sendCampaignDraft(
  tenantId: string,
  campaignId: string,
  overrideScheduledAt?: Date | null,
): Promise<SendCampaignResult> {
  const rows = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.tenantId, tenantId)))
    .limit(1);
  const draft = rows[0];
  if (!draft) throw new NotFoundError('campaign not found');

  const content = draft.content as Record<string, unknown>;
  if (!draft.templateId && Object.keys(content).length === 0) {
    throw new ConflictError('campaign has no template or content to send');
  }

  return sendCampaign({
    tenantId,
    campaignId: draft.id,
    name: draft.name,
    channel: draft.channel,
    selector: {
      listId: draft.listId ?? undefined,
      segmentId: draft.segmentId ?? undefined,
    },
    templateId: draft.templateId ?? undefined,
    content,
    scheduledAt: overrideScheduledAt !== undefined ? overrideScheduledAt : draft.scheduledAt,
  });
}
