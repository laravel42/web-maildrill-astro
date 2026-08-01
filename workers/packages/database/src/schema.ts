import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
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
    idempotencyKey: text('idempotency_key'),
    // Controlled execution generation; bumped on retry so a new send job id is used.
    generation: integer('generation').notNull().default(0),
    attemptCount: integer('attempt_count').notNull().default(0),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
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
    index('messages_tenant_idx').on(t.tenantId),
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
  (t) => [
    uniqueIndex('subscribers_tenant_email_uq').on(t.tenantId, t.email),
    index('subscribers_tenant_status_idx').on(t.tenantId, t.status),
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
    // Consent & lifecycle configuration. Template references are SET NULL so
    // deleting a template downgrades the list to its default behavior rather
    // than blocking the delete.
    gdprConsent: boolean('gdpr_consent').notNull().default(false),
    doubleOptIn: boolean('double_opt_in').notNull().default(false),
    doubleOptOut: boolean('double_opt_out').notNull().default(false),
    doubleOptInTemplateId: uuid('double_opt_in_template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    doubleOptOutTemplateId: uuid('double_opt_out_template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    welcomeEmailTemplateId: uuid('welcome_email_template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
    goodbyeEmailTemplateId: uuid('goodbye_email_template_id').references(() => templates.id, {
      onDelete: 'set null',
    }),
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
