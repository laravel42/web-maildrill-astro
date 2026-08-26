-- Lists gain a consent flag: whether the list requires or records GDPR
-- consent. The unused "description" column is dropped — the UI's free-text
-- field is "notes" (0005). Idempotent so a hand-applied dev DB stays
-- consistent.
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "gdpr_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN IF EXISTS "description";
