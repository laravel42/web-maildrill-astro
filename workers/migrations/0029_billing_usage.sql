-- Provider-billed usage from the Infobip Billing Usage API, plus the recharge
-- history that campaign spend is allocated against.
--
-- Until now the only cost figure in the product was an ESTIMATE: the local
-- rate card priced each delivered message and the wallet was debited from
-- that. Nothing ever compared it to what Infobip actually charged, so the
-- estimate could drift indefinitely and no one would know. These tables hold
-- the provider's own numbers so the difference is a row, not a rumour.
--
-- The query is asynchronous — `POST /billing/1/usage/query` returns only a
-- requestId and the answer arrives later on an HTTP callback, delivered ONCE
-- with no provider-side retry. `billing_usage_requests` is what makes that
-- correlation survive across processes and restarts; a lost callback shows up
-- as a `pending` row past its deadline rather than as silence.

CREATE TYPE "billing_usage_request_status" AS ENUM ('pending', 'succeeded', 'failed', 'expired');
--> statement-breakpoint
CREATE TYPE "recharge_source" AS ENUM ('purchase', 'promotion', 'bonus', 'adjustment', 'trial');
--> statement-breakpoint

CREATE TABLE "billing_usage_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE set null,
  "provider_request_id" text NOT NULL,
  "provider" text DEFAULT 'infobip' NOT NULL,
  "status" "billing_usage_request_status" DEFAULT 'pending' NOT NULL,
  "pass" integer DEFAULT 1 NOT NULL,
  "sent_since" date NOT NULL,
  "sent_until" date NOT NULL,
  "include_unfinalized" boolean DEFAULT true NOT NULL,
  "volume_finalized" boolean DEFAULT false NOT NULL,
  "campaign_reference" text,
  "raw_response" jsonb,
  "failure_message" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "responded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- The callback's idempotency guard: a redelivered result lands on this key and
-- is skipped before any money moves.
CREATE UNIQUE INDEX "billing_usage_requests_provider_uq"
  ON "billing_usage_requests" ("provider", "provider_request_id");
--> statement-breakpoint
-- One submission per (campaign, pass) — a retry storm cannot fire pass 1 twice.
-- NULL campaign_id (account-wide sweeps) is exempt: NULLs never collide in a
-- btree unique index, which is exactly the wanted behaviour here.
CREATE UNIQUE INDEX "billing_usage_requests_campaign_pass_uq"
  ON "billing_usage_requests" ("campaign_id", "pass");
--> statement-breakpoint
CREATE INDEX "billing_usage_requests_tenant_idx"
  ON "billing_usage_requests" ("tenant_id", "requested_at");
--> statement-breakpoint
-- Drives the callback-timeout sweeper and the finalization re-ask, both of
-- which scan by status and age.
CREATE INDEX "billing_usage_requests_status_idx"
  ON "billing_usage_requests" ("status", "requested_at");
--> statement-breakpoint

CREATE TABLE "billing_usage_lines" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "request_id" uuid NOT NULL REFERENCES "billing_usage_requests"("id") ON DELETE cascade,
  "tenant_id" uuid NOT NULL,
  "campaign_id" uuid REFERENCES "campaigns"("id") ON DELETE set null,
  "ordinal" integer NOT NULL,
  "category_code" text NOT NULL,
  "channel" "channel",
  "country_name" text,
  "country_code" text,
  "sender" text,
  "traffic_type" text,
  "usage_day" date,
  "quantity" integer DEFAULT 0 NOT NULL,
  "unit_price_micro" bigint DEFAULT 0 NOT NULL,
  "total_micro" bigint DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'EUR' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- Re-parsing a stored raw_response always yields the same ordinals, so ingest
-- can be re-run after an interruption without duplicating lines.
CREATE UNIQUE INDEX "billing_usage_lines_request_ordinal_uq"
  ON "billing_usage_lines" ("request_id", "ordinal");
--> statement-breakpoint
CREATE INDEX "billing_usage_lines_campaign_idx" ON "billing_usage_lines" ("campaign_id");
--> statement-breakpoint
CREATE INDEX "billing_usage_lines_tenant_idx" ON "billing_usage_lines" ("tenant_id", "usage_day");
--> statement-breakpoint

CREATE TABLE "credit_recharges" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE cascade,
  "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE cascade,
  "source" "recharge_source" DEFAULT 'purchase' NOT NULL,
  "amount_micro" bigint NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "payment_attempt_id" uuid REFERENCES "payment_attempts"("id") ON DELETE set null,
  "wallet_transaction_id" uuid REFERENCES "wallet_transactions"("id") ON DELETE set null,
  "consumed_micro" bigint DEFAULT 0 NOT NULL,
  "spending" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "rebuilt_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

-- One recharge per crediting ledger entry: the ledger stays the source of
-- truth, and a replayed grant cannot produce a second recharge row.
CREATE UNIQUE INDEX "credit_recharges_transaction_uq"
  ON "credit_recharges" ("wallet_transaction_id");
--> statement-breakpoint
CREATE INDEX "credit_recharges_tenant_created_idx"
  ON "credit_recharges" ("tenant_id", "created_at");
--> statement-breakpoint
-- FIFO allocation reads a wallet's recharges oldest-first.
CREATE INDEX "credit_recharges_wallet_fifo_idx"
  ON "credit_recharges" ("wallet_id", "created_at");
--> statement-breakpoint

-- Backfill: every existing positive ledger entry becomes a recharge row, so
-- the new history is complete from day one rather than starting empty beside a
-- non-zero balance. Ordering by created_at keeps FIFO meaningful for credits
-- that predate this table.
INSERT INTO "credit_recharges"
  ("tenant_id", "wallet_id", "source", "amount_micro", "currency",
   "wallet_transaction_id", "created_at", "updated_at")
SELECT
  wt."tenant_id",
  wt."wallet_id",
  (CASE wt."entry_type"
     WHEN 'purchase'  THEN 'purchase'
     WHEN 'promotion' THEN 'promotion'
     WHEN 'bonus'     THEN 'bonus'
     ELSE 'adjustment'
   END)::"recharge_source",
  wt."amount_micro",
  wt."currency",
  wt."id",
  wt."created_at",
  wt."created_at"
FROM "wallet_transactions" wt
WHERE wt."amount_micro" > 0;
