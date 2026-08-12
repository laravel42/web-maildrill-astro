-- Addresses that fail validation when added or imported. Kept apart from
-- 'bounced' (which a real send proved) so the two can be reported separately.
-- ADD VALUE is allowed inside a transaction on PG 12+ as long as the new value
-- is not also used there; IF NOT EXISTS keeps a hand-applied DB consistent.
ALTER TYPE "subscriber_status" ADD VALUE IF NOT EXISTS 'invalid';
