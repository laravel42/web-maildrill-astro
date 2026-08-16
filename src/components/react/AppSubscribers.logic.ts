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

/**
 * Statuses a channel can actually produce, in display order.
 *
 * `status` is one global value per subscriber. Unsubscribe is a workspace-wide
 * opt-out — it applies on every channel, so it appears on all four tabs. Bounce
 * and spam complaint, by contrast, are inbox events email alone records, so
 * they only surface on the email tab. Offering "Bounced" on the SMS tab invites
 * a filter that describes something SMS never reports.
 */
const CHANNEL_STATUSES: Record<ChannelType, SubscriberStatus[]> = {
  email: ['active', 'unsubscribed', 'bounced', 'complained', 'invalid'],
  sms: ['active', 'unsubscribed', 'invalid'],
  whatsapp: ['active', 'unsubscribed', 'invalid'],
  voice: ['active', 'unsubscribed', 'invalid'],
};

export function channelStatuses(channel: ChannelType): SubscriberStatus[] {
  return CHANNEL_STATUSES[channel] ?? CHANNEL_STATUSES.email;
}

/**
 * How a status reads on one channel.
 *
 * A bounce or a spam complaint is something an inbox did; it says nothing about
 * whether the person answers their phone, so on SMS, WhatsApp and voice those
 * subscribers read as active. Unsubscribe is a global opt-out and is kept on
 * every channel. The subscriber drawer and detail page still show the stored
 * status, which is where the email-side cause belongs.
 */
export function statusForChannel(status: SubscriberStatus, channel: ChannelType): SubscriberStatus {
  return channelStatuses(channel).includes(status) ? status : 'active';
}

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
