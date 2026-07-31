/**
 * Types and display constants for the Templates gallery screen. The seed/enriched
 * template fixtures were removed — live templates come from workers
 * (mapped in template-map.ts). Only the gallery card shape and the category/rate
 * vocabulary remain here.
 */
import type { ChannelType, TemplateApprovalStatus } from '@/types/app';

export type TplCategory = 'Promotional' | 'Newsletter' | 'Transactional';

export type GalleryTemplate = {
  id: string;
  name: string;
  /** Big heading text shown inside the faux-email thumbnail. */
  title: string;
  /** Small all-caps eyebrow inside the thumbnail. */
  kicker: string;
  /** Fake call-to-action pill label. */
  cta: string;
  category: TplCategory;
  channel: ChannelType;
  /** Display string, e.g. "1d ago". */
  updated: string;
  /** Precomputed minutes-ago, for deterministic sorting. */
  updatedMin: number;
  /** Creation date display, e.g. "Jul 12, 2026" (absent on fixture data). */
  createdOn?: string;
  /** CSS background for the thumbnail header band (gradient or solid). */
  thumb: string;
  /** Foreground text colour used on top of `thumb`. */
  fg: string;
  /** CTA pill background colour. */
  accent: string;
  favorite: boolean;
  /** Average open rate, whole percent. */
  avgOpen: number;
  /** Average click rate, whole percent. */
  avgClick: number;
  /** WhatsApp Meta-approval state; null for non-WhatsApp templates. */
  approvalStatus?: TemplateApprovalStatus | null;
  /** Meta rejection reason when approvalStatus === 'rejected'. */
  rejectionReason?: string | null;
};

/** Category display colour (indigo / green / coral / tan). */
export const CATEGORY_COLOR: Record<TplCategory, string> = {
  Promotional: '#4f46e5',
  Newsletter: '#059669',
  Transactional: '#ea6c3f',
};

// No seed templates — the gallery renders live workspace templates.
export const galleryTemplates: GalleryTemplate[] = [];

export const TEMPLATE_CATEGORIES: TplCategory[] = [
  'Newsletter',
  'Promotional',
  'Transactional',
];

/** SMS template categories shown in the editor header. */
export const SMS_TEMPLATE_CATEGORIES = ['Transactional', 'Promotional', 'Standard'] as const;
export type SmsTplCategory = (typeof SMS_TEMPLATE_CATEGORIES)[number];

/** Voice script template categories shown in the editor header. */
export const VOICE_TEMPLATE_CATEGORIES = ['Marketing', 'Customer Service', 'IVR'] as const;
export type VoiceTplCategory = (typeof VOICE_TEMPLATE_CATEGORIES)[number];

export function templateCategoriesForChannel(channel: ChannelType): readonly string[] {
  if (channel === 'sms') return SMS_TEMPLATE_CATEGORIES;
  if (channel === 'voice') return VOICE_TEMPLATE_CATEGORIES;
  return TEMPLATE_CATEGORIES;
}

export function defaultTemplateCategory(
  channel: ChannelType,
  initial?: string | null,
): string {
  const categories = templateCategoriesForChannel(channel);
  if (initial === 'Announcement') return 'Newsletter';
  if (initial && categories.includes(initial)) return initial;
  if (channel === 'email') return 'Newsletter';
  return categories[0];
}
export const RATE_BUCKETS = ['None', 'Under 20%', '20 – 40%', '40%+'] as const;
export type RateBucket = (typeof RATE_BUCKETS)[number];

export function rateBucket(v: number): RateBucket {
  if (v === 0) return 'None';
  if (v < 20) return 'Under 20%';
  if (v < 40) return '20 – 40%';
  return '40%+';
}

/** Parse a display rate like "58.2%" or "—" into a whole percent for bucketing. */
export function parseRatePercent(s: string): number {
  if (!s || s === '—') return 0;
  const n = parseFloat(s.replace('%', '').trim());
  return Number.isFinite(n) ? n : 0;
}
