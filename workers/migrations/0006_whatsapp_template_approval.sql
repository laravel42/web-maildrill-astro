-- WhatsApp template approval (Meta review, brokered by Infobip). Adds the
-- approval-status enum and the per-template WhatsApp fields. Idempotent so a
-- hand-applied dev DB stays consistent.
DO $$ BEGIN
 CREATE TYPE "public"."template_approval_status" AS ENUM('draft', 'pending', 'approved', 'rejected', 'paused', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "approval_status" "template_approval_status";--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "provider_template_id" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "components" jsonb;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "templates_provider_template_idx" ON "templates" USING btree ("provider_template_id");
