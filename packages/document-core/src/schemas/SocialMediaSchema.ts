import { z } from 'zod';

import { COLOR_SCHEMA, FONT_FAMILY_SCHEMA, PADDING_OBJECT, PADDING_SCHEMA } from './primitives';

const SOCIAL_MEDIA_PADDING_DEFAULT = { top: 16, bottom: 16, left: 24, right: 24 } as const;

export const SocialMediaItemSchema = z.object({
  id: z.string(),
  key: z.string(),
  label: z.string(),
  iconName: z.string(),
  theme: z.string(),
  size: z.string(),
  sizePx: z.string(),
  url: z.string(),
  href: z.string().optional().nullable(),
});

export const SocialMediaPropsSchema = z
  .object({
    style: z
      .object({
        color: COLOR_SCHEMA,
        backgroundColor: COLOR_SCHEMA,
        background: z.string().nullable().optional(),
        fontSize: z.number().gte(0).optional().nullable(),
        fontFamily: FONT_FAMILY_SCHEMA,
        fontWeight: z.enum(['bold', 'normal']).optional().nullable(),
        textAlign: z.enum(['left', 'center', 'right']).optional().nullable(),
        textAlignMobile: z.enum(['left', 'center', 'right']).optional().nullable(),
        padding: PADDING_OBJECT.default(SOCIAL_MEDIA_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
        optionSize: z.enum(['small', 'medium', 'large']).optional().nullable(),
        theme: z.enum(['light', 'dark', 'colored']).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    gap: z.number().optional(),
    items: z.array(SocialMediaItemSchema),
    gapMobile: z.number().optional(),
  })
  .passthrough();

export type SocialMediaProps = z.infer<typeof SocialMediaPropsSchema>;
