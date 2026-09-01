import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const channelEnum = pgEnum('channel', ['email', 'sms', 'whatsapp', 'voice']);

/**
 * WhatsApp template approval state (Meta review, brokered by Infobip). Only
 * meaningful for `channel = "whatsapp"` templates; null on every other channel.
 * `draft` = created in-app, not yet submitted; `pending` = submitted, awaiting
 * review; `paused`/`disabled` collapse Meta's paused/flagged/disabled states.
 */
export const templateApprovalStatusEnum = pgEnum('template_approval_status', [
  'draft',
  'pending',
  'approved',
  'rejected',
  'paused',
  'disabled',
]);

export const messageStatusEnum = pgEnum('message_status', [
  'draft',
  'scheduled',
  'queued',
  'processing',
  'submitted',
  'sent',
  'delivered',
  'read',
  'failed',
  'cancelled',
  'expired',
]);

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'suspended']);
export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'publishing',
  'published',
  'failed',
]);
export const webhookStatusEnum = pgEnum('webhook_status', [
  'pending',
  'processing',
  'processed',
  'failed',
]);
export const attemptStatusEnum = pgEnum('attempt_status', ['started', 'succeeded', 'failed']);

// --- billing ---

/**
 * Immutable ledger entry kinds. Signs are enforced in code (`@maildrill/billing`):
 * purchase/promotion/bonus are positive; consumption is negative; refund is
 * negative (credits leave the wallet when money is returned); adjustment and
 * correction may carry either sign.
 */
export const walletEntryTypeEnum = pgEnum('wallet_entry_type', [
  'purchase',
  'consumption',
  'refund',
  'promotion',
  'bonus',
  'adjustment',
  'correction',
]);

export const reservationStatusEnum = pgEnum('reservation_status', [
  'held',
  'committed',
  'released',
  'expired',
]);

export const paymentAttemptStatusEnum = pgEnum('payment_attempt_status', [
  'pending',
  'succeeded',
  'failed',
  'refunded',
  'expired',
]);

export const paymentEventStatusEnum = pgEnum('payment_event_status', [
  'processed',
  'skipped',
  'failed',
]);

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);
const createdAt = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const ts = (name: string) => timestamp(name, { withTimezone: true });

// ---------------------------------------------------------------------------
// Tenancy (shared schema + tenant_id discriminator)
// ---------------------------------------------------------------------------

