-- Lists gain inline tags and a free-text note, mirroring how subscribers carry
-- their own jsonb tags. Idempotent so a hand-applied dev DB stays consistent.
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "notes" text;
