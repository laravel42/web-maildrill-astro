import { z } from 'zod';

import { COLOR_SCHEMA, FONT_FAMILY_SCHEMA, PADDING_OBJECT, PADDING_SCHEMA } from './primitives';

const NOTION_TEXT_PADDING_DEFAULT = { top: 16, bottom: 16, left: 24, right: 24 } as const;

export const NotionTextPropsSchema = z.object({
  style: z
    .object({
      color: COLOR_SCHEMA,
      backgroundColor: COLOR_SCHEMA,
      fontSize: z.number().gte(0).default(16).optional().nullable(),
      fontSizeMobile: z.number().gte(0).optional().nullable(),
      fontFamily: FONT_FAMILY_SCHEMA,
      fontWeight: z.enum(['bold', 'normal']).default('normal').optional().nullable(),
      lineHeight: z.string().optional().nullable(),
      textAlign: z.enum(['left', 'center', 'right', 'justify']).optional().nullable(),
      padding: PADDING_OBJECT.default(NOTION_TEXT_PADDING_DEFAULT).optional().nullable(),
      mobilePadding: PADDING_SCHEMA,
      borderColor: COLOR_SCHEMA,
      borderTop: z.string().optional().nullable(),
      borderBottom: z.string().optional().nullable(),
      borderLeft: z.string().optional().nullable(),
      borderRight: z.string().optional().nullable(),
    })
    .passthrough()
    .optional()
    .nullable(),
  props: z
    .object({
      html: z.string(),
    })
    .optional()
    .nullable()
    .default({ html: '<p>Double click to edit...</p>' }),
});

export type NotionTextProps = z.infer<typeof NotionTextPropsSchema>;
