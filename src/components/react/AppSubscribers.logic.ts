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

/**
 * The inverse: which stored statuses read as `shown` on this channel.
 *
 * The server filters on the stored value, so selecting "Active" on the SMS tab
 * has to ask for active, bounced AND complained — the three that `statusForChannel`
 * folds together there. Sending just `status=active` made the menu and the
 * footer disagree by the 30,007 people whose only mark against them is
 * something an inbox did.
 */
export function storedStatusesFor(
  shown: SubscriberStatus,
  channel: ChannelType,
): SubscriberStatus[] {
  return CHANNEL_STATUSES.email.filter((st) => statusForChannel(st, channel) === shown);
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

/**
 * The roster's filter set as query parameters — the ONE place the island turns
 * its filter state into a request.
 *
 * The page query, the counts query and the CSV export all take their filters
 * from here. They did not: the export fetched `subscribers?limit=200&offset=…`
 * with no filters at all, so "Export" under a segment chip reading 333,533
 * silently wrote out the first 10,000 rows of the whole roster and toasted
 * "Exported 10,000 subscribers". A filter that some consumers apply is worse
 * than one nobody does, because only the one that skips it looks like it worked.
 */
export function rosterFilterParams(f: {
  channel: ChannelType;
  query: string;
  statuses: Iterable<SubscriberStatus>;
  listIds: Iterable<string>;
  tags: Iterable<string>;
  segmentIds: Iterable<string>;
  opens?: Iterable<string>;
  clicks?: Iterable<string>;
}): URLSearchParams {
  const qs = new URLSearchParams({ channel: f.channel });
  if (f.query.trim()) qs.set('q', f.query.trim());
  // Expanded to the stored statuses each menu row stands for on this channel:
  // on SMS "Active" means active + bounced + complained, because that is what
  // the menu counted and what the tab shows.
  const wire = new Set<SubscriberStatus>();
  for (const st of f.statuses) for (const w of storedStatusesFor(st, f.channel)) wire.add(w);
  for (const st of wire) qs.append('status', st);
  for (const id of f.listIds) qs.append('listId', id);
  for (const t of f.tags) qs.append('tag', t);
  for (const id of f.segmentIds) qs.append('segmentId', id);
  for (const b of f.opens ?? []) qs.append('opens', b);
  for (const b of f.clicks ?? []) qs.append('clicks', b);
  return qs;
}
