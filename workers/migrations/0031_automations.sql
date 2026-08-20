-- Automations: visual workflows (trigger → steps) executed durably by the
-- automation worker roles. Design + Activepieces provenance:
-- docs/architecture/automations-activepieces.md
--
-- Idempotent throughout so a hand-applied dev DB stays consistent.

DO $$ BEGIN
  CREATE TYPE "automation_status" AS ENUM ('draft', 'active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "automation_version_state" AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "automation_run_status" AS ENUM
    ('queued', 'running', 'waiting', 'succeeded', 'failed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "automation_step_status" AS ENUM
    ('running', 'succeeded', 'failed', 'paused', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "automation_event_status" AS ENUM
    ('pending', 'processing', 'processed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "automations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "status" "automation_status" NOT NULL DEFAULT 'draft',
  -- Deliberately not foreign keys: automation_versions.automation_id already
  -- points the other way, and a mutual pair would need a deferred constraint
  -- for no gain (versions cascade with the automation).
  "published_version_id" uuid,
  "draft_version_id" uuid,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- The list page reads one workspace newest-first; the status filter is the
-- only other predicate it applies.
CREATE INDEX IF NOT EXISTS "automations_tenant_updated_idx"
  ON "automations" ("tenant_id", "updated_at");
CREATE INDEX IF NOT EXISTS "automations_tenant_status_idx"
  ON "automations" ("tenant_id", "status");

CREATE TABLE IF NOT EXISTS "automation_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "automation_id" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "version" integer NOT NULL,
  "state" "automation_version_state" NOT NULL DEFAULT 'draft',
  "trigger" jsonb NOT NULL,
  "valid" boolean NOT NULL DEFAULT false,
  "validation_errors" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "automation_versions_automation_version_uq"
  ON "automation_versions" ("automation_id", "version");
CREATE INDEX IF NOT EXISTS "automation_versions_tenant_state_idx"
  ON "automation_versions" ("tenant_id", "state");

CREATE TABLE IF NOT EXISTS "automation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "automation_id" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  "automation_version_id" uuid NOT NULL
    REFERENCES "automation_versions"("id") ON DELETE CASCADE,
  "status" "automation_run_status" NOT NULL DEFAULT 'queued',
  "source" text NOT NULL DEFAULT 'event',
  "trigger_payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- The serialized step journal. This is what makes a run resumable without
  -- anything surviving in a worker's memory.
  "execution_state" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "resume_step_name" text,
  "resume_at" timestamptz,
  "deadline_at" timestamptz,
  "steps_executed" integer NOT NULL DEFAULT 0,
  "error" jsonb,
  "dedupe_key" text,
  "claimed_at" timestamptz,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Exactly-once for event-driven runs: a redelivered provider report collides
-- here instead of starting the automation a second time.
CREATE UNIQUE INDEX IF NOT EXISTS "automation_runs_dedupe_uq"
  ON "automation_runs" ("tenant_id", "dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "automation_runs_automation_created_idx"
  ON "automation_runs" ("tenant_id", "automation_id", "created_at");
-- Resume sweeper: waiting runs whose resume_at has passed.
CREATE INDEX IF NOT EXISTS "automation_runs_status_resume_idx"
  ON "automation_runs" ("status", "resume_at");
-- Stall recovery: running runs whose worker died holding them.
CREATE INDEX IF NOT EXISTS "automation_runs_status_claimed_idx"
  ON "automation_runs" ("status", "claimed_at");

CREATE TABLE IF NOT EXISTS "automation_step_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" uuid NOT NULL REFERENCES "automation_runs"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "seq" integer NOT NULL,
  "step_name" text NOT NULL,
  "display_name" text NOT NULL,
  "step_type" text NOT NULL,
  "piece_name" text,
  "status" "automation_step_status" NOT NULL,
  -- Already masked on the way in; secrets never reach this table.
  "input" jsonb,
  "output" jsonb,
  "error_message" text,
  "error_category" text,
  "attempt" integer NOT NULL DEFAULT 1,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz,
  "duration_ms" integer
);

CREATE INDEX IF NOT EXISTS "automation_step_runs_run_seq_idx"
  ON "automation_step_runs" ("run_id", "seq");

-- Durable domain-event log the trigger dispatcher polls, claimed with
-- FOR UPDATE SKIP LOCKED exactly like outbox_events.
CREATE TABLE IF NOT EXISTS "automation_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "payload" jsonb NOT NULL,
  "status" "automation_event_status" NOT NULL DEFAULT 'pending',
  "available_at" timestamptz NOT NULL DEFAULT now(),
  "processed_at" timestamptz,
  "attempt_count" integer NOT NULL DEFAULT 0,
  "last_error" text,
  "occurred_at" timestamptz NOT NULL DEFAULT now(),
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "automation_events_dedupe_uq"
  ON "automation_events" ("dedupe_key");
CREATE INDEX IF NOT EXISTS "automation_events_status_available_idx"
  ON "automation_events" ("status", "available_at");

CREATE TABLE IF NOT EXISTS "automation_webhooks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "automation_id" uuid NOT NULL REFERENCES "automations"("id") ON DELETE CASCADE,
  -- The URL is the credential, so only its hash is stored (same reasoning as
  -- the unsubscribe token). The prefix exists so the UI can name a token it
  -- can no longer show.
  "token_hash" text NOT NULL,
  "token_prefix" text NOT NULL,
  "last_payload" jsonb,
  "last_seen_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "automation_webhooks_token_uq"
  ON "automation_webhooks" ("token_hash");
CREATE UNIQUE INDEX IF NOT EXISTS "automation_webhooks_automation_uq"
  ON "automation_webhooks" ("automation_id");

CREATE TABLE IF NOT EXISTS "automation_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "piece_name" text NOT NULL,
  -- AES-256-GCM ciphertext (v1.<iv>.<ct>.<tag>); never returned by the API.
  "encrypted_secret" text NOT NULL,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "automation_connections_tenant_name_uq"
  ON "automation_connections" ("tenant_id", "name");

-- Materialised segment membership. Segments are rule-derived and have no
-- membership table, so "entered"/"exited" has to be diffed rather than
-- observed. Only segments referenced by an active automation are tracked.
CREATE TABLE IF NOT EXISTS "automation_segment_state" (
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "segment_id" uuid NOT NULL REFERENCES "segments"("id") ON DELETE CASCADE,
  "subscriber_id" uuid NOT NULL REFERENCES "subscribers"("id") ON DELETE CASCADE,
  "entered_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "automation_segment_state_pk" PRIMARY KEY ("segment_id", "subscriber_id")
);

CREATE INDEX IF NOT EXISTS "automation_segment_state_tenant_idx"
  ON "automation_segment_state" ("tenant_id", "segment_id");
