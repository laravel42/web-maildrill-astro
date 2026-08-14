-- Pending list confirmations for double opt-in and double opt-out flows.
-- A row is created when a subscriber tries to join/leave a list that requires
-- confirmation; it is consumed (deleted) when the subscriber clicks the link.
CREATE TABLE IF NOT EXISTS "pending_list_confirmations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "list_id" uuid NOT NULL REFERENCES "lists"("id") ON DELETE CASCADE,
  "subscriber_id" uuid NOT NULL REFERENCES "subscribers"("id") ON DELETE CASCADE,
  "action" text NOT NULL CHECK ("action" IN ('subscribe', 'unsubscribe')),
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_list_conf_tenant_idx" ON "pending_list_confirmations" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pending_list_conf_expires_idx" ON "pending_list_confirmations" ("expires_at");
