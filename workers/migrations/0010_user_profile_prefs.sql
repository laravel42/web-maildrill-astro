ALTER TABLE "users" ADD COLUMN "preferences" jsonb DEFAULT '{}'::jsonb NOT NULL;-->statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessions_revoked_at" timestamp with time zone;
