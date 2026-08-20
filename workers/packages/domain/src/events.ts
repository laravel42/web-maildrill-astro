import { z } from 'zod';
import { channelSchema } from './channels';

/**
 * Maildrill domain events.
 *
 * A small, typed bus that lets product services announce what happened without knowing
 * that Automations exist. `@maildrill/product` and `@maildrill/services` call
 * `emitMaildrillEvent`; `@maildrill/automations` installs the sink that makes those events
 * durable and matches them against active automations.
 *
 * The bus lives in `@maildrill/domain` because it is the only package everything else
 * already depends on — putting it in `automations` would invert the dependency and create
 * a cycle (`product → automations → product`).
 *
 * DURABILITY: the sink writes a row and awaits it, immediately after the domain write. The
 * two are NOT in one transaction — retrofitting a `tx` through every call site would touch
 * most of the product layer. A process death between the two statements loses the event;
 * the window is one statement wide and the failure mode is a missed automation run, never
 * a corrupt one. Emitting is fire-and-await and must never throw into the caller: a broken
 * automation pipeline may not fail a subscriber import.
 */

export const MAILDRILL_EVENT_TYPES = [
  'subscriber.created',
  'subscriber.updated',
  'subscriber.unsubscribed',
  'subscriber.list.added',
  'subscriber.list.removed',
  'subscriber.tag.added',
  'subscriber.tag.removed',
  'subscriber.segment.entered',
  'subscriber.segment.exited',
  'campaign.sent',
  'campaign.delivered',
  'campaign.opened',
  'campaign.clicked',
  'campaign.bounced',
  'campaign.failed',
] as const;

export type MaildrillEventType = (typeof MAILDRILL_EVENT_TYPES)[number];

export const maildrillEventTypeSchema = z.enum(MAILDRILL_EVENT_TYPES);

/** Subscriber projection carried on every subscriber-shaped event. */
export const eventSubscriberSchema = z.object({
  id: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  name: z.string().nullable(),
  status: z.string(),
  attributes: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
});
export type EventSubscriber = z.infer<typeof eventSubscriberSchema>;

export const maildrillEventSchema = z.object({
  type: maildrillEventTypeSchema,
  tenantId: z.string().min(1),
  /**
   * Stable identity of the occurrence. Two deliveries of the same real-world event MUST
   * produce the same key — it is what stops a redelivered provider report from starting an
   * automation twice.
   */
  dedupeKey: z.string().min(1),
  occurredAt: z.date().optional(),
  data: z.object({
    subscriber: eventSubscriberSchema.optional(),
    subscriberId: z.string().optional(),
    listId: z.string().optional(),
    listName: z.string().optional(),
    segmentId: z.string().optional(),
    segmentName: z.string().optional(),
    tagId: z.string().optional(),
    tagName: z.string().optional(),
    campaignId: z.string().optional(),
    campaignName: z.string().optional(),
    messageId: z.string().optional(),
    channel: channelSchema.optional(),
    errorCode: z.string().optional(),
    errorMessage: z.string().optional(),
    url: z.string().optional(),
  }),
});
export type MaildrillEvent = z.infer<typeof maildrillEventSchema>;

export type MaildrillEventSink = (event: MaildrillEvent) => Promise<void>;

/**
 * Cheap, synchronous "is anyone listening?" check.
 *
 * Building an event payload costs queries — a campaign delivery has to look up the
 * subscriber and the campaign. On a million-recipient send that is a million pointless
 * round trips if no automation in the workspace watches campaign events. The automations
 * package installs a filter backed by a periodically refreshed subscription index; callers
 * ask `maildrillEventWanted` BEFORE assembling the payload.
 *
 * Fails open: with no filter installed, everything is wanted.
 */
export type MaildrillEventFilter = (type: MaildrillEventType, tenantId: string) => boolean;

let sink: MaildrillEventSink | null = null;
let filter: MaildrillEventFilter | null = null;

export function setMaildrillEventFilter(next: MaildrillEventFilter | null): void {
  filter = next;
}

export function maildrillEventWanted(type: MaildrillEventType, tenantId: string): boolean {
  if (sink === null) return false;
  return filter === null || filter(type, tenantId);
}

/** Install the durable sink. Called once per process by `@maildrill/automations`. */
export function setMaildrillEventSink(next: MaildrillEventSink | null): void {
  sink = next;
}

export function maildrillEventSinkInstalled(): boolean {
  return sink !== null;
}

/**
 * Announce a domain event. No-op when no sink is installed (every process that does not
 * run automations), and never throws — a sink failure is logged by the sink itself.
 */
export async function emitMaildrillEvent(event: MaildrillEvent): Promise<void> {
  const current = sink;
  if (!current) return;
  try {
    await current(event);
  } catch {
    /* the sink owns its own logging; domain writes must not fail on it */
  }
}

/**
 * Project a subscriber row onto the event envelope.
 *
 * Structurally typed rather than importing the Drizzle row: `@maildrill/domain` sits below
 * `@maildrill/database` and must stay dependency-free.
 */
export function projectSubscriber(row: {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  status: string;
  attributes: Record<string, unknown>;
  createdAt: Date;
}): EventSubscriber {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    name: row.name,
    status: row.status,
    attributes: row.attributes,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Deterministic dedupe key.
 *
 * The parts must identify the *occurrence*, not the moment it was noticed — so a
 * redelivered provider report produces the same key and the second delivery is a no-op.
 * Where an occurrence genuinely repeats (a subscriber re-joining a list), include the
 * timestamp so the second join is its own event.
 */
export function eventDedupeKey(
  type: MaildrillEventType,
  ...parts: (string | number | null | undefined)[]
): string {
  return [type, ...parts.map((p) => (p == null ? '' : String(p)))].join('|');
}
