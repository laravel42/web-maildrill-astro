import { sql } from 'drizzle-orm';
import { FAILED_DELIVERY_STATES } from '@maildrill/domain';

/**
 * The failure definition, as SQL, spelled once.
 *
 * `FAILED_DELIVERY_STATES` (@maildrill/domain) is the single source: a message
 * failed when the provider tried and it never arrived — `failed` (rejected /
 * undeliverable) or `expired` (accepted, then abandoned at TTL). `cancelled` is
 * not a failure: it is only reachable from the pre-dispatch states, so nothing
 * was ever attempted.
 *
 * Rendered from the const array rather than typed out at each counter, because
 * two hand-written lists is exactly how this product came to report 1,178
 * WhatsApp failures on Analytics and 2,354 on the campaign it belonged to.
 * Every rendered failure counter reads THIS — grep `FAILED_STATUSES` to see the
 * full set of sites, and add new ones the same way.
 *
 * `sql.raw` is safe here and only here: the values are compile-time literals
 * from a `const` array, never anything a request supplies.
 */
export const FAILED_STATUSES = sql.raw(
  `(${FAILED_DELIVERY_STATES.map((s) => `'${s}'`).join(', ')})`,
);
