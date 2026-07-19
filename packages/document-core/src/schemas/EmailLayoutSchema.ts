import { z, ZodTypeAny } from 'zod';

import { themeJsonSchema } from '../builders/themeJsonSchema';

import { COLOR_SCHEMA, FONT_FAMILY_SCHEMA } from './primitives';

export const EmailLayoutPropsSchema = z.object({
  backdropColor: COLOR_SCHEMA,
  borderColor: COLOR_SCHEMA,
  borderRadius: z.number().optional().nullable(),
  canvasColor: COLOR_SCHEMA,
  textColor: COLOR_SCHEMA,
  fontFamily: FONT_FAMILY_SCHEMA as ZodTypeAny,
  childrenIds: z.array(z.string()).optional().nullable(),
  linkGlobal: z
    .object({
      linkColor: COLOR_SCHEMA,
      underline: z.boolean(),
    })
    .optional()
    .nullable(),
  showVersion: z.boolean().optional().nullable(),
  theme: themeJsonSchema.optional(),
});

export type EmailLayoutProps = z.infer<typeof EmailLayoutPropsSchema>;
