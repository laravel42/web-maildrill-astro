# Maildrill — Queue & Event Processing Service

**Status:** Scoped · **Owner:** Platform · **Last updated:** 2026-07-19

## What this is

The asynchronous messaging engine for Maildrill: a headless **Fastify (Node) service + BullMQ workers** that turn durable PostgreSQL records into provider sends (Infobip first), ingest delivery/engagement webhooks, and enforce retries, rate limits, idempotency, and multitenant isolation.

This is the **infrastructure layer beneath the product**. The product data & delivery model — subscribers, lists, segments, templates, campaign authoring — lives in [infobip-api-scheme.md](./infobip-api-scheme.md). Contact-list management, the template designer, and the campaign editor are explicit **non-goals here** (§26).

## Settled decisions

| Area | Decision |
|---|---|
| Runtime | **Fastify (Node) on a dedicated VPS.** Cloudflare Workers is *out* for this service — BullMQ + long-lived workers + Redis/Valkey rule out edge. |
| Datastore | **PostgreSQL** = source of truth; **Redis/Valkey** = BullMQ jobs, queue metadata, rate-limit state, locks, short-lived cache only. |
| ORM / migrations | **Drizzle** (`packages/database`, `migrations/`). |
| Tenancy | **Shared schema + `tenant_id` discriminator**, isolated at the query/API layer; **Postgres RLS optional** as defense-in-depth. (`tenant` here == the product's `workspace`.) |
| Voice | **In-scope as channel plumbing** (enum, queues, states, separate concurrency); the product UI may still treat it as a spike. |
| Auth | **Auth.js** for user login in the Astro frontend; **API keys / signed JWT + tenant scoping** for this service's machine-facing API. |
| Queue / ops | **BullMQ** on Redis/Valkey; **Pino** logging; **Bull Board** for protected queue admin. |

> ⚠ **Open — confirm:** where does the *product CRUD API* (subscribers / lists / template authoring — the old `/api/v1`) run? Working assumption: Cloudflare Workers is dropped everywhere; the product API and this messaging service are separate **apps in one VPS monorepo**, and `web-maildrill-astro` becomes frontend-only (UI + Auth.js login). Correct if wrong.

---

## Project Scope

Design and implement the asynchronous message-processing layer for Maildrill, a multitenant multichannel communication platform.

Maildrill sends communications through external provider APIs, initially Infobip, across the following channels:

* Email
* SMS
* WhatsApp
* Voice

The system must support:

* Immediate message sending
* Scheduled message sending
* Bulk campaign dispatch
* Provider rate limiting
* Automatic retries
* Delivery-status ingestion
* Provider webhook ingestion
* Message event history
* Failed-job inspection and replay
* Multitenant isolation
* Reliable message processing without duplicate sends

The initial implementation must remain operationally simple and use only:

* Fastify
* TypeScript
* PostgreSQL
* Redis or Valkey
* BullMQ

Do not introduce Kafka, Redpanda, RabbitMQ, ClickHouse, Temporal, Elasticsearch, or other infrastructure unless explicitly requested.

⸻

1. Core Architectural Principles

The implementation must follow these boundaries:

Fastify

Fastify handles:

* Public and internal HTTP APIs
* Campaign creation requests
* Message submission requests
* Provider webhook endpoints
* Message-status queries
* Administrative queue operations
* Request validation and authentication

Fastify must not execute provider sends synchronously inside HTTP request handlers.

PostgreSQL

PostgreSQL is the authoritative source of truth for:

* Tenants
* Campaigns
* Messages
* Recipients
* Message state
* Provider attempts
* Provider events
* Webhook payloads
* Outbox records
* Idempotency records
* Usage and billing records

Business state must never depend exclusively on Redis or BullMQ.

BullMQ

BullMQ is responsible for:

* Asynchronous message dispatch
* Scheduled messages
* Retries
* Backoff
* Provider-event processing
* Reconciliation
* Maintenance jobs
* Failed-job management

BullMQ must be treated as an execution system, not as the permanent business datastore.

Redis or Valkey

Redis or Valkey stores:

* BullMQ job state
* Queue metadata
* Rate-limit state
* Temporary locks
* Short-lived caches

Permanent message or campaign state must not exist only in Redis.

⸻

2. Initial Queue Topology

Implement the following queues:

message-dispatch
provider-events
scheduled-messages
maintenance
dead-letter

message-dispatch

Processes outbound provider requests.

Supported job names:

send-email
send-sms
send-whatsapp
send-voice

provider-events

Processes provider callbacks and normalizes them into internal message events.

Supported job names:

process-delivery-report
process-engagement-event
process-voice-event
process-provider-error

scheduled-messages

Activates messages whose scheduled time has arrived.

Supported job names:

activate-message
activate-campaign-batch

maintenance

Runs operational and recovery tasks.

Supported job names:

publish-outbox
reconcile-provider-status
recover-stalled-messages
expire-idempotency-records
purge-retained-jobs

dead-letter

Represents permanently failed operations requiring manual inspection or controlled replay.

Do not use the dead-letter queue as an automatic infinite-retry mechanism.

⸻

3. Message Lifecycle

Use a controlled message-state model.

Initial states:

draft
scheduled
queued
processing
submitted
sent
delivered
read
failed
cancelled
expired

The implementation must prevent invalid or regressive state transitions.

Examples:

draft -> scheduled
draft -> queued
scheduled -> queued
queued -> processing
processing -> submitted
submitted -> sent
sent -> delivered
delivered -> read
processing -> failed
submitted -> failed

A delayed provider event must not overwrite a more advanced state.

For example:

delivered -> sent

must be rejected.

State changes must use:

* Explicit transition rules
* Provider event timestamps
* Internal processing timestamps
* Optimistic concurrency or row locking where appropriate

⸻

4. PostgreSQL Data Model

Implement migrations for at least the following entities.

tenants

Required fields:

id
name
status
created_at
updated_at

provider_accounts

Required fields:

id
tenant_id
provider
channel
status
configuration_reference
created_at
updated_at

Secrets must not be stored as plain text.

The implementation should support an abstraction allowing provider credentials to come from environment variables or a future secret-management service.

campaigns

Required fields:

id
tenant_id
name
status
scheduled_at
started_at
completed_at
created_at
updated_at

messages

Required fields:

id
tenant_id
campaign_id
recipient_id
channel
provider
status
scheduled_at
queued_at
processing_started_at
submitted_at
sent_at
delivered_at
read_at
failed_at
cancelled_at
provider_message_id
idempotency_key
attempt_count
last_error_code
last_error_message
version
created_at
updated_at

Required constraints:

UNIQUE tenant_id + idempotency_key

Use a version column or equivalent protection against concurrent state overwrites.

message_attempts

Each provider request attempt must be recorded.

Required fields:

id
message_id
tenant_id
provider
channel
attempt_number
status
provider_request_id
provider_response_code
provider_error_code
error_category
request_started_at
request_completed_at
created_at

Sensitive request or response data must be sanitized before storage.

message_events

Required fields:

id
message_id
tenant_id
provider
provider_event_id
event_type
provider_status
occurred_at
received_at
processed_at
payload
created_at

Required constraint:

UNIQUE provider + provider_event_id

When a provider does not supply a stable event ID, generate a deterministic event fingerprint from stable payload fields.

webhook_events

Store the original provider webhook before asynchronous processing.

Required fields:

id
provider
tenant_id
provider_event_id
event_fingerprint
headers
payload
received_at
processed_at
processing_status
processing_error
created_at

Webhook retention must be configurable.

outbox_events

Required fields:

id
tenant_id
aggregate_type
aggregate_id
event_type
payload
status
available_at
published_at
attempt_count
last_error
created_at
updated_at

Possible states:

pending
publishing
published
failed

usage_records

Prepare a basic usage ledger for future billing.

Required fields:

id
tenant_id
message_id
channel
provider
usage_type
quantity
unit
occurred_at
created_at

Usage records must be idempotent.

⸻

5. Transactional Outbox

The transactional outbox pattern is mandatory.

Whenever an operation creates a message that must be queued, perform both actions in the same PostgreSQL transaction:

1. Insert or update the message.
2. Insert an outbox_events record.
3. Commit the transaction.

A separate outbox publisher must:

1. Read pending outbox records.
2. Lock records safely to support multiple publisher instances.
3. Add the corresponding BullMQ job.
4. Mark the outbox event as published.
5. Retry temporary failures.
6. Preserve failed records for investigation.

Use PostgreSQL row locking with an approach equivalent to:

FOR UPDATE SKIP LOCKED

The publisher must be safe to run concurrently across multiple processes.

Publishing the same outbox event more than once must not cause duplicate provider sends.

⸻

6. Job Contracts

All jobs must use versioned, strongly typed payloads.

Example:

interface SendMessageJobV1 {
  version: 1;
  tenantId: string;
  messageId: string;
  channel: "email" | "sms" | "whatsapp" | "voice";
  provider: "infobip";
  correlationId: string;
}

Job payloads must contain references, not full business records.

Do not place the following directly in BullMQ payloads:

* Full message bodies when avoidable
* Provider credentials
* Access tokens
* Large recipient lists
* Binary files
* Large attachments
* Complete database entities

Workers must retrieve the authoritative message state from PostgreSQL.

Every worker must verify that the message is still eligible for execution before calling the provider.

⸻

7. Idempotency and Duplicate Protection

The system must assume at-least-once processing.

Exactly-once delivery must not be claimed.

Duplicate protection is required at four levels:

API idempotency

Message-submission endpoints must accept an idempotency key.

The same tenant and idempotency key must return the existing message rather than create a new one.

Queue idempotency

Use deterministic BullMQ job IDs.

Example:

send:{tenantId}:{messageId}:{generation}

Worker idempotency

Before sending, the worker must verify:

* The message has not already been submitted.
* The message has not been cancelled.
* The message has not expired.
* The same send generation has not already succeeded.

Webhook idempotency

Provider webhooks must be deduplicated using:

provider + provider_event_id

or a deterministic event fingerprint.

⸻

8. Provider Adapter Architecture

Implement provider integrations behind a common interface.

Example:

interface MessagingProvider {
  sendEmail(input: SendEmailInput): Promise<ProviderSendResult>;
  sendSms(input: SendSmsInput): Promise<ProviderSendResult>;
  sendWhatsApp(input: SendWhatsAppInput): Promise<ProviderSendResult>;
  startVoiceCall(input: StartVoiceCallInput): Promise<ProviderSendResult>;
  normalizeWebhook(input: ProviderWebhookInput): Promise<NormalizedProviderEvent[]>;
  getMessageStatus?(input: ProviderStatusInput): Promise<ProviderStatusResult>;
}

Implement Infobip as the first provider.

Provider-specific request models, status codes and error responses must not leak into the domain layer.

Normalize provider responses into internal types.

Example result:

interface ProviderSendResult {
  accepted: boolean;
  providerMessageId?: string;
  providerRequestId?: string;
  status: "submitted" | "rejected";
  error?: {
    category:
      | "validation"
      | "authentication"
      | "rate_limit"
      | "temporary"
      | "permanent"
      | "unknown";
    code?: string;
    message: string;
    retryable: boolean;
  };
}

The architecture must allow additional providers to be introduced without rewriting queue workers or domain services.

⸻

9. Retry Policy

Retries must depend on error classification.

Retryable failures include:

* Network timeouts
* Connection failures
* HTTP 429 responses
* Temporary provider unavailability
* Most HTTP 5xx responses
* Temporary database or Redis failures

Non-retryable failures include:

* Invalid recipient data
* Invalid message content
* Invalid provider template
* Missing required fields
* Unsupported destination
* Authentication or authorization errors that require configuration changes
* Permanent provider rejection

Recommended initial retry policy:

Maximum attempts: 5
Backoff: exponential
Initial delay: 2 seconds
Maximum practical delay: configurable
Jitter: required

Do not retry indefinitely.

When attempts are exhausted:

1. Mark the message failed where appropriate.
2. Record the final attempt.
3. Create a dead-letter record or job.
4. Emit structured logs and operational metrics.
5. Preserve enough information for controlled replay.

⸻

10. Rate Limiting

Support rate limiting by:

* Provider
* Channel
* Tenant
* Provider account

Initial implementation may use BullMQ rate limiting combined with Redis counters.

Rate limits must be configurable rather than hardcoded.

Example configuration:

interface ChannelRateLimit {
  provider: string;
  channel: string;
  maxRequests: number;
  durationMs: number;
  maxConcurrency?: number;
}

One tenant must not be able to consume all available worker capacity.

Where strict per-tenant fairness cannot be implemented cleanly with the selected BullMQ edition, document the limitation and implement a reasonable scheduling strategy using tenant-aware dispatch batches.

Voice concurrency must be controlled separately from SMS, email and WhatsApp throughput.

⸻

11. Webhook Ingestion

Implement provider-specific webhook routes through Fastify.

Example:

POST /webhooks/infobip/delivery
POST /webhooks/infobip/engagement
POST /webhooks/infobip/voice

Webhook handlers must:

1. Validate provider authentication or signature when available.
2. Enforce payload-size limits.
3. Parse the minimum information needed for deduplication.
4. Persist the original webhook in PostgreSQL.
5. Avoid duplicate inserts.
6. Create an outbox event or BullMQ processing job.
7. Return a successful response quickly.

Do not perform complete event processing synchronously inside the webhook request.

Malformed or unauthorized payloads must return appropriate HTTP status codes and must not be queued.

Unknown but valid provider event types should be retained for inspection rather than silently discarded.

⸻

12. Provider Event Processing

The provider-event worker must:

1. Load the raw webhook event.
2. Normalize the provider payload.
3. Locate the internal message using the provider message ID or correlation metadata.
4. Insert one or more message_events.
5. Apply valid message-state transitions.
6. Create usage records where applicable.
7. Mark the webhook event as processed.
8. Preserve processing failures for retry or manual inspection.

Processing must occur inside a PostgreSQL transaction when multiple related records are updated.

Late, duplicate or out-of-order events must not corrupt message state.

⸻

13. Scheduled Messages and Campaign Batching

Scheduled messages must be stored in PostgreSQL.

BullMQ delayed jobs may be used as an optimization, but PostgreSQL remains authoritative.

Implement a scheduler that periodically finds eligible messages using:

status = scheduled
scheduled_at <= current time

The scheduler must:

* Use safe database locking.
* Support multiple scheduler instances.
* Process messages in configurable batches.
* Insert outbox records for dispatch.
* Avoid duplicate activation.
* Support campaign pause and cancellation.

Large campaigns must not enqueue all recipients in one synchronous API request.

Campaign recipients must be generated and dispatched in batches.

Configuration must support:

campaign batch size
maximum jobs enqueued per cycle
scheduler interval
tenant-level throughput
channel-level throughput

⸻

14. Reconciliation

Implement a maintenance process for messages stuck in ambiguous states.

Examples:

processing for too long
submitted without a provider event
missing provider message ID
webhook received before message update

The reconciliation worker may query the provider status API when supported.

Reconciliation must be conservative and idempotent.

It must not repeat a send merely because the final delivery state is unknown.

⸻

15. Cancellation

Support message cancellation while the message is still eligible.

Cancellation must:

1. Update PostgreSQL first.
2. Prevent waiting workers from sending.
3. Remove or invalidate queued jobs when practical.
4. Recheck cancellation state immediately before the provider call.

Removing a BullMQ job alone is not sufficient because a worker may already be processing it.

Cancellation after provider submission may be marked as requested but cannot be assumed to stop provider delivery.

⸻

16. Fastify API Scope

Implement APIs for the following use cases.

Submit message

POST /v1/messages

Must support:

* Tenant context
* Channel
* Recipient reference
* Content or template reference
* Optional scheduling
* Provider selection or automatic provider resolution
* Idempotency key

The endpoint must return after durable database acceptance, not after provider delivery.

Get message

GET /v1/messages/:messageId

Returns:

* Current state
* Channel
* Provider
* Relevant timestamps
* Provider message reference where safe
* Latest error
* Attempt count

List message events

GET /v1/messages/:messageId/events

Return normalized event history with pagination.

Cancel message

POST /v1/messages/:messageId/cancel

Retry failed message

POST /v1/messages/:messageId/retry

Retry must create a new controlled execution generation.

It must not mutate history or erase previous attempts.

Internal health endpoints

GET /health/live
GET /health/ready

Readiness must verify critical dependencies appropriately without creating excessive load.

Administrative queue endpoints

Provide protected internal endpoints for:

* Queue summaries
* Failed-job inspection
* Controlled replay
* Pausing and resuming workers or dispatch
* Outbox backlog inspection

Do not expose raw BullMQ administration publicly.

⸻

17. Validation and Security

Use a Fastify-compatible schema-validation system.

All request and job payloads must be validated.

Authentication model:

* User-facing login is handled by Auth.js in the Astro frontend (outside this service).
* This service authenticates machine callers with API keys or signed JWTs, each bound to a tenant. Tenant identity is always derived from the credential, never from the request body.
* Provider webhooks are authenticated by signature or shared secret where Infobip supports it.

Security requirements:

* Tenant authorization on every business query
* No cross-tenant message access
* Provider webhook authentication where supported
* Request-size limits
* Rate limiting for public APIs
* Secure secret handling
* Sanitized logs
* No credentials in job payloads
* No access tokens in database error fields
* No sensitive recipient content in routine logs

Generate and propagate:

requestId
correlationId
tenantId
messageId
campaignId
jobId
providerRequestId

Never trust a tenant ID supplied in the request body when tenant identity is already available through authentication.

⸻

18. Observability

Use Pino for structured logging.

Every worker execution must log:

* Job start
* Job completion
* Job retry
* Permanent failure
* Processing duration
* Queue name
* Job name
* Attempt number
* Tenant ID
* Message ID
* Provider
* Channel
* Correlation ID

Do not log message content or credentials by default.

Expose basic application metrics in a format compatible with future Prometheus integration.

Minimum metrics:

queue_waiting_jobs
queue_active_jobs
queue_failed_jobs
queue_delayed_jobs
job_processing_duration
message_dispatch_total
message_dispatch_failed_total
provider_request_total
provider_error_total
provider_webhook_total
provider_webhook_duplicate_total
outbox_pending_total
outbox_publish_failed_total

Include Bull Board or an equivalent protected BullMQ administration interface.

It must be available only through internal authentication or a private network.

⸻

19. Graceful Shutdown

API processes and workers must handle:

SIGTERM
SIGINT

Shutdown behavior:

1. Stop accepting new work.
2. Close Fastify.
3. Stop worker job acquisition.
4. Allow active jobs to complete within a configurable grace period.
5. Close BullMQ connections.
6. Close Redis or Valkey connections.
7. Close PostgreSQL connections.
8. Exit with an appropriate status.

The implementation must support containerized deployment and rolling releases.

⸻

20. Repository Structure

Use a clear monorepo or modular repository structure.

Recommended structure:

apps/
  api/
  worker-dispatch/
  worker-events/
  worker-scheduler/
  worker-maintenance/
packages/
  config/
  database/
  domain/
  queues/
  providers/
    core/
    infobip/
  observability/
  validation/
  testing/
migrations/
scripts/
docker/

Shared packages must not create circular dependencies.

Recommended dependency direction:

domain
  ↑
application services
  ↑
API and workers
  ↑
infrastructure adapters

Provider-specific code must remain isolated inside provider adapter packages.

⸻

21. Configuration

Validate all environment variables at startup.

Required configuration categories:

Application
PostgreSQL
Redis or Valkey
BullMQ
Infobip
Worker concurrency
Queue retry settings
Provider rate limits
Scheduler intervals
Retention settings
Webhook security
Logging
Administration access

Application startup must fail clearly when required configuration is invalid.

Do not scatter direct environment-variable access throughout the codebase.

Use a single typed configuration module.

⸻

22. Testing Requirements

Implement automated tests at three levels.

Unit tests

Cover:

* State-transition rules
* Retry classification
* Provider error normalization
* Event normalization
* Idempotency-key generation
* Job payload validation
* Rate-limit configuration
* Message eligibility checks

Integration tests

Use real PostgreSQL and Redis or Valkey test containers where practical.

Cover:

* Transactional outbox publishing
* Duplicate API requests
* Duplicate webhook events
* Job retry behavior
* Worker idempotency
* Concurrent outbox publishers
* Scheduled-message activation
* Campaign batch activation
* Cancellation races
* Out-of-order delivery events

End-to-end tests

Cover:

API submission
-> PostgreSQL message
-> outbox event
-> BullMQ job
-> mocked Infobip adapter
-> message attempt
-> submitted status
-> simulated provider webhook
-> provider event worker
-> delivered status

Tests must not depend on the real Infobip API by default.

Create provider fixtures and a deterministic mock provider.

⸻

23. Database and Queue Retention

Define configurable retention policies.

Suggested initial defaults:

Completed BullMQ jobs: retain for 24 hours or a bounded count
Failed BullMQ jobs: retain for 7 days
Raw webhook events: retain for 30 days
Message events: retain according to product and compliance requirements
Message attempts: permanent or long-term retention
Outbox published records: retain for a bounded audit period

Retention jobs must process records in batches and avoid long-running locks.

⸻

24. Delivery Phases

Phase 1 — Foundation

Deliver:

* Repository structure
* Typed configuration
* PostgreSQL connection
* Redis or Valkey connection
* BullMQ queue definitions
* Base migrations
* Fastify health endpoints
* Structured logging

Phase 2 — Outbound dispatch

Deliver:

* Message submission API
* Transactional outbox
* Outbox publisher
* Dispatch worker
* Provider abstraction
* Infobip adapter
* Attempts and retry classification
* Idempotent sending

Phase 3 — Provider events

Deliver:

* Infobip webhook endpoints
* Raw webhook persistence
* Event deduplication
* Event-processing worker
* Message event history
* Controlled state transitions

Phase 4 — Scheduling and campaigns

Deliver:

* Scheduled-message activation
* Campaign batching
* Campaign pause and cancellation
* Tenant-aware dispatch controls

Phase 5 — Operations

Deliver:

* Dead-letter handling
* Manual replay
* Reconciliation worker
* Bull Board
* Metrics
* Retention jobs
* Operational documentation

⸻

25. Acceptance Criteria

The implementation is accepted when all of the following are true:

1. Submitting a message stores it durably before returning success.
2. A temporary Redis failure does not cause a stored message to disappear permanently.
3. The outbox publisher eventually queues unpublished messages.
4. Retried jobs do not cause duplicate provider sends.
5. Duplicate webhook deliveries do not create duplicate message events.
6. Out-of-order provider events do not regress message status.
7. Failed provider calls are classified as retryable or permanent.
8. Retryable calls use bounded exponential backoff with jitter.
9. Permanent failures reach a visible dead-letter state.
10. Scheduled messages are activated once.
11. Multiple scheduler and outbox-worker instances can run safely.
12. Tenant data is isolated at the query and API layers.
13. Provider-specific logic is isolated behind an adapter.
14. Workers shut down gracefully.
15. The complete flow is covered by automated integration tests.
16. No Kafka, ClickHouse, Temporal or additional infrastructure is required to run the launch version.

⸻

26. Explicit Non-Goals

Do not implement during this scope:

* Visual campaign editor
* Contact-list management
* Email template designer
* AI content generation
* Full billing and invoicing
* Kafka or Redpanda
* ClickHouse analytics
* Temporal workflows
* Multiple provider-routing optimization
* Cross-region active-active deployment
* Exactly-once delivery guarantees
* Full customer-facing analytics dashboards
* Provider cost optimization
* Advanced workflow branching
* Machine-learning delivery optimization

The design must leave room for these features without prematurely implementing them.

⸻

27. Claude Implementation Rules

When implementing this project:

1. Work incrementally by delivery phase.
2. Do not introduce dependencies without explaining their purpose.
3. Prefer standard, maintained packages with strong TypeScript support.
4. Keep domain logic independent from Fastify, BullMQ and Infobip.
5. Do not hide errors with broad catch blocks.
6. Use typed error classes and explicit error categorization.
7. Do not use any unless technically unavoidable and documented.
8. Validate all external data, including queue payloads and provider webhooks.
9. Add migrations rather than modifying database state manually.
10. Add tests with every major behavior.
11. Document architectural decisions in concise ADR files.
12. Avoid speculative abstractions that do not support a current requirement.
13. Do not claim exactly-once delivery.
14. Treat duplicate execution as normal.
15. Keep PostgreSQL as the source of truth.
16. Keep provider calls outside database transactions.
17. Never store provider credentials in jobs or logs.
18. Produce production-ready code rather than pseudocode.

For every implementation phase, provide:

* Files created or modified
* Architectural decisions
* Database changes
* Environment variables
* Commands to run
* Tests added
* Remaining limitations
* Next implementation step

This can also be reduced into a shorter system prompt plus separate technical specification for lower Claude API token consumption.