import type { SubscriberStatus } from '@/types/app';

export const STATUS_OPTS: { value: SubscriberStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
  { value: 'complained', label: 'Complained' },
  { value: 'invalid', label: 'Invalid' },
];

// Uniform tag chip colours (matches `@/lib/app/tag-style`).
export const toneFor = (_tag?: string) => ({
  bg: 'var(--surface2)',
  color: 'var(--text3)',
});
