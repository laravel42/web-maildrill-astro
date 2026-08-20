import { and, eq } from 'drizzle-orm';
import { campaigns, db, messages, subscribers } from '@maildrill/database';
import {
  emitMaildrillEvent,
  eventDedupeKey,
  maildrillEventWanted,
  projectSubscriber,
  type Channel,
  type MaildrillEventType,
} from '@maildrill/domain';

/**
 * Delivery pipeline → domain events.
 *
 * Campaign triggers fire per *recipient*: "campaign delivered" means this subscriber's
 * copy arrived, which is what a follow-up workflow acts on.
 *
 * The `maildrillEventWanted` guard is load-bearing, not defensive. Assembling one of these
 * payloads costs three lookups, and this runs once per recipient per state change — on a
 * million-recipient send that is three million queries spent for nothing in a workspace
 * with no campaign automation. The guard answers from an in-memory index, so the common
 * case costs a `Set.has`.
 */
export async function emitCampaignRecipientEvent(input: {
  type: Extract<
    MaildrillEventType,
    | 'campaign.sent'
    | 'campaign.delivered'
    | 'campaign.opened'
    | 'campaign.clicked'
    | 'campaign.bounced'
    | 'campaign.failed'
  >;
  tenantId: string;
  messageId: string;
  channel: Channel;
  /** Distinguishes repeat occurrences (a second click) from a redelivered report. */
  occurrenceKey?: string;
  errorCode?: string;
  errorMessage?: string;
  url?: string;
}): Promise<void> {
  if (!maildrillEventWanted(input.type, input.tenantId)) return;

  const [message] = await db
    .select({
      campaignId: messages.campaignId,
      recipientId: messages.recipientId,
    })
    .from(messages)
    .where(and(eq(messages.id, input.messageId), eq(messages.tenantId, input.tenantId)))
    .limit(1);

  // No campaign, no campaign trigger. This also keeps an automation's own sends from
  // feeding campaign triggers, which would be a loop nobody asked for.
  if (!message?.campaignId || !message.recipientId) return;

  const [subscriber] = await db
    .select()
    .from(subscribers)
    .where(and(eq(subscribers.id, message.recipientId), eq(subscribers.tenantId, input.tenantId)))
    .limit(1);
  if (!subscriber) return;

  const [campaign] = await db
    .select({ name: campaigns.name })
    .from(campaigns)
    .where(eq(campaigns.id, message.campaignId))
    .limit(1);

  await emitMaildrillEvent({
    type: input.type,
    tenantId: input.tenantId,
    // Keyed on (type, message) so a redelivered provider report is a no-op. Events that
    // legitimately repeat — a second click — pass an occurrence key.
    dedupeKey: eventDedupeKey(
      input.type,
      input.tenantId,
      input.messageId,
      input.occurrenceKey ?? '',
    ),
    data: {
      subscriber: projectSubscriber(subscriber),
      subscriberId: subscriber.id,
      campaignId: message.campaignId,
      campaignName: campaign?.name,
      messageId: input.messageId,
      channel: input.channel,
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      url: input.url,
    },
  });
}
