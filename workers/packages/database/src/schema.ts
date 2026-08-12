import { sql } from 'drizzle-orm';
import {
  bigint,
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
   */
  infobipEntityId: text('infobip_entity_id').unique(),
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
