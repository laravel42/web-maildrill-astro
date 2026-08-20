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
  /**
   * Average open rate, whole percent — `null` when nothing was measured.
   *
   * `null`, not 0: a template never sent, and one whose channel reports no
   * opens, both have no rate. Rendering either as "0%" claims nobody engaged.
   * Read it through `templateEngagement` (template-map.ts), never directly —
   * that helper is what keeps the card, the list column and the drawer saying
   * the same thing about the same template.
   */
  avgOpen: number | null;
  /** Average click rate, whole percent — `null` when nothing was measured. */
  avgClick: number | null;
  /**
   * Raw send outcomes across campaigns that used this template. The drawer
   * needs these to tell "never sent" apart from "sent and nobody opened", and
   * to report something real on SMS and voice, which track neither.
   */
  trackedDelivered?: number;
  sent?: number;
  delivered?: number;
  failed?: number;
  /** WhatsApp Meta-approval state; null for non-WhatsApp templates. */
  approvalStatus?: TemplateApprovalStatus | null;
  /** Meta rejection reason when approvalStatus === 'rejected'. */
  rejectionReason?: string | null;
  /** True when html/text/WhatsApp components have something to submit. */
  hasContent: boolean;
};

/** Category display colour (indigo / green / coral / tan). */
export const CATEGORY_COLOR: Record<TplCategory, string> = {
  Promotional: '#4f46e5',
  Newsletter: '#059669',
  Transactional: '#ea6c3f',
};

// No seed templates — the gallery renders live workspace templates.
export const galleryTemplates: GalleryTemplate[] = [];

export const TEMPLATE_CATEGORIES: TplCategory[] = ['Newsletter', 'Promotional', 'Transactional'];

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

/** Categories still shown in the editor but not yet selectable. */
const UNAVAILABLE_TEMPLATE_CATEGORIES: Partial<Record<ChannelType, readonly string[]>> = {
  voice: ['IVR'],
};

export function unavailableTemplateCategoriesForChannel(
  channel: ChannelType
): readonly string[] | undefined {
  return UNAVAILABLE_TEMPLATE_CATEGORIES[channel];
}

export function defaultTemplateCategory(channel: ChannelType, initial?: string | null): string {
  const categories = templateCategoriesForChannel(channel);
  if (initial === 'Announcement') return 'Newsletter';
  if (initial && categories.includes(initial)) return initial;
  if (channel === 'email') return 'Newsletter';
  return categories[0];
}
/**
 * Rate filter options.
 *
 * "Not measured" is its own bucket, and has to be: it used to fall into "None"
 * along with genuine zeroes, so filtering for templates nobody opened returned
 * 148 of the workspace's 229 — almost all of them SMS and voice templates that
 * never reported an open in the first place. "None" now means what it says,
 * measured and zero.
 */
export const RATE_BUCKETS = ['Not measured', 'None', 'Under 20%', '20 – 40%', '40%+'] as const;
export type RateBucket = (typeof RATE_BUCKETS)[number];

export function rateBucket(v: number | null | undefined): RateBucket {
  if (v == null) return 'Not measured';
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
