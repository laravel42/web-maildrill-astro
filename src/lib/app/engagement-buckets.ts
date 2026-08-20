/**
 * The Subscribers roster's open/click rate filter vocabulary.
 *
 * Five buckets, not the four in `RATE_BUCKETS` (templates-data), and
 * deliberately a separate list. `RATE_BUCKETS` buckets a rate that has already
 * been computed — Lists, Templates and Campaigns feed it a real aggregate — and
 * it is right for that. The roster's rows are people, and for a person there is
 * a third state those four cannot express: nobody has ever sent them anything
 * on a channel that reports opens. `parseRatePercent('—') === 0` filed those
 * under "None" alongside people who were mailed and ignored it; on the 1M-row
 * workspace that is 586,499 padding 272,986.
 *
 * The slugs are the wire format (`?opens=high&opens=mid`) and match
 * `ENGAGEMENT_BUCKETS` in @maildrill/product. The boundaries themselves live in
 * SQL (`engagement_bucket()`, migration 0025) — nothing on this side recomputes
 * them for a live workspace; the local pass below exists only for fixtures.
 */
export const ENGAGEMENT_BUCKETS = [
  /**
   * `tracked_delivered = 0` — nothing has been sent to this person on a channel
   * that can report an open.
   *
   * NOT "never mailed", which is what this said. 466,476 of the 586,499 people
   * in this bucket on the perf workspace have `delivered > 0`: they were mailed,
   * on SMS or voice, which carry no engagement signal. The row shows "—" and
   * filters as this bucket, so the two agreed — the label was the only thing
   * making a claim the data does not support.
   */
  { slug: 'never', label: 'No tracked sends' },
  { slug: 'none', label: 'None' },
  { slug: 'low', label: 'Under 20%' },
  { slug: 'mid', label: '20 – 40%' },
  { slug: 'high', label: '40%+' },
] as const;

export type EngagementBucketSlug = (typeof ENGAGEMENT_BUCKETS)[number]['slug'];

export const ENGAGEMENT_BUCKET_SLUGS: readonly string[] = ENGAGEMENT_BUCKETS.map((b) => b.slug);

const LABELS = new Map(ENGAGEMENT_BUCKETS.map((b) => [b.slug as string, b.label as string]));

export function engagementBucketLabel(slug: string): string {
  return LABELS.get(slug) ?? slug;
}

/**
 * Bucket a rendered rate string ("38%", "—") the way the server buckets the
 * stored counters.
 *
 * Fixture mode only. A connected workspace filters in SQL, where the rate is
 * one indexed lookup instead of a percentage parsed back out of the ten rows
 * that happened to be fetched — which is what made this filter claim to span a
 * million subscribers while operating on ten.
 */
export function fixtureEngagementBucket(display: string): EngagementBucketSlug {
  if (!display || display === '—') return 'never';
  const n = parseFloat(display.replace('%', '').trim());
  if (!Number.isFinite(n) || n <= 0) return 'none';
  if (n < 20) return 'low';
  if (n < 40) return 'mid';
  return 'high';
}
