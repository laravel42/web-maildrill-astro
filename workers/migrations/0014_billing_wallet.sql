-- Billing subsystem: per-workspace prepaid wallet with an immutable ledger,
-- credit reservations for in-flight sends, DB-configured credit packages /
-- commitment tiers / channel pricing, and payment-provider state (Stripe
-- first). Credits are integer micro-USD (1 USD = 1_000_000). Idempotent so a
-- hand-applied dev DB stays consistent.

DO $$ BEGIN
  CREATE TYPE "wallet_entry_type" AS ENUM ('purchase','consumption','refund','promotion','bonus','adjustment','correction');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "reservation_status" AS ENUM ('held','committed','released','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "payment_attempt_status" AS ENUM ('pending','succeeded','failed','refunded','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "payment_event_status" AS ENUM ('processed','skipped','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "pricing_tiers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "discount_bps" integer DEFAULT 0 NOT NULL,
  "min_purchase_cents" integer DEFAULT 0 NOT NULL,
  "commitment_months" integer DEFAULT 0 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pricing_tiers_code_uq" ON "pricing_tiers" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "wallets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "balance_micro" bigint DEFAULT 0 NOT NULL,
  "reserved_micro" bigint DEFAULT 0 NOT NULL,
  "version" integer DEFAULT 0 NOT NULL,
  "low_balance_micro" bigint DEFAULT 10000000 NOT NULL,
  "pricing_tier_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wallets" ADD CONSTRAINT "wallets_pricing_tier_id_pricing_tiers_id_fk"
    FOREIGN KEY ("pricing_tier_id") REFERENCES "pricing_tiers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallets_tenant_uq" ON "wallets" ("tenant_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "wallet_transactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "wallet_id" uuid NOT NULL,
  "entry_type" "wallet_entry_type" NOT NULL,
  "amount_micro" bigint NOT NULL,
  "balance_after_micro" bigint NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "channel" "channel",
  "reference_type" text,
  "reference_id" text,
  "idempotency_key" text,
  "description" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "wallet_tx_tenant_idem_uq" ON "wallet_transactions" ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_tx_tenant_created_idx" ON "wallet_transactions" ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_tx_wallet_created_idx" ON "wallet_transactions" ("wallet_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallet_tx_reference_idx" ON "wallet_transactions" ("reference_type","reference_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "credit_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "wallet_id" uuid NOT NULL,
  "status" "reservation_status" DEFAULT 'held' NOT NULL,
  "amount_micro" bigint NOT NULL,
  "remaining_micro" bigint NOT NULL,
  "reference_type" text NOT NULL,
  "reference_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_reservations" ADD CONSTRAINT "credit_reservations_wallet_id_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_reservations_ref_uq" ON "credit_reservations" ("tenant_id","reference_type","reference_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_reservations_wallet_idx" ON "credit_reservations" ("wallet_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "credit_reservations_expiry_idx" ON "credit_reservations" ("status","expires_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "credit_packages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "price_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "credits_micro" bigint NOT NULL,
  "bonus_micro" bigint DEFAULT 0 NOT NULL,
  "grants_tier_id" uuid,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "credit_packages" ADD CONSTRAINT "credit_packages_grants_tier_id_pricing_tiers_id_fk"
    FOREIGN KEY ("grants_tier_id") REFERENCES "pricing_tiers"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "credit_packages_code_uq" ON "credit_packages" ("code");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "channel_pricing" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "channel" "channel" NOT NULL,
  "region" text DEFAULT 'default' NOT NULL,
  "base_price_micro" bigint NOT NULL,
  "unit" text DEFAULT 'message' NOT NULL,
  "min_billable_units" integer DEFAULT 1 NOT NULL,
  "billing_precision" integer DEFAULT 4 NOT NULL,
  "provider_cost_micro" bigint DEFAULT 0 NOT NULL,
  "margin_bps" integer DEFAULT 0 NOT NULL,
  "volume_tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "effective_from" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "channel_pricing_channel_region_uq" ON "channel_pricing" ("channel","region");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "channel_pricing_channel_idx" ON "channel_pricing" ("channel");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "stripe_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" text DEFAULT 'stripe' NOT NULL,
  "event_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" "payment_event_status" DEFAULT 'processed' NOT NULL,
  "error" text,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "processed_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "stripe_events_event_id_uq" ON "stripe_events" ("provider","event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stripe_events_type_idx" ON "stripe_events" ("event_type");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_attempts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "wallet_id" uuid NOT NULL,
  "provider" text DEFAULT 'stripe' NOT NULL,
  "package_id" uuid,
  "package_code" text NOT NULL,
  "amount_cents" integer NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "credits_micro" bigint NOT NULL,
  "status" "payment_attempt_status" DEFAULT 'pending' NOT NULL,
  "provider_session_id" text,
  "provider_payment_intent_id" text,
  "failure_reason" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_wallet_id_wallets_id_fk"
    FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_attempts" ADD CONSTRAINT "payment_attempts_package_id_credit_packages_id_fk"
    FOREIGN KEY ("package_id") REFERENCES "credit_packages"("id") ON DELETE set null;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_attempts_session_uq" ON "payment_attempts" ("provider","provider_session_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_tenant_idx" ON "payment_attempts" ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_attempts_intent_idx" ON "payment_attempts" ("provider_payment_intent_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "payment_customers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "provider" text DEFAULT 'stripe' NOT NULL,
  "external_customer_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payment_customers" ADD CONSTRAINT "payment_customers_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_customers_tenant_provider_uq" ON "payment_customers" ("tenant_id","provider");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_customers_external_uq" ON "payment_customers" ("provider","external_customer_id");
