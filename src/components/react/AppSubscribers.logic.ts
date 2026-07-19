import type { ChannelType, SubscriberStatus } from '@/types/app';
import type { RichSubscriber } from '@/lib/app/subscribers-data';

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

/* Deterministic tag styling (known map + hashed palette for custom tags). */
const TAG_MAP: Record<string, [string, string]> = {
  vip: ['var(--accent)', 'var(--accent-tint)'],
  customer: ['#15803d', '#e7f6ec'],
  lead: ['#b45309', '#fef3c7'],
  trial: ['#78756c', '#f1f0eb'],
  'churn risk': ['#b45309', '#fef3c7'],
  bounced: ['#dc2626', '#fee2e2'],
};
const TAG_PALETTE: [string, string][] = [
  ['#4f46e5', 'var(--accent-tint)'],
  ['#0d9488', '#d5f2ee'],
  ['#7c3aed', '#efe7fd'],
  ['#b45309', '#fef3c7'],
  ['#2563eb', '#e0ecff'],
];
export function tagStyle(name: string): { color: string; background: string } {
  const known = TAG_MAP[name.toLowerCase()];
  if (known) return { color: known[0], background: known[1] };
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const [color, background] = TAG_PALETTE[h % TAG_PALETTE.length];
  return { color, background };
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
