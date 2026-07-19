/**
 * Types and display constants for the Templates gallery screen. The seed/enriched
 * template fixtures were removed — live templates come from maildrill-service
 * (mapped in template-map.ts). Only the gallery card shape and the category/rate
 * vocabulary remain here.
 */
import type { ChannelType } from '@/types/app';

export type TplCategory = 'Promotional' | 'Newsletter' | 'Transactional' | 'Announcement';

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
};

/** Category display colour (indigo / green / coral / tan). */
export const CATEGORY_COLOR: Record<TplCategory, string> = {
  Promotional: '#4f46e5',
  Newsletter: '#059669',
  Transactional: '#ea6c3f',
  Announcement: '#a1774a',
};

// No seed templates — the gallery renders live workspace templates.
export const galleryTemplates: GalleryTemplate[] = [];

export const TEMPLATE_CATEGORIES: TplCategory[] = [
  'Promotional',
  'Newsletter',
  'Transactional',
  'Announcement',
];
export const RATE_BUCKETS = ['None', 'Under 20%', '20 – 40%', '40%+'] as const;
export type RateBucket = (typeof RATE_BUCKETS)[number];

export function rateBucket(v: number): RateBucket {
  if (v === 0) return 'None';
  if (v < 20) return 'Under 20%';
  if (v < 40) return '20 – 40%';
  return '40%+';
}
