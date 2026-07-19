import type { SubscriberStatus } from '@/types/app';

export const STATUS_OPTS: { value: SubscriberStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'unsubscribed', label: 'Unsubscribed' },
  { value: 'bounced', label: 'Bounced' },
];

// Deterministic tag chip color from a small palette (no Math.random at render).
export const TAG_TONES = [
  { bg: 'var(--accent-tint)', color: '#4f46e5' },
  { bg: '#e7f6ec', color: '#15803d' },
  { bg: '#fef3c7', color: '#b45309' },
  { bg: '#fce7f3', color: '#be185d' },
];
export const toneFor = (tag: string) => {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
};
