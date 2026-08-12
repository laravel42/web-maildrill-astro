-- A list whose membership is mostly undeliverable gets suspended rather than
-- mailed again: the bar is a share of invalid/bounced/complained members.
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "suspended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "suspended_reason" text;--> statement-breakpoint
-- List health counts members by subscriber status.
CREATE INDEX IF NOT EXISTS "list_members_list_idx" ON "list_members" ("list_id");
