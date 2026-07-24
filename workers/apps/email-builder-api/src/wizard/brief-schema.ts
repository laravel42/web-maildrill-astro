import { z } from 'zod';

export const PurposeEnum = z.enum(['welcome', 'receipt', 'sale', 'newsletter', 'otp', 'event', 'reminder', 'custom']);

export const VerticalEnum = z.enum([
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
]);

export const PaletteEnum = z.enum(['warm', 'cool', 'mono', 'pastel', 'dark', 'neutral']);

export const PhotoStyleEnum = z.enum(['photographic', 'illustrated', 'abstract', 'mixed', 'none']);

export const SectionEnum = z.enum(['hero', 'features', 'testimonial', 'stats', 'cta', 'faq', 'footer']);

export const VisualBriefSchema = z.object({
  email_strategy: z.object({
    purpose: PurposeEnum,
    brandName: z.string().max(80).optional(),
    audience: z.string().max(120).optional(),
    /** Only meaningful when purpose === 'custom'. */
    goal: z.string().max(280).optional(),
    /** Pre-filled with the textarea content when switching from Direct mode. */
    rawIntent: z.string().max(800).default(''),
  }),
  tone_strategy: z.object({
    moods: z.array(z.string().min(1).max(40)).min(1).max(4),
    vertical: VerticalEnum,
  }),
  visual_strategy: z.object({
    palette: PaletteEnum,
    photoStyle: PhotoStyleEnum,
    brandColors: z
      .object({
        primary: z.string().optional(),
        secondary: z.string().optional(),
        accent: z.string().optional(),
      })
      .optional(),
  }),
  layout_strategy: z.object({
    /** Density is derived from sections.length at compile time. */
    sections: z.array(SectionEnum).min(1),
  }),
  image_queries: z.object({
    subjects: z.array(z.string().min(1).max(80)).max(7),
    orientation: z.enum(['landscape', 'portrait', 'squarish']).optional(),
    excludeSubjects: z.array(z.string().min(1).max(80)).max(5).optional(),
  }),
});

export type VisualBrief = z.infer<typeof VisualBriefSchema>;

export const RefineBriefSchema = z.object({
  changes: z.array(z.string().min(1).max(40)).min(1).max(8),
  description: z.string().min(1).max(800),
  scope: z.enum(['block', 'section', 'email']),
});

export type RefineBrief = z.infer<typeof RefineBriefSchema>;
