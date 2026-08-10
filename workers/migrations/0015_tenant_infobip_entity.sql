-- Per-workspace Infobip CPaaS X entity id, used to tag outbound traffic for
-- usage/billing reporting inside the one shared Infobip account. Idempotent so
-- a hand-applied dev DB stays consistent.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "infobip_entity_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_infobip_entity_id_unique" UNIQUE ("infobip_entity_id");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;
