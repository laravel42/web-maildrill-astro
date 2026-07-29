import type { ChannelType, SubscriberStatus } from '@/types/app';
import type { RichSubscriber } from '@/lib/app/subscribers-data';

// Tag colouring lives in one shared place so subscribers and lists match.
export { tagStyle } from '@/lib/app/tag-style';

export const STATUS_LABEL: Record<SubscriberStatus, string> = {
  active: 'Active',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
};
export const STATUS_TABS: ('all' | SubscriberStatus)[] = [
  'all',
  'active',
  'unsubscribed',
  'bounced',
];

export const PAGE_SIZE = 8;

/** Max numbered buttons shown in the table pager (prev/next are separate). */
export const MAX_VISIBLE_PAGES = 5;

/** Sliding window of page numbers centered on `current`, capped at `max`. */
export function visiblePageNumbers(
  current: number,
  total: number,
  max: number = MAX_VISIBLE_PAGES,
): number[] {
  if (total <= 0) return [];
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const half = Math.floor(max / 2);
  let start = Math.max(1, current - half);
  let end = start + max - 1;
  if (end > total) {
    end = total;
    start = end - max + 1;
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * Drawer lists line: the two most recent memberships, with `+n` for the rest.
 * Expects `names` newest-first (API orders by list_members.added_at desc).
 */
export function recentListsSummary(
  names: string[],
  keep = 2,
): { shown: string[]; more: number; rest: string[] } {
  if (names.length <= keep) {
    return { shown: names, more: 0, rest: [] };
  }
  return {
    shown: names.slice(0, keep),
    more: names.length - keep,
    rest: names.slice(keep),
  };
}

/* Reachable-channel logic (drives channel filter + drawer engagement). */
export function reachOf(s: RichSubscriber) {
  const eng = s.status === 'active';
  const tail = s.name
    .replace(/[^a-z]/gi, '')
    .slice(-2)
    .toLowerCase();
  const sms = eng && /[aeiou]/.test(tail);
  return { email: true, sms, whatsapp: eng && !sms, voice: eng && sms } as Record<
    ChannelType,
    boolean
  >;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
