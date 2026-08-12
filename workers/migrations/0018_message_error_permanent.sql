-- Hard-vs-soft bounce: Infobip reports `error.permanent`, which is what tells a
-- dead mailbox (suppress it) from a full one (retry later). Null when unknown.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "last_error_permanent" boolean;--> statement-breakpoint
-- Deliverability rates are read per tenant+channel over a recent window.
CREATE INDEX IF NOT EXISTS "messages_tenant_channel_created_idx"
  ON "messages" ("tenant_id", "channel", "created_at");
