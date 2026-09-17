-- Per-workspace AWS SES Tenant name (SES Multi-Tenant Management), used to
-- tag outbound campaign email so each workspace gets its own reputation and
-- sending-status tracking inside the one shared SES account. Mirrors
-- infobip_entity_id / infobip_entity_provisioned_at exactly: the name is
-- written unconditionally at workspace creation, but sending only tags a
-- message with it once ses_tenant_provisioned_at confirms SES acknowledged
-- the tenant (see packages/identity/src/ses-tenant.ts).
--
-- Idempotent so a hand-applied dev DB stays consistent.
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ses_tenant_name" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_ses_tenant_name_unique" UNIQUE ("ses_tenant_name");
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ses_tenant_provisioned_at" timestamptz;
