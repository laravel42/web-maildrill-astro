import { z, ZodTypeAny } from 'zod';

import { themeJsonSchema } from '@eb/document-core';

import { FONT_FAMILY_SCHEMA } from '../../helpers/fontFamily';

const COLOR_SCHEMA = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .nullable()
  .optional();

export const EmailLayoutPropsSchema = z.object({
  backdropColor: COLOR_SCHEMA,
  borderColor: COLOR_SCHEMA,
  borderRadius: z.number().optional().nullable(),
  canvasColor: COLOR_SCHEMA,
  textColor: COLOR_SCHEMA,
  fontFamily: FONT_FAMILY_SCHEMA as ZodTypeAny,
  childrenIds: z.array(z.string()).optional().nullable(),
  /**
   * Phase 2a — per-document theme. The Reader accepts the field but does
   * not yet consume it (consumption arrives in Phase 2b). Optional so
   * legacy documents without a theme keep parsing.
   */
  theme: themeJsonSchema.optional(),
});

export type EmailLayoutProps = z.infer<typeof EmailLayoutPropsSchema>;
