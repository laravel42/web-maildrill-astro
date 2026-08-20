/**
 * Chip catalogues and default values for the Visual Wizard.
 *
 * Values are stable English tokens sent to the backend.
 * Labels come from i18n keys (aiWizard namespace).
 */

import { FONT_FAMILY_NAMES } from '@eb/document-core';

export const PURPOSE_CHIPS = [
  'welcome',
  'receipt',
  'sale',
  'newsletter',
  'otp',
  'event',
  'reminder',
  'custom',
] as const;

export const MOOD_CHIPS = [
  'friendly',
  'premium',
  'bold',
  'minimal',
  'playful',
  'wellness',
  'corporate',
  'editorial',
] as const;

export const VERTICAL_CHIPS = [
  'saas',
  'ecommerce',
  'fintech',
  'wellness',
  'hospitality',
  'education',
  'nonprofit',
  'real-estate',
  'media',
  'food-beverage',
  'other',
] as const;

export const PALETTE_CHIPS = ['warm', 'cool', 'mono', 'pastel', 'dark', 'neutral'] as const;

export const PHOTO_STYLE_CHIPS = [
  'photographic',
  'illustrated',
  'abstract',
  'mixed',
  'none',
] as const;

export const SUBJECT_CHIPS = ['people', 'product', 'place', 'food', 'abstract'] as const;

export const SECTION_CHIPS = [
  'hero',
  'features',
  'testimonial',
  'stats',
  'cta',
  'faq',
  'footer',
] as const;

/**
 * Font-family keys available for the Theme wizard selects (body + headings).
 * Derived from the single-source FONT_FAMILY_NAMES (the catalog) and excludes
 * `INHERIT` since these are explicit user choices. Adding a font to the
 * catalog automatically surfaces it here.
 */
export const THEME_FONT_OPTIONS = FONT_FAMILY_NAMES.filter((k) => k !== 'INHERIT');

/** Default brief used as initial state. Minimal but valid after first step. */
export const BRIEF_DEFAULTS = {
  email_strategy: {
    purpose: undefined as string | undefined,
    brandName: '',
    audience: '',
    goal: '',
    rawIntent: '',
  },
  tone_strategy: {
    moods: [] as string[],
    vertical: undefined as string | undefined,
  },
  visual_strategy: {
    palette: undefined as string | undefined,
    photoStyle: undefined as string | undefined,
    brandColors: undefined as { primary?: string; secondary?: string; accent?: string } | undefined,
  },
  /**
   * Explicit theme overrides for the "Theme" generation target. All
   * fields are optional — when `undefined` the backend falls back to the
   * mood-derived defaults ("Auto").
   */
  theme_strategy: {
    fontBody: undefined as string | undefined,
    fontHeadings: undefined as string | undefined,
    borderRadius: undefined as number | undefined,
  },
  layout_strategy: {
    sections: [] as string[],
  },
  image_queries: {
    subjects: [] as string[],
    specificScene: '',
  },
};

export type DraftBrief = typeof BRIEF_DEFAULTS;
