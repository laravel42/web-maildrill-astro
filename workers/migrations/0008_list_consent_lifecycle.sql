-- Lists gain consent + lifecycle configuration: GDPR/double-opt flags and the
-- templates used for opt-in/opt-out confirmation and welcome/goodbye sends.
-- Template references are SET NULL so deleting a template downgrades the list
-- to default behavior instead of blocking. The unused "description" column is
-- dropped — the UI's free-text field is "notes" (0005). Idempotent so a
-- hand-applied dev DB stays consistent.
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "gdpr_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "double_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "double_opt_out" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "double_opt_in_template_id" uuid REFERENCES "templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "double_opt_out_template_id" uuid REFERENCES "templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "welcome_email_template_id" uuid REFERENCES "templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lists" ADD COLUMN IF NOT EXISTS "goodbye_email_template_id" uuid REFERENCES "templates"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "lists" DROP COLUMN IF EXISTS "description";
