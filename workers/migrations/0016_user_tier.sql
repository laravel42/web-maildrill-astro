-- Commercial lifecycle label per user: 'trial' → 'payg' on a top-up, or a
-- pricing_tiers.code once a commitment plan is bought. Idempotent so a
-- hand-applied dev DB stays consistent.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'trial' NOT NULL;--> statement-breakpoint

-- Backfill: members of a workspace already on a commitment tier take its code.
UPDATE "users" u
SET "tier" = pt."code"
FROM "memberships" m
JOIN "wallets" w ON w."tenant_id" = m."tenant_id"
JOIN "pricing_tiers" pt ON pt."id" = w."pricing_tier_id"
WHERE m."user_id" = u."id" AND u."tier" = 'trial';--> statement-breakpoint

-- Members of a workspace with no tier but a completed purchase are pay-as-you-go.
UPDATE "users" u
SET "tier" = 'payg'
FROM "memberships" m
JOIN "wallets" w ON w."tenant_id" = m."tenant_id"
WHERE m."user_id" = u."id"
  AND u."tier" = 'trial'
  AND w."pricing_tier_id" IS NULL
  AND EXISTS (
    SELECT 1 FROM "wallet_transactions" wt
    WHERE wt."wallet_id" = w."id" AND wt."entry_type" = 'purchase'
  );
