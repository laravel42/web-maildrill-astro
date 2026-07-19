import { z } from 'zod';

import { COLOR_SCHEMA, PADDING_OBJECT, PADDING_SCHEMA } from './primitives';

const DIVIDER_PADDING_DEFAULT = { top: 16, bottom: 16, left: 0, right: 0 } as const;

export const DividerPropsSchema = z
  .object({
    style: z
      .object({
        background: z.string().nullable().optional(),
        backgroundColor: COLOR_SCHEMA,
        padding: PADDING_OBJECT.default(DIVIDER_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
        height: z.number().default(1).optional().nullable(),
        heightMobile: z.number().optional().nullable(),
        color: z.string().default('#333333').optional().nullable(),
        width: z.number().default(100).optional().nullable(),
        widthMobile: z.number().optional().nullable(),
        textAlign: z.string().default('left').optional().nullable(),
        textAlignMobile: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export type DividerProps = z.infer<typeof DividerPropsSchema>;