export const tenants = pgTable('tenants', {
  id: id(),
  name: text('name').notNull(),
  status: tenantStatusEnum('status').notNull().default('active'),
  /**
   * CPaaS X entity this workspace's traffic is tagged with, for per-workspace
   * usage and billing reporting inside the single shared Infobip account. Not
   * a data boundary — see docs/infobip-api-scheme.md. Assigned at workspace
   * creation; null on rows that predate the column (they fall back to the
   * account-wide INFOBIP_ENTITY_ID).
   *
   * Assignment is local and unconditional, so this column says nothing about
   * whether Infobip knows the entity — read `infobipEntityProvisionedAt` for
   * that.
   */
  infobipEntityId: text('infobip_entity_id').unique(),
  /**
   * When Infobip acknowledged the entity (created it, or reported it already
   * existed). Null means the id was assigned locally but never confirmed by
   * the provider — typically an API key without the provisioning scope, which
   * leaves per-workspace usage attribution inert while every local row still
   * looks correctly provisioned.
   */
  infobipEntityProvisionedAt: ts('infobip_entity_provisioned_at'),
  /**
   * Workspace settings bag (not first-class columns), mirroring
   * users.preferences: branding {brandName, logoUrl, accentColor,
   * emailFooter}, ai {summaries, subject, sendtime}.
   */
  settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const providerAccounts = pgTable(
  'provider_accounts',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    channel: channelEnum('channel').notNull(),
    status: text('status').notNull().default('active'),
    // Never store raw secrets; this points at env / a secret manager entry.
    configurationReference: text('configuration_reference'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('provider_accounts_tenant_idx').on(t.tenantId)],
);

export const campaigns = pgTable(
  'campaigns',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    status: text('status').notNull().default('draft'),
    // Draft definition — mirrors the /v1/campaigns/send contract so a saved
    // campaign can be handed straight to the messaging engine.
    channel: channelEnum('channel').notNull().default('email'),
    listId: uuid('list_id').references(() => lists.id, { onDelete: 'set null' }),
    segmentId: uuid('segment_id').references(() => segments.id, {
      onDelete: 'set null',
    }),
    templateId: uuid('template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
    scheduledAt: ts('scheduled_at'),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('campaigns_tenant_idx').on(t.tenantId)],
);

// ---------------------------------------------------------------------------
// Messages — the core lifecycle record
// ---------------------------------------------------------------------------

export const messages = pgTable(
  'messages',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    // External reference to the recipient (contacts live in the product, not here).
    recipientId: text('recipient_id'),
    // Resolved destination + content: DB is the source of truth, jobs carry only ids.
    toAddress: text('to_address').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull().default({}),
    channel: channelEnum('channel').notNull(),
    provider: text('provider').notNull(),
    status: messageStatusEnum('status').notNull().default('draft'),
    scheduledAt: ts('scheduled_at'),
    queuedAt: ts('queued_at'),
    processingStartedAt: ts('processing_started_at'),
    submittedAt: ts('submitted_at'),
    sentAt: ts('sent_at'),
    deliveredAt: ts('delivered_at'),
    readAt: ts('read_at'),
    failedAt: ts('failed_at'),
    cancelledAt: ts('cancelled_at'),
    providerMessageId: text('provider_message_id'),
    /**
     * Real call length in seconds, reconciled from the provider's voice DLR
     * (Infobip `voiceCall.chargedDuration`, falling back to `duration`).
     * Voice only, and null until a report arrives — consumers that need a
     * number before then fall back to `estimateVoiceSeconds`.
     */
    voiceSeconds: integer('voice_seconds'),
    idempotencyKey: text('idempotency_key'),
    // Controlled execution generation; bumped on retry so a new send job id is used.
    generation: integer('generation').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    /**
     * Whether the provider called the failure permanent (Infobip
     * `error.permanent`). This is what separates a hard bounce — bad mailbox,
     * suppress the address — from a soft one like a full inbox. Null when the
     * report did not say.
     */
    lastErrorPermanent: boolean('last_error_permanent'),
    // Optimistic-concurrency guard against out-of-order overwrites.
    version: integer('version').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // API idempotency: same tenant + key returns the existing message.
    uniqueIndex('messages_tenant_idempotency_uq')
      .on(t.tenantId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} is not null`),
    index('messages_status_scheduled_idx').on(t.status, t.scheduledAt),
    index('messages_provider_msg_idx').on(t.provider, t.providerMessageId),
    /**
     * The campaigns board's and the Lists board's outcome rollups, in
     * index-only form.
     *
     * Every counter either board shows is `count(*) filter (where status = ...)`
     * grouped by campaign under one tenant, so these columns in this order are
     * the whole query — Postgres never touches the heap. It replaced
     * `messages_tenant_idx (tenant_id)`, of which it is a strict prefix, so the
     * table carries no extra index for it.
     *
     * `channel` is the fourth KEY column, not INCLUDE, because the Lists board
     * splits deliveries by whether the channel can report an open. Every
     * message of a campaign leaves on the same channel, so the four-column
     * tuple repeats exactly as often as the three-column one did and btree
     * deduplication keeps the index at the same 7,632 kB; INCLUDE reaches the
     * same plan but disables deduplication and measured 57MB. See 0028.
     */
    index('messages_tenant_campaign_status_idx').on(
      t.tenantId,
      t.campaignId,
      t.status,
      t.channel,
    ),
    index('messages_campaign_idx').on(t.campaignId),
  ],
);

export const messageAttempts = pgTable(
  'message_attempts',
  {
    id: id(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    provider: text('provider').notNull(),
    channel: channelEnum('channel').notNull(),
    attemptNumber: integer('attempt_number').notNull(),
    status: attemptStatusEnum('status').notNull(),
    providerRequestId: text('provider_request_id'),
    providerResponseCode: text('provider_response_code'),
    providerErrorCode: text('provider_error_code'),
    errorCategory: text('error_category'),
    requestStartedAt: ts('request_started_at'),
    requestCompletedAt: ts('request_completed_at'),
    createdAt: createdAt(),
  },
  (t) => [
    index('message_attempts_message_idx').on(t.messageId),
    index('message_attempts_tenant_idx').on(t.tenantId),
  ],
);

export const messageEvents = pgTable(
  'message_events',
  {
    id: id(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    /**
     * The campaign the event's message belonged to, copied from that message.
     *
     * Denormalised because there is otherwise no route from a campaign to its
     * events except joining `messages`, and that join is O(all tenant events)
     * no matter how few campaigns are asked about: measured on a 2M-event table
     * it costs 923ms and spills 94MB to temp files, against 6.7ms reading this
     * column. Safe to copy where a counter on `campaigns` would not be —
     * events are append-only, written once and never updated, so there is no
     * write amplification and nothing to keep in sync after the insert.
     *
     * `on delete set null` matches `messages.campaign_id`, so deleting a
     * campaign leaves the two agreeing rather than leaving a dangling id here.
     */
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    providerEventId: text('provider_event_id'),
    // Stable dedupe key: provider_event_id when present, else a payload fingerprint.
    eventFingerprint: text('event_fingerprint').notNull(),
    eventType: text('event_type').notNull(),
    providerStatus: text('provider_status'),
    occurredAt: ts('occurred_at'),
    receivedAt: ts('received_at').defaultNow().notNull(),
    processedAt: ts('processed_at'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('message_events_provider_fingerprint_uq').on(t.provider, t.eventFingerprint),
    index('message_events_message_idx').on(t.messageId),
    /**
     * Click / unsubscribe / complaint counts per campaign, index-only.
     *
     * `message_id` is the trailing column because those counters are
     * `count(distinct message_id)` — with it here the index already yields
     * (campaign, type, message) in order, so the DISTINCT collapses in a Unique
     * node and the whole rollup runs without a sort.
     */
    index('message_events_tenant_campaign_type_idx').on(
      t.tenantId,
      t.campaignId,
      t.eventType,
      t.messageId,
    ),
  ],
);

// ---------------------------------------------------------------------------
// Webhook intake — raw payload persisted before async processing
// ---------------------------------------------------------------------------

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    kind: text('kind').notNull().default('delivery'),
    tenantId: uuid('tenant_id'),
    providerEventId: text('provider_event_id'),
    eventFingerprint: text('event_fingerprint').notNull(),
    headers: jsonb('headers').$type<Record<string, unknown>>().notNull().default({}),
    payload: jsonb('payload').$type<unknown>().notNull(),
    receivedAt: ts('received_at').defaultNow().notNull(),
    processedAt: ts('processed_at'),
    processingStatus: webhookStatusEnum('processing_status').notNull().default('pending'),
    processingError: text('processing_error'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('webhook_events_provider_fingerprint_uq').on(t.provider, t.eventFingerprint),
    index('webhook_events_status_idx').on(t.processingStatus),
  ],
);

// ---------------------------------------------------------------------------
// Transactional outbox
// ---------------------------------------------------------------------------

export const outboxEvents = pgTable(
  'outbox_events',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull(),
    aggregateType: text('aggregate_type').notNull(),
    aggregateId: uuid('aggregate_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: outboxStatusEnum('status').notNull().default('pending'),
    availableAt: ts('available_at').defaultNow().notNull(),
    publishedAt: ts('published_at'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // Publisher polls pending rows ordered by availability; SKIP LOCKED on this.
    index('outbox_status_available_idx').on(t.status, t.availableAt),
  ],
);

// ---------------------------------------------------------------------------
// Usage ledger (idempotent) + dead letters
// ---------------------------------------------------------------------------

export const usageRecords = pgTable(
  'usage_records',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull(),
    messageId: uuid('message_id').references(() => messages.id, {
      onDelete: 'set null',
    }),
    channel: channelEnum('channel').notNull(),
    provider: text('provider').notNull(),
    usageType: text('usage_type').notNull(),
    quantity: integer('quantity').notNull().default(1),
    unit: text('unit').notNull().default('message'),
    occurredAt: ts('occurred_at').defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Idempotent ledger: one row per (message, usage_type).
    uniqueIndex('usage_records_message_type_uq').on(t.messageId, t.usageType),
    index('usage_records_tenant_idx').on(t.tenantId),
  ],
);

export const deadLetters = pgTable(
  'dead_letters',
  {
    id: id(),
    tenantId: uuid('tenant_id'),
    messageId: uuid('message_id'),
    queue: text('queue').notNull(),
    jobName: text('job_name').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    error: text('error'),
    replayedAt: ts('replayed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('dead_letters_tenant_idx').on(t.tenantId)],
);

// ===========================================================================
// Product data model — subscribers / lists / segments / tags / templates.
// System of record for the product. The messaging tables above reference a
// subscriber only by opaque id (messages.recipient_id); recipients + content
// are resolved here before a message is submitted.
// ===========================================================================

export const subscriberStatusEnum = pgEnum('subscriber_status', [
  'active',
  'unsubscribed',
  'bounced',
  'complained',
  /**
   * Failed address validation at add/import time — bad syntax, a typo'd or
   * non-existent domain, or a disposable provider. Never mailed:
   * `resolveAudience` only sends to `active`. Distinct from `bounced`, which
   * is a verdict from a real delivery attempt.
   */
  'invalid',
]);
export const segmentMatchEnum = pgEnum('segment_match', ['all', 'any']);
export const customFieldTypeEnum = pgEnum('custom_field_type', [
  'text',
  'number',
  'date',
  'boolean',
]);

/** A single segment predicate stored in segments.rules. */
export interface SegmentRule {
  field: string;
  op: 'eq' | 'neq' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists';
  value?: unknown;
}

export const subscribers = pgTable(
  'subscribers',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name'),
    status: subscriberStatusEnum('status').notNull().default('active'),
    attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('subscribers_tenant_email_uq').on(t.tenantId, t.email)],
);

/**
 * Per-subscriber engagement rollup, maintained by the delivery pipeline and
 * reconciled nightly. See migration 0025 for why this is a table rather than
 * columns on `subscribers` (write amplification, measured) and for the
 * `engagement_bucket()` function that owns the boundaries.
 */
export const subscriberEngagement = pgTable(
  'subscriber_engagement',
  {
    subscriberId: uuid('subscriber_id')
      .primaryKey()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /**
     * Denormalised copy of `subscribers.created_at`, written once when the
     * rollup row is seeded.
     *
     * 0025 claimed it let one index answer the bucket predicate and the
     * roster's keyset order together. It does not: the ORDER BY is on
     * `subscribers.created_at`, and the planner cannot prove this copy equals
     * it, so every rollup-driven plan sorts regardless. Migration 0027 dropped
     * it from both bucket indexes for that reason. The column stays because it
     * is the only record of when a rollup row's subject joined — nothing reads
     * it in a query path, so do not add one expecting an index to be there.
     */
    createdAt: ts('created_at').notNull(),
    delivered: integer('delivered').notNull().default(0),
    /** Deliveries on channels that can report engagement (email, WhatsApp). */
    trackedDelivered: integer('tracked_delivered').notNull().default(0),
    opened: integer('opened').notNull().default(0),
    clicked: integer('clicked').notNull().default(0),
    /** -1 never mailed, 0 none, 1 under 20%, 2 20-40%, 3 40%+. */
    opensBucket: smallint('opens_bucket').notNull().default(-1),
    clicksBucket: smallint('clicks_bucket').notNull().default(-1),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [
    // (tenant, bucket, subscriber_id) — subscriber_id third, not a trailing
    // created_at, because the plan that matters probes this table by id from a
    // `subscribers` scan and that position is what makes the probe index-only.
    // See migration 0027 for the measured before/after.
    index('subscriber_engagement_opens_idx').on(t.tenantId, t.opensBucket, t.subscriberId),
    index('subscriber_engagement_clicks_idx').on(t.tenantId, t.clicksBucket, t.subscriberId),
  ],
);

export const customFieldDefs = pgTable(
  'custom_field_defs',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    label: text('label').notNull(),
    type: customFieldTypeEnum('type').notNull().default('text'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('custom_field_defs_tenant_key_uq').on(t.tenantId, t.key)],
);

export const lists = pgTable(
  'lists',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    // Free-form labels stored inline (like subscribers.tags) — a list carries a
    // handful, so a jsonb array is simpler than a join table here.
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    // A single free-text note kept with the list for the team's own context.
    notes: text('notes'),
    /**
     * Channels this list is meant to be used on. At least one is required —
     * a list nobody can send to is not a list. Stored as a jsonb array like
     * `tags`: the set is tiny and always read whole.
     */
    channels: jsonb('channels')
      .$type<(typeof channelEnum.enumValues)[number][]>()
      .notNull()
      .default(['email']),
    // Whether the list requires or records GDPR consent.
    gdprConsent: boolean('gdpr_consent').notNull().default(false),
    /**
     * Set when too much of the list turned out to be undeliverable. A
     * suspended list cannot be sent to until someone cleans it — see
     * `list-health.ts`. Null is the normal state.
     */
    suspendedAt: ts('suspended_at'),
    suspendedReason: text('suspended_reason'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('lists_tenant_idx').on(t.tenantId)],
);

export const listMembers = pgTable(
  'list_members',
  {
    listId: uuid('list_id')
      .notNull()
      .references(() => lists.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    addedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.listId, t.subscriberId] }),
    index('list_members_subscriber_idx').on(t.subscriberId),
  ],
);

export const segments = pgTable(
  'segments',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    matchType: segmentMatchEnum('match_type').notNull().default('all'),
    rules: jsonb('rules').$type<SegmentRule[]>().notNull().default([]),
    /**
     * Channels this segment is meant to be used on. At least one is required —
     * mirrors lists so the subscribers tab and campaign picker can filter by
     * channel. Stored as a jsonb array: the set is tiny and always read whole.
     */
    channels: jsonb('channels')
      .$type<(typeof channelEnum.enumValues)[number][]>()
      .notNull()
      .default(['email']),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('segments_tenant_idx').on(t.tenantId)],
);

export const tags = pgTable(
  'tags',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('tags_tenant_name_uq').on(t.tenantId, t.name)],
);

export const subscriberTags = pgTable(
  'subscriber_tags',
  {
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    addedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.tagId, t.subscriberId] }),
    index('subscriber_tags_subscriber_idx').on(t.subscriberId),
  ],
);

export const templates = pgTable(
  'templates',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    channel: channelEnum('channel').notNull().default('email'),
    subject: text('subject'),
    preheader: text('preheader'),
    html: text('html'),
    text: text('text'),
    builderDoc: jsonb('builder_doc').$type<Record<string, unknown>>(),
    category: text('category'),
    favorite: boolean('favorite').notNull().default(false),
    // --- WhatsApp template approval (channel = "whatsapp" only; null otherwise) ---
    /** Meta review state, brokered by Infobip. Null for non-WhatsApp templates. */
    approvalStatus: templateApprovalStatusEnum('approval_status'),
    /** Infobip/Meta template id, set once submitted; also the language pair key. */
    providerTemplateId: text('provider_template_id'),
    /** BCP-47-ish language tag Meta requires per template (e.g. "en", "en_US"). */
    language: text('language'),
    /** Meta's rejection reason when approvalStatus = "rejected". */
    rejectionReason: text('rejection_reason'),
    /** WhatsApp template structure: header/body/footer/buttons + placeholder map. */
    components: jsonb('components').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('templates_tenant_idx').on(t.tenantId),
    // Correlate inbound Infobip template-status webhooks back to the row.
    index('templates_provider_template_idx').on(t.providerTemplateId),
  ],
);

/**
 * Landing pages: one row per Builder42 *site* (the editor's document is a whole
 * site — `pages`, `pageOrder`, `homePageId` — not a single page).
 *
 * `pageCount`/`documentBytes` are denormalised on write so listing landings
 * never has to read `document`: it holds images inline as data URLs, which puts
 * a single row in the megabytes.
 *
 * `siteId` is the PUBLISH identity (`document.meta.siteId`, a slug the editor
 * generates on first publish), deliberately not the row id: it becomes part of a
 * public URL, so it must be human-readable and unique across tenants, and it
 * cannot change once links exist. Nullable until publishing lands.
 */
export const landings = pgTable(
  'landings',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** The `BuilderSite` JSON — opaque here; the editor owns its shape. */
    document: jsonb('document').$type<Record<string, unknown>>(),
    /** `BuilderSite.meta.version`, for future document migrations. */
    schemaVersion: integer('schema_version'),
    siteId: text('site_id'),
    publishedUrl: text('published_url'),
    publishedAt: ts('published_at'),
    pageCount: integer('page_count').notNull().default(1),
    documentBytes: integer('document_bytes').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('landings_tenant_idx').on(t.tenantId),
    // The list's default order (most recently edited first) within a tenant.
    index('landings_tenant_updated_idx').on(t.tenantId, t.updatedAt),
    // A publish slug is a hostname label: unique across the whole install.
    // Partial so unpublished rows (site_id null) are simply out of scope.
    uniqueIndex('landings_site_id_idx')
      .on(t.siteId)
      .where(sql`${t.siteId} is not null`),
  ],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // Object key within the media bucket. Named for its role, not the vendor:
    // this was "r2_key" under the dropped Cloudflare design and is now S3.
    storageKey: text('storage_key').notNull(),
    // Optional 250×250 cover twin for library Grid/List previews.
    thumbStorageKey: text('thumb_storage_key'),
    name: text('name').notNull(),
    folder: text('folder'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    sizeBytes: integer('size_bytes'),
    contentType: text('content_type'),
    width: integer('width'),
    height: integer('height'),
    createdAt: createdAt(),
  },
  (t) => [
    index('media_assets_tenant_idx').on(t.tenantId),
    // One row per stored object, so a retried confirm cannot double-register.
    uniqueIndex('media_assets_storage_key_uq').on(t.storageKey),
  ],
);

export const suppressions = pgTable(
  'suppressions',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    address: text('address').notNull(),
    channel: channelEnum('channel').notNull(),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('suppressions_tenant_addr_channel_uq').on(t.tenantId, t.address, t.channel)],
);

// ===========================================================================
// Identity — users, workspace memberships, magic-link tokens.
// A user is global (can belong to many workspaces); a workspace == a tenant.
// The frontend never touches these; the service owns identity and the
// magic-link flow, and exposes it via /v1/auth/* + /v1/me.
// ===========================================================================

export const membershipRoleEnum = pgEnum('membership_role', ['owner', 'admin', 'editor', 'viewer']);

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull(),
    name: text('name'),
    /** E.164-ish contact number captured at sign-up; nullable for older accounts. */
    phone: text('phone'),
    /**
     * Commercial lifecycle label: `trial` until the first purchase, then
     * `payg` for top-ups or a `pricing_tiers.code` once a commitment plan is
     * bought. Free text because tier codes are DB-configured (seed-billing).
     *
     * Display/lifecycle only — the discount a send is actually charged at
     * comes from `wallets.pricing_tier_id`, which stays the billing authority.
     * Billing is per workspace, so this mirrors the wallet of the workspaces a
     * user belongs to; a member of two differently-planned workspaces shows
     * whichever was purchased last.
     */
    tier: text('tier').notNull().default('trial'),
    /**
     * Profile extras + notification toggles (not first-class columns):
     * displayName, title, timezone, language, notifications.
     */
    preferences: jsonb('preferences').$type<Record<string, unknown>>().notNull().default({}),
    /** When set, Auth.js sessions with iat before this instant are rejected. */
    sessionsRevokedAt: ts('sessions_revoked_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email)],
);

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    role: membershipRoleEnum('role').notNull().default('owner'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.tenantId] }),
    index('memberships_tenant_idx').on(t.tenantId),
  ],
);

export const magicLinkTokens = pgTable(
  'magic_link_tokens',
  {
    id: id(),
    email: text('email').notNull(),
    tokenHash: text('token_hash').notNull(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('magic_link_tokens_hash_uq').on(t.tokenHash),
    index('magic_link_tokens_email_idx').on(t.email),
  ],
);

// ===========================================================================
// Account security — passkeys, TOTP, recovery codes, trusted devices,
// revocable sessions, and the security activity log. All rows hang off the
// user (cascade delete) and never store plaintext secrets: passkeys keep only
// the public key, TOTP secrets are AES-256-GCM encrypted, recovery codes and
// trusted-device tokens are sha256 hashes.
// ===========================================================================

/**
 * One row per Auth.js login. The JWT carries this row's id as `sid`; the
 * frontend middleware checks the row (30s cache) so a session can be revoked
 * server-side even though the cookie is a stateless JWT. `elevated_until`
 * marks a fresh second-factor/reauth challenge for sensitive mutations.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Auth methods used at login, e.g. ["code"], ["webauthn"], ["code","totp"]. */
    amr: jsonb('amr').$type<string[]>().notNull().default([]),
    ip: text('ip'),
    userAgent: text('user_agent'),
    browser: text('browser'),
    os: text('os'),
    deviceType: text('device_type'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    elevatedUntil: ts('elevated_until'),
    lastSeenAt: ts('last_seen_at'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_sessions_user_idx').on(t.userId)],
);

/** WebAuthn credentials. `credential_id` and `public_key` are base64url. */
export const passkeys = pgTable(
  'passkeys',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    /** WebAuthn signature counter (uint32 — integer would overflow). */
    counter: bigint('counter', { mode: 'number' }).notNull().default(0),
    transports: jsonb('transports').$type<string[]>().notNull().default([]),
    /** simplewebauthn's credentialDeviceType: singleDevice | multiDevice. */
    deviceType: text('device_type').notNull().default('singleDevice'),
    backedUp: boolean('backed_up').notNull().default(false),
    name: text('name').notNull(),
    createdAt: createdAt(),
    lastUsedAt: ts('last_used_at'),
  },
  (t) => [
    uniqueIndex('passkeys_credential_id_uq').on(t.credentialId),
    index('passkeys_user_idx').on(t.userId),
  ],
);

/**
 * Single-use, short-lived WebAuthn challenges. `user_id` is null for
 * discoverable-credential login (the user isn't known until the assertion).
 */
export const webauthnChallenges = pgTable(
  'webauthn_challenges',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    /** registration | authentication | reauth */
    purpose: text('purpose').notNull(),
    challenge: text('challenge').notNull(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('webauthn_challenges_user_idx').on(t.userId)],
);

/**
 * TOTP authenticator config, one row per user. `secret_enc` is AES-256-GCM
 * (see identity/security/crypto). A row with `confirmed_at` null is a pending
 * setup and never satisfies a second-factor challenge. `last_used_step`
 * prevents replay of an accepted code within its time window.
 */
export const userTotp = pgTable(
  'user_totp',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    secretEnc: text('secret_enc').notNull(),
    confirmedAt: ts('confirmed_at'),
    lastUsedStep: bigint('last_used_step', { mode: 'number' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('user_totp_user_uq').on(t.userId)],
);

/** One-time 2FA recovery codes; only sha256 hashes are stored. */
export const recoveryCodes = pgTable(
  'recovery_codes',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: ts('used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('recovery_codes_user_hash_uq').on(t.userId, t.codeHash),
    index('recovery_codes_user_idx').on(t.userId),
  ],
);

/**
 * Devices the user chose to trust after a second-factor challenge. The cookie
 * holds `<id>.<secret>`; only sha256(secret) is stored. A valid, unexpired,
 * unrevoked row lets a login skip the 2FA challenge.
 */
export const trustedDevices = pgTable(
  'trusted_devices',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    name: text('name').notNull(),
    browser: text('browser'),
    os: text('os'),
    ip: text('ip'),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
    lastUsedAt: ts('last_used_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('trusted_devices_token_hash_uq').on(t.tokenHash),
    index('trusted_devices_user_idx').on(t.userId),
  ],
);

/**
 * Single-use tickets bridging the multi-step login (code verify → 2FA
 * challenge → Auth.js session) and the passkey login. The ticket value is
 * `<id>.<secret>`; only sha256(secret) is stored. `purpose` is `login`
 * (exchangeable for a session) or `twofa` (first factor passed, second
 * pending).
 */
export const authTickets = pgTable(
  'auth_tickets',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    purpose: text('purpose').notNull(),
    secretHash: text('secret_hash').notNull(),
    /** Auth methods accumulated so far, copied onto the session at exchange. */
    amr: jsonb('amr').$type<string[]>().notNull().default([]),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
    createdAt: createdAt(),
  },
  (t) => [index('auth_tickets_user_idx').on(t.userId)],
);

/**
 * Security activity log shown on the Profile page. Append-only; metadata is
 * safe/structured only — never secrets, tokens, codes, or key material.
 */
export const securityEvents = pgTable(
  'security_events',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    sessionId: uuid('session_id').references(() => authSessions.id, { onDelete: 'set null' }),
    ip: text('ip'),
    userAgent: text('user_agent'),
    /** Id of the affected entity (passkey id, device id, session id…). */
    entityId: text('entity_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index('security_events_user_created_idx').on(t.userId, t.createdAt)],
);

/**
 * Workspace-scoped API keys created from Settings. The env `API_KEYS` pairs
 * remain as the ops fallback; these are per-tenant, revocable, and stored as
 * a sha256 hash — the plaintext secret is shown exactly once at creation.
 */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Public identifier (the part before the colon in `keyId:secret`). */
    keyId: text('key_id').notNull(),
    secretHash: text('secret_hash').notNull(),
    scope: text('scope').notNull().default('full'),
    createdAt: createdAt(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [
    uniqueIndex('api_keys_key_id_uq').on(t.keyId),
    index('api_keys_tenant_idx').on(t.tenantId),
  ],
);

/**
 * Workspace ownership of Infobip sending domains. Infobip's domain API is
 * account-level (one registration per domain name), so we keep a local
 * tenant → domain map and filter every list/mutate through it. Domain names
 * are unique globally: only one workspace can claim a given domain.
 */
export const emailDomains = pgTable(
  'email_domains',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    domainName: text('domain_name').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('email_domains_name_uq').on(t.domainName),
    index('email_domains_tenant_idx').on(t.tenantId),
  ],
);

// ---------------------------------------------------------------------------
// Billing: wallet + immutable ledger + reservations + payment provider state
//
// Credits are integer micro-USD (1 USD = 1_000_000 micro) so per-message
// prices like $0.0005 stay exact. The wallet row is a cached projection of
// the ledger, maintained in the SAME transaction as every ledger append and
// guarded by `SELECT … FOR UPDATE`; the invariant, checked by
// `reconcileWallet`, is  balance + reserved = SUM(wallet_transactions.amount).
// Reservations are holds, not financial events — they never touch the ledger
// until committed (consumption) or die silently (release/expire).
// ---------------------------------------------------------------------------

/** One wallet per workspace. Users never own balances. */
export const wallets = pgTable(
  'wallets',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Billing is always USD; the marketing currency switcher is display-only. */
    currency: text('currency').notNull().default('USD'),
    /** Spendable micro-credits. Never written outside a ledger transaction. */
    balanceMicro: bigint('balance_micro', { mode: 'number' }).notNull().default(0),
    /** Micro-credits held by open reservations. */
    reservedMicro: bigint('reserved_micro', { mode: 'number' }).notNull().default(0),
    /** Bumped on every balance mutation — cheap staleness signal for caches. */
    version: integer('version').notNull().default(0),
    /** Low-balance warning threshold (UI + notifications). */
    lowBalanceMicro: bigint('low_balance_micro', { mode: 'number' }).notNull().default(10_000_000),
    /** Commitment tier the workspace bought into (discount source). */
    pricingTierId: uuid('pricing_tier_id').references(() => pricingTiers.id, {
      onDelete: 'set null',
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('wallets_tenant_uq').on(t.tenantId)],
);

/**
 * Append-only financial ledger. Rows are never updated or deleted; corrections
 * are new `correction` entries. `balanceAfterMicro` snapshots the wallet
 * balance the append produced, making the history independently auditable.
 */
export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    entryType: walletEntryTypeEnum('entry_type').notNull(),
    /** Signed micro-credits. Positive credits the wallet, negative debits it. */
    amountMicro: bigint('amount_micro', { mode: 'number' }).notNull(),
    /** Wallet balance immediately after this entry was applied. */
    balanceAfterMicro: bigint('balance_after_micro', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    /** Set on consumption entries; null for money-side entries. */
    channel: channelEnum('channel'),
    /** Domain object this entry points at (campaign, message, payment attempt…). */
    referenceType: text('reference_type'),
    referenceId: text('reference_id'),
    /**
     * Dedupe key for at-most-once financial effects (e.g. `purchase:<attempt>`,
     * `consume:<messageId>`). Unique per tenant where present.
     */
    idempotencyKey: text('idempotency_key'),
    description: text('description'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('wallet_tx_tenant_idem_uq').on(t.tenantId, t.idempotencyKey),
    index('wallet_tx_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('wallet_tx_wallet_created_idx').on(t.walletId, t.createdAt),
    index('wallet_tx_reference_idx').on(t.referenceType, t.referenceId),
  ],
);

/**
 * Credit holds backing in-flight sends: reserve → (commit per message)* →
 * release remainder. `reference` makes reserve idempotent per business action
 * (e.g. `campaign:<id>`); `remainingMicro` shrinks as commits land.
 */
export const creditReservations = pgTable(
  'credit_reservations',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    status: reservationStatusEnum('status').notNull().default('held'),
    /** Micro-credits originally held. */
    amountMicro: bigint('amount_micro', { mode: 'number' }).notNull(),
    /** Micro-credits still held (amount − committed − released). */
    remainingMicro: bigint('remaining_micro', { mode: 'number' }).notNull(),
    referenceType: text('reference_type').notNull(),
    referenceId: text('reference_id').notNull(),
    /** Stale holds are swept back to the wallet after this instant. */
    expiresAt: ts('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('credit_reservations_ref_uq').on(t.tenantId, t.referenceType, t.referenceId),
    index('credit_reservations_wallet_idx').on(t.walletId),
    index('credit_reservations_expiry_idx').on(t.status, t.expiresAt),
  ],
);

/**
 * Purchasable credit packages — database-configured, never hardcoded.
 * `creditsMicro` is what the buyer's wallet receives; `bonusMicro` on top of
 * it is the volume incentive. Price is charged via the payment provider in
 * `priceCents` of `currency`.
 */
export const creditPackages = pgTable(
  'credit_packages',
  {
    id: id(),
    /** Stable machine identifier the frontend sends at checkout (`starter`…). */
    code: text('code').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    priceCents: integer('price_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    creditsMicro: bigint('credits_micro', { mode: 'number' }).notNull(),
    bonusMicro: bigint('bonus_micro', { mode: 'number' }).notNull().default(0),
    /** Buying this package can move the workspace onto a commitment tier. */
    grantsTierId: uuid('grants_tier_id').references(() => pricingTiers.id, {
      onDelete: 'set null',
    }),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('credit_packages_code_uq').on(t.code)],
);

/**
 * Commitment levels (pay-as-you-go, monthly, quarterly, annual, enterprise…).
 * The discount applies on top of channel base pricing; the pricing engine
 * resolves the final effective rate.
 */
export const pricingTiers = pgTable(
  'pricing_tiers',
  {
    id: id(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** Discount in basis points (1500 = 15%). */
    discountBps: integer('discount_bps').notNull().default(0),
    /** Minimum purchase to qualify, in cents. */
    minPurchaseCents: integer('min_purchase_cents').notNull().default(0),
    /** Prepaid commitment length; 0 = no commitment. */
    commitmentMonths: integer('commitment_months').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('pricing_tiers_code_uq').on(t.code)],
);

/**
 * Per-channel, per-region unit pricing — the pricing engine's raw material.
 * `volumeTiers` holds the volume-discount ladder as `[{ minUnits, priceMicro }]`
 * (sorted ascending; the highest matching step wins) so price changes are
 * data changes, not deploys. Provider cost + margin are recorded for
 * reporting only and never leave the backend.
 */
export const channelPricing = pgTable(
  'channel_pricing',
  {
    id: id(),
    channel: channelEnum('channel').notNull(),
    /** Rate-card region (`default` = worldwide fallback, e.g. email). */
    region: text('region').notNull().default('default'),
    /** Micro-USD per billable unit before discounts. */
    basePriceMicro: bigint('base_price_micro', { mode: 'number' }).notNull(),
    /** What one unit is: message, conversation (WhatsApp), minute (voice). */
    unit: text('unit').notNull().default('message'),
    /** Smallest billable quantity (voice bills at least this many units). */
    minBillableUnits: integer('min_billable_units').notNull().default(1),
    /** Decimal places of a displayed credit price (display concern, stored). */
    billingPrecision: integer('billing_precision').notNull().default(4),
    /** Our provider cost per unit (internal margin reporting only). */
    providerCostMicro: bigint('provider_cost_micro', { mode: 'number' }).notNull().default(0),
    /** Target margin in basis points (internal reporting only). */
    marginBps: integer('margin_bps').notNull().default(0),
    volumeTiers: jsonb('volume_tiers')
      .$type<{ minUnits: number; priceMicro: number }[]>()
      .notNull()
      .default([]),
    active: boolean('active').notNull().default(true),
    effectiveFrom: ts('effective_from').defaultNow().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('channel_pricing_channel_region_uq').on(t.channel, t.region),
    index('channel_pricing_channel_idx').on(t.channel),
  ],
);

/**
 * Processed payment-provider events (Stripe first). The unique `eventId` is
 * the webhook idempotency gate: duplicate deliveries insert-conflict and are
 * skipped before any financial effect runs.
 */
export const stripeEvents = pgTable(
  'stripe_events',
  {
    id: id(),
    provider: text('provider').notNull().default('stripe'),
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    status: paymentEventStatusEnum('status').notNull().default('processed'),
    error: text('error'),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    processedAt: ts('processed_at').defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('stripe_events_event_id_uq').on(t.provider, t.eventId),
    index('stripe_events_type_idx').on(t.eventType),
  ],
);

/**
 * One row per checkout started — the bridge between a provider session and
 * the credits it should grant. Only webhooks flip it to `succeeded`, and the
 * ledger grant is keyed `purchase:<id>` so replays can't double-credit.
 */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: id(),
    tenantId: uuid('tenant_id').notNull(),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('stripe'),
    packageId: uuid('package_id').references(() => creditPackages.id, { onDelete: 'set null' }),
    /** Denormalized so history survives package deletion/repricing. */
    packageCode: text('package_code').notNull(),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('USD'),
    /** Credits (incl. bonus) this attempt grants when it succeeds. */
    creditsMicro: bigint('credits_micro', { mode: 'number' }).notNull(),
    status: paymentAttemptStatusEnum('status').notNull().default('pending'),
    providerSessionId: text('provider_session_id'),
    providerPaymentIntentId: text('provider_payment_intent_id'),
    failureReason: text('failure_reason'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payment_attempts_session_uq').on(t.provider, t.providerSessionId),
    index('payment_attempts_tenant_idx').on(t.tenantId, t.createdAt),
    index('payment_attempts_intent_idx').on(t.providerPaymentIntentId),
  ],
);

/** Provider-side customer handles, one per (tenant, provider). */
export const paymentCustomers = pgTable(
  'payment_customers',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('stripe'),
    externalCustomerId: text('external_customer_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('payment_customers_tenant_provider_uq').on(t.tenantId, t.provider),
    uniqueIndex('payment_customers_external_uq').on(t.provider, t.externalCustomerId),
  ],
);

// ---------------------------------------------------------------------------
// Provider-billed usage (Infobip Billing Usage API) + recharge allocation
// ---------------------------------------------------------------------------

/**
 * Lifecycle of one `POST /billing/1/usage/query` submission.
 *
 * `pending` is written when Infobip returns 201 with a requestId; only the
 * callback moves it on. `expired` is set by the sweeper for requests whose
 * callback never arrived — Infobip delivers the result *once*, with no retry,
 * so a lost callback is a permanent hole that must be re-queried rather than
 * waited on.
 */
export const billingUsageRequestStatusEnum = pgEnum('billing_usage_request_status', [
  'pending',
  'succeeded',
  'failed',
  'expired',
]);

/**
 * One row per billing-usage query we submit to Infobip.
 *
 * Why a table and not a queue job: the query is asynchronous and the result
 * arrives on a *different* process (an HTTP callback) minutes to hours later,
 * so the correlation between "what we asked" and "what came back" has to
 * outlive both. `providerRequestId` is the join key Infobip echoes in the
 * callback, and its unique index is the callback's idempotency guard — a
 * replayed delivery hits the same row and is skipped before any money moves.
 *
 * `pass` exists because usage is not final when a campaign finishes. Pass 1
 * runs immediately with `includeUnfinalizedData: true` and produces a
 * provisional cost; later passes re-ask the same window once
 * `metadata.billingPeriods[].volumeFinalized` has flipped, and the difference
 * between passes is what gets reconciled against the wallet. The unique index
 * on (campaign, pass) keeps a retry storm from firing the same pass twice.
 */
export const billingUsageRequests = pgTable(
  'billing_usage_requests',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Null for account-wide sweeps that aren't attributable to one campaign. */
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    /** `requestId` from the 201 response; echoed by the callback. */
    providerRequestId: text('provider_request_id').notNull(),
    provider: text('provider').notNull().default('infobip'),
    status: billingUsageRequestStatusEnum('status').notNull().default('pending'),
    /** 1 = provisional (fired at campaign completion), 2+ = finalization re-ask. */
    pass: integer('pass').notNull().default(1),
    /** Inclusive, `yyyy-MM-dd` as sent. Stored as date: the API has day granularity. */
    sentSince: date('sent_since').notNull(),
    /** Exclusive, `yyyy-MM-dd` as sent. */
    sentUntil: date('sent_until').notNull(),
    /** What we asked for; false only on a finalization pass. */
    includeUnfinalized: boolean('include_unfinalized').notNull().default(true),
    /**
     * From `metadata.billingPeriods[].volumeFinalized` — true only when every
     * period the answer covers is closed. While false the totals can still
     * move, so the campaign stays on the re-query schedule.
     */
    volumeFinalized: boolean('volume_finalized').notNull().default(false),
    /** The campaignReferenceId filter this query used (see `campaigns.id`). */
    campaignReference: text('campaign_reference'),
    /** Verbatim callback body, kept so lines can be re-parsed without re-asking. */
    rawResponse: jsonb('raw_response').$type<Record<string, unknown>>(),
    failureMessage: text('failure_message'),
    requestedAt: ts('requested_at').defaultNow().notNull(),
    respondedAt: ts('responded_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('billing_usage_requests_provider_uq').on(t.provider, t.providerRequestId),
    uniqueIndex('billing_usage_requests_campaign_pass_uq').on(t.campaignId, t.pass),
    index('billing_usage_requests_tenant_idx').on(t.tenantId, t.requestedAt),
    // Drives both the callback-timeout sweeper and the finalization re-ask.
    index('billing_usage_requests_status_idx').on(t.status, t.requestedAt),
  ],
);

/**
 * The callback's `response.rows`, exploded into one row per line item.
 *
 * Infobip returns a columnar payload — `columns: [{name, dataType}]` plus
 * `rows: [[...]]` — whose column set depends on the `aggregateBy` we sent.
 * Parsing it into fixed columns here means every consumer (wallet
 * reconciliation, the campaign report, PostHog) reads the same shape instead
 * of each re-deriving column offsets from the raw JSON.
 *
 * `ordinal` is the row's index in that array. It is part of the uniqueness
 * key so re-parsing a stored `rawResponse` is idempotent: the same payload
 * always produces the same rows, and an interrupted ingest can simply be run
 * again.
 */
export const billingUsageLines = pgTable(
  'billing_usage_lines',
  {
    id: id(),
    requestId: uuid('request_id')
      .notNull()
      .references(() => billingUsageRequests.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id, { onDelete: 'set null' }),
    /** Position in `response.rows` — makes re-ingest of one payload idempotent. */
    ordinal: integer('ordinal').notNull(),
    /** Infobip's own category (SMS, EMAIL, WHATSAPP, VOICE_VIDEO…), kept verbatim. */
    categoryCode: text('category_code').notNull(),
    /** Our channel, mapped from `categoryCode`; null when nothing maps (e.g. AI). */
    channel: channelEnum('channel'),
    countryName: text('country_name'),
    countryCode: text('country_code'),
    sender: text('sender'),
    trafficType: text('traffic_type'),
    /** Present only when DAY was in `aggregateBy`. */
    usageDay: date('usage_day'),
    /** Billed message count for this line. */
    quantity: integer('quantity').notNull().default(0),
    /** Per-unit price in micro-units of `currency` (price × 1e6, integer). */
    unitPriceMicro: bigint('unit_price_micro', { mode: 'number' }).notNull().default(0),
    /** Line total in micro-units. Infobip's own total — never quantity × unit. */
    totalMicro: bigint('total_micro', { mode: 'number' }).notNull().default(0),
    currency: text('currency').notNull().default('EUR'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('billing_usage_lines_request_ordinal_uq').on(t.requestId, t.ordinal),
    index('billing_usage_lines_campaign_idx').on(t.campaignId),
    index('billing_usage_lines_tenant_idx').on(t.tenantId, t.usageDay),
  ],
);

/** Where a recharge's credits came from. Mirrors the crediting ledger entry. */
export const rechargeSourceEnum = pgEnum('recharge_source', [
  'purchase',
  'promotion',
  'bonus',
  'adjustment',
  'trial',
]);

/**
 * One row per credit recharge — the 1-N history behind a wallet's balance.
 *
 * The wallet holds a single `balance_micro`; this table records each top-up
 * that fed it, so "when did this credit arrive, and what did it pay for" is
 * answerable. Rows are created only alongside a positive ledger entry, and
 * `walletTransactionId` points back at it, so the sum of recharge amounts
 * always equals the sum of positive `wallet_transactions` for the tenant.
 *
 * `spending` is a DERIVED rollup, never a running total written by whoever
 * happens to be charging at the time: concurrent campaigns would contend on
 * one row and a lost update would silently corrupt the history. It is
 * recomputed from the ledger by `rebuildRechargeSpending`, which allocates
 * consumption to recharges oldest-first (FIFO — credits are spent in the
 * order they arrived), so a bad rollup is fixed by rebuilding rather than by
 * hand-editing money. `rebuiltAt` says how stale the snapshot is.
 */
export const creditRecharges = pgTable(
  'credit_recharges',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    walletId: uuid('wallet_id')
      .notNull()
      .references(() => wallets.id, { onDelete: 'cascade' }),
    source: rechargeSourceEnum('source').notNull().default('purchase'),
    /** Micro-credits added. Always positive. */
    amountMicro: bigint('amount_micro', { mode: 'number' }).notNull(),
    currency: text('currency').notNull().default('USD'),
    /** The checkout that produced it, when there was one. */
    paymentAttemptId: uuid('payment_attempt_id').references(() => paymentAttempts.id, {
      onDelete: 'set null',
    }),
    /** The crediting ledger entry. One recharge ⇄ one positive transaction. */
    walletTransactionId: uuid('wallet_transaction_id').references(() => walletTransactions.id, {
      onDelete: 'set null',
    }),
    /** Materialized from the FIFO allocation; ≤ `amountMicro`. */
    consumedMicro: bigint('consumed_micro', { mode: 'number' }).notNull().default(0),
    /**
     * Rebuildable rollup of what this recharge paid for. Shape:
     * `{ consumedMicro, remainingMicro, campaigns: [{ campaignId, name,
     * channel, messages, estimatedMicro, actualMicro, currency }],
     * other: [{ referenceType, referenceId, amountMicro }], rebuiltAt }`
     */
    spending: jsonb('spending').$type<Record<string, unknown>>().notNull().default({}),
    rebuiltAt: ts('rebuilt_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // One recharge per crediting ledger entry — the ledger stays the source of
    // truth and a replayed grant can't produce a second recharge row.
    uniqueIndex('credit_recharges_transaction_uq').on(t.walletTransactionId),
    index('credit_recharges_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('credit_recharges_wallet_fifo_idx').on(t.walletId, t.createdAt),
  ],
);

// ---------------------------------------------------------------------------
// Automations (visual workflows)
//
// Execution model and Activepieces provenance:
// docs/architecture/automations-activepieces.md
// ---------------------------------------------------------------------------

export const automationStatusEnum = pgEnum('automation_status', [
  'draft',
  'active',
  'paused',
  'archived',
]);

/**
 * A version is `draft` until published; publishing freezes it. Editing a published
 * automation opens a NEW draft rather than mutating the running definition, so a run
 * started yesterday keeps executing what was published yesterday.
 */
export const automationVersionStateEnum = pgEnum('automation_version_state', [
  'draft',
  'published',
  'archived',
]);

export const automationRunStatusEnum = pgEnum('automation_run_status', [
  'queued',
  'running',
  /** Parked on a delay: nothing is held in memory, `resume_at` says when to continue. */
  'waiting',
  'succeeded',
  'failed',
  'cancelled',
]);

export const automationStepStatusEnum = pgEnum('automation_step_status', [
  'running',
  'succeeded',
  'failed',
  'paused',
  'skipped',
]);

export const automationEventStatusEnum = pgEnum('automation_event_status', [
  'pending',
  'processing',
  'processed',
  'failed',
]);

export const automations = pgTable(
  'automations',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: automationStatusEnum('status').notNull().default('draft'),
    /**
     * Definition new runs use, and `null` until first publish. Deliberately NOT a foreign
     * key: `automation_versions.automation_id` already points the other way, and a pair of
     * mutual FKs would need a deferred constraint for no gain — the version rows cascade
     * with the automation, so a dangling pointer cannot outlive its row.
     */
    publishedVersionId: uuid('published_version_id'),
    /** Version the composer edits. Always present after creation. */
    draftVersionId: uuid('draft_version_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: ts('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    // The list page: one workspace, newest first.
    index('automations_tenant_updated_idx').on(t.tenantId, t.updatedAt),
    index('automations_tenant_status_idx').on(t.tenantId, t.status),
  ],
);

export const automationVersions = pgTable(
  'automation_versions',
  {
    id: id(),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    state: automationVersionStateEnum('state').notNull().default('draft'),
    /** Activepieces-shaped trigger step, including its `nextAction` chain. */
    trigger: jsonb('trigger').$type<Record<string, unknown>>().notNull(),
    /** Publish gate result, recomputed on every save so the composer can show it. */
    valid: boolean('valid').notNull().default(false),
    validationErrors: jsonb('validation_errors')
      .$type<{ stepName: string | null; message: string }[]>()
      .notNull()
      .default([]),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: ts('published_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('automation_versions_automation_version_uq').on(t.automationId, t.version),
    index('automation_versions_tenant_state_idx').on(t.tenantId, t.state),
  ],
);

export const automationRuns = pgTable(
  'automation_runs',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    automationVersionId: uuid('automation_version_id')
      .notNull()
      .references(() => automationVersions.id, { onDelete: 'cascade' }),
    status: automationRunStatusEnum('status').notNull().default('queued'),
    /** `event` | `webhook` | `manual` | `test`. */
    source: text('source').notNull().default('event'),
    triggerPayload: jsonb('trigger_payload').$type<Record<string, unknown>>().notNull().default({}),
    /**
     * The step journal, serialized. This is what makes a run resumable: a worker that picks
     * up a waiting run needs nothing that was in the previous worker's memory.
     */
    executionState: jsonb('execution_state').$type<Record<string, unknown>>().notNull().default({}),
    /** Step to continue after, when `status = 'waiting'`. */
    resumeStepName: text('resume_step_name'),
    resumeAt: ts('resume_at'),
    /** Wall-clock budget guard: a run older than this is terminated by the sweeper. */
    deadlineAt: ts('deadline_at'),
    stepsExecuted: integer('steps_executed').notNull().default(0),
    error: jsonb('error').$type<Record<string, unknown> | null>(),
    /**
     * Exactly-once key for event-driven runs (`{versionId}:{eventDedupeKey}`). A
     * redelivered provider report cannot start the same automation twice.
     */
    dedupeKey: text('dedupe_key'),
    /** Set while a worker holds the run, so the stall sweeper can tell hung from queued. */
    claimedAt: ts('claimed_at'),
    startedAt: ts('started_at'),
    completedAt: ts('completed_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('automation_runs_dedupe_uq')
      .on(t.tenantId, t.dedupeKey)
      .where(sql`${t.dedupeKey} is not null`),
    // Run history for one automation, newest first.
    index('automation_runs_automation_created_idx').on(t.tenantId, t.automationId, t.createdAt),
    // Resume sweeper + stall recovery: both scan by status then time.
    index('automation_runs_status_resume_idx').on(t.status, t.resumeAt),
    index('automation_runs_status_claimed_idx').on(t.status, t.claimedAt),
  ],
);

export const automationStepRuns = pgTable(
  'automation_step_runs',
  {
    id: id(),
    runId: uuid('run_id')
      .notNull()
      .references(() => automationRuns.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    /** Ordinal within the run, so the inspector can render execution order. */
    seq: integer('seq').notNull(),
    stepName: text('step_name').notNull(),
    displayName: text('display_name').notNull(),
    stepType: text('step_type').notNull(),
    /** Piece + action/trigger this step ran, for the inspector's icon and label. */
    pieceName: text('piece_name'),
    status: automationStepStatusEnum('status').notNull(),
    /** Already masked — secrets never reach this table. */
    input: jsonb('input').$type<unknown>(),
    output: jsonb('output').$type<unknown>(),
    errorMessage: text('error_message'),
    errorCategory: text('error_category'),
    attempt: integer('attempt').notNull().default(1),
    startedAt: ts('started_at').defaultNow().notNull(),
    completedAt: ts('completed_at'),
    durationMs: integer('duration_ms'),
  },
  (t) => [index('automation_step_runs_run_seq_idx').on(t.runId, t.seq)],
);

/**
 * Durable domain-event log the trigger dispatcher polls. Same shape and the same
 * `FOR UPDATE SKIP LOCKED` claiming as `outbox_events`, deliberately: it is the pattern
 * this codebase already operates.
 */
export const automationEvents = pgTable(
  'automation_events',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    /** Identity of the occurrence; a redelivery collides here instead of fanning out. */
    dedupeKey: text('dedupe_key').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    status: automationEventStatusEnum('status').notNull().default('pending'),
    availableAt: ts('available_at').defaultNow().notNull(),
    processedAt: ts('processed_at'),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastError: text('last_error'),
    occurredAt: ts('occurred_at').defaultNow().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('automation_events_dedupe_uq').on(t.dedupeKey),
    index('automation_events_status_available_idx').on(t.status, t.availableAt),
  ],
);

export const automationWebhooks = pgTable(
  'automation_webhooks',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => automations.id, { onDelete: 'cascade' }),
    /**
     * SHA-256 of the token. The URL IS the credential (same reasoning as the unsubscribe
     * link), so the plaintext is shown once at mint time and never stored.
     */
    tokenHash: text('token_hash').notNull(),
    /** First 8 chars, so the UI can identify a token it can no longer display. */
    tokenPrefix: text('token_prefix').notNull(),
    /** Last body received, for the composer's "capture a test payload" flow. */
    lastPayload: jsonb('last_payload').$type<Record<string, unknown> | null>(),
    lastSeenAt: ts('last_seen_at'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('automation_webhooks_token_uq').on(t.tokenHash),
    uniqueIndex('automation_webhooks_automation_uq').on(t.automationId),
  ],
);

export const automationConnections = pgTable(
  'automation_connections',
  {
    id: id(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Piece this credential belongs to, e.g. `@maildrill/http`. */
    pieceName: text('piece_name').notNull(),
    /** AES-256-GCM ciphertext (`v1.<iv>.<ct>.<tag>`); never leaves the backend. */
    encryptedSecret: text('encrypted_secret').notNull(),
    /** Non-secret display metadata (account label, scopes). Safe to return. */
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('automation_connections_tenant_name_uq').on(t.tenantId, t.name)],
);

/**
 * Materialised segment membership.
 *
 * Segments are rule-derived and have no membership table, so "entered"/"exited" cannot be
 * observed from a write — they have to be diffed. Only segments referenced by an active
 * automation are tracked, so this stays proportional to what is actually automated.
 */
export const automationSegmentState = pgTable(
  'automation_segment_state',
  {
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    segmentId: uuid('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id')
      .notNull()
      .references(() => subscribers.id, { onDelete: 'cascade' }),
    enteredAt: ts('entered_at').defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.segmentId, t.subscriberId] }),
    index('automation_segment_state_tenant_idx').on(t.tenantId, t.segmentId),
  ],
);
