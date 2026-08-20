import { and, eq, inArray } from 'drizzle-orm';
import { db, subscribers, suppressions, type Subscriber } from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { clamp } from './rules';
import { listMembersOf } from './lists';
import { evaluateSegment } from './segments';

export interface AudienceSelector {
  listId?: string;
  segmentId?: string;
  subscriberIds?: string[];
}

/** The address a channel sends to: email → email, everything else → phone. */
export function addressForChannel(sub: Subscriber, channel: Channel): string | null {
  return channel === 'email' ? sub.email : sub.phone;
}

/**
 * Resolve a selector to concrete, sendable subscribers for a channel:
 * active status, has a channel address, and not suppressed. This is the bridge
 * the product side uses before handing recipients to the messaging service.
 */
export async function resolveAudience(
  tenantId: string,
  selector: AudienceSelector,
  channel: Channel,
  opts: { limit?: number } = {},
): Promise<Subscriber[]> {
  const limit = clamp(opts.limit ?? 1000, 1, 5000);

  let candidates: Subscriber[] = [];
  if (selector.subscriberIds?.length) {
    candidates = await db
      .select()
      .from(subscribers)
      .where(
        and(eq(subscribers.tenantId, tenantId), inArray(subscribers.id, selector.subscriberIds)),
      )
      .limit(limit);
  } else if (selector.listId) {
    candidates = await listMembersOf(tenantId, selector.listId, { limit });
  } else if (selector.segmentId) {
    candidates = (await evaluateSegment(tenantId, selector.segmentId, { limit })) ?? [];
  }

  const withAddress = candidates.filter(
    (s) => s.status === 'active' && addressForChannel(s, channel),
  );
  if (withAddress.length === 0) return [];

  const suppressed = new Set(
    (
      await db
        .select({ address: suppressions.address })
        .from(suppressions)
        .where(and(eq(suppressions.tenantId, tenantId), eq(suppressions.channel, channel)))
    ).map((r) => r.address.toLowerCase()),
  );

  return withAddress.filter(
    (s) => !suppressed.has((addressForChannel(s, channel) ?? '').toLowerCase()),
  );
}
