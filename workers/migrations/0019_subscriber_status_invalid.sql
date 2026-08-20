-- Addresses that fail validation when added or imported. Kept apart from
-- 'bounced' (which a real send proved) so the two can be reported separately.
--
-- WHY THIS RECREATES THE TYPE INSTEAD OF `ALTER TYPE ... ADD VALUE`
--
-- The original version of this migration used ADD VALUE, on the reasoning that
-- PG 12+ permits it inside a transaction "as long as the new value is not also
-- used there". That held until 0028 built a partial index whose predicate names
-- 'invalid'. Drizzle runs every pending migration in ONE transaction, so on any
-- database that had not yet reached 0019, both statements landed together and
-- Postgres refused:
--
--   55P04  unsafe use of new value "invalid" of enum type subscriber_status
--   HINT   New enum values must be committed before they can be used.
--
-- It passed locally and failed on deploy for a reason that looks like luck but
-- isn't: the restriction is lifted when the enum type was created in the same
-- transaction. Running every migration from scratch creates the type in 0001
-- and is therefore safe; a server that already had 0001-0018 committed from an
-- earlier deploy is not.
--
-- Recreating the type sidesteps the rule entirely — a type created in this
-- transaction has immediately usable values — and leaves exactly the same
-- schema, so databases that already applied the ADD VALUE form are unaffected
-- (this file will not run again for them).
--
-- `subscribers.status` is the only column of this type; verified against the
-- catalog before writing this.

ALTER TABLE "subscribers" ALTER COLUMN "status" DROP DEFAULT;
--> statement-breakpoint
ALTER TYPE "subscriber_status" RENAME TO "subscriber_status__old";
--> statement-breakpoint
CREATE TYPE "subscriber_status" AS ENUM (
  'active',
  'unsubscribed',
  'bounced',
  'complained',
  'invalid'
);
--> statement-breakpoint
ALTER TABLE "subscribers"
  ALTER COLUMN "status" TYPE "subscriber_status"
  USING "status"::text::"subscriber_status";
--> statement-breakpoint
ALTER TABLE "subscribers" ALTER COLUMN "status" SET DEFAULT 'active';
--> statement-breakpoint
DROP TYPE "subscriber_status__old";
