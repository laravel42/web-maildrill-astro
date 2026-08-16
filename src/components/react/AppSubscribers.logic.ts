import type { ChannelType, SubscriberStatus } from '@/types/app';
import type { RichSubscriber } from '@/lib/app/subscribers-data';

// Tag colouring lives in one shared place so subscribers and lists match.
export { tagStyle } from '@/lib/app/tag-style';

export const STATUS_LABEL: Record<SubscriberStatus, string> = {
  active: 'Active',
  unsubscribed: 'Unsubscribed',
  bounced: 'Bounced',
  complained: 'Complained',
  invalid: 'Invalid',
};
/**
 * Chip tint per status, so an active status filter reads as the status rather
 * than as the generic accent every other filter chip uses.
 *
 * Complained is the only filled chip — solid `--ink` with `--on-ink` text —
 * because it is the worst signal a sender can collect and shared a tint with
 * `invalid` too closely to tell apart. Invalid keeps the muted neutral: the
 * address is inert, not alarming. Both pairs invert with the theme.
 */
export const STATUS_CHIP_STYLE: Record<SubscriberStatus, { background: string; color: string }> = {
  active: { background: 'var(--success-bg)', color: 'var(--success-strong)' },
  unsubscribed: { background: 'var(--warning-bg)', color: 'var(--warning-strong)' },
  bounced: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  // Solid ink with inverted text: the only filled chip in the set, so a
  // complaint cannot be mistaken for the muted `invalid` beside it.
  complained: { background: 'var(--ink)', color: 'var(--on-ink)' },
  invalid: { background: 'var(--ink-tint)', color: 'var(--text3)' },
};

export const STATUS_TABS: ('all' | SubscriberStatus)[] = [
  'all',
  'active',
  'unsubscribed',
  'bounced',
  'complained',
  'invalid',
];

export { PAGE_SIZE, MAX_VISIBLE_PAGES, visiblePageNumbers } from './shared/pagination';

/* Reachable-channel logic (drives channel filter + drawer engagement). */
/**
 * Which channels this subscriber can be addressed on.
 *
 * Mirrors `addressForChannel` on the send path: email needs an email address,
 * every other channel needs a phone number. This used to be derived from the
 * letters in the subscriber's name — `/[aeiou]/` on the last two — which made
 * the channel tabs and filter sort people by spelling.
 */
export function reachOf(s: RichSubscriber) {
  const phone = Boolean(s.phone?.trim());
  return {
    email: Boolean(s.email?.trim()),
    sms: phone,
    whatsapp: phone,
    voice: phone,
  } as Record<ChannelType, boolean>;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
