-- Real call length reconciled from the voice DLR, so the trial gate and any
-- usage reporting can stop relying on the pre-send estimate. Null until a
-- report lands. Idempotent so a hand-applied dev DB stays consistent.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "voice_seconds" integer;--> statement-breakpoint
-- The gate sums this per tenant for voice; keep that lookup off a seq scan.
CREATE INDEX IF NOT EXISTS "messages_tenant_voice_idx"
  ON "messages" ("tenant_id", "channel", "status");
