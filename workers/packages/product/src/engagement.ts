/**
 * The roster's open/click rate filter, as a vocabulary.
 *
 * The rate itself is not stored — `subscriber_engagement` stores which of five
 * discrete buckets a subscriber falls in (see migration 0025). Equality on an
 * ordinal is what keeps `created_at` usable as the ordering suffix of the
 * bucket index; a stored rate would make every selection a range scan and force
 * a sort of the whole match set on every page.
 *
 * The slugs are the wire format. The ordinals are the storage format, and
 * `engagement_bucket()` in the database is what assigns them — nothing here
 * recomputes a boundary.
 */
export const ENGAGEMENT_BUCKETS = ['never', 'none', 'low', 'mid', 'high'] as const;

export type EngagementBucket = (typeof ENGAGEMENT_BUCKETS)[number];

/**
 * Wire slug → stored ordinal.
 *
 * `never` is its own bucket rather than part of `none` because "we have never
 * mailed this person on a channel that reports opens" and "we mailed them and
 * they never opened" are different facts that call for different action, and
 * only one of them is a bad sign. The roster's "—" collapsed the two, which on
 * the 1M-row workspace meant `None` was 586,499 people who had never been
 * mailed padding 272,986 who had.
 */
export const ENGAGEMENT_BUCKET_ORDINAL: Record<EngagementBucket, number> = {
  never: -1,
  none: 0,
  low: 1,
  mid: 2,
  high: 3,
};

export function isEngagementBucket(v: string): v is EngagementBucket {
  return (ENGAGEMENT_BUCKETS as readonly string[]).includes(v);
}

/** Ordinals for a selection, deduped and sorted so the same set always renders the same SQL. */
export function bucketOrdinals(buckets: readonly EngagementBucket[]): number[] {
  return [...new Set(buckets.map((b) => ENGAGEMENT_BUCKET_ORDINAL[b]))].sort((a, b) => a - b);
}
