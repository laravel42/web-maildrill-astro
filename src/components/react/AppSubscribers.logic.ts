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
 * than as the generic accent every other filter chip uses. Complained takes
 * the neutral ink tint at full text weight (the worst signal a sender can
 * collect); invalid takes the same tint muted, because the address is inert
 * rather than alarming. Both tokens invert with the theme.
 */
export const STATUS_CHIP_STYLE: Record<SubscriberStatus, { background: string; color: string }> = {
  active: { background: 'var(--success-bg)', color: 'var(--success-strong)' },
  unsubscribed: { background: 'var(--warning-bg)', color: 'var(--warning-strong)' },
  bounced: { background: 'var(--danger-bg)', color: 'var(--danger)' },
  complained: { background: 'var(--ink-tint)', color: 'var(--ink)' },
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

export const PAGE_SIZE = 15;

export { MAX_VISIBLE_PAGES, visiblePageNumbers } from './shared/pagination';

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
