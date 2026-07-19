import { z } from 'zod';

import {
  BORDER_SIZE_SCHEMA,
  COLOR_SCHEMA,
  FONT_FAMILY_SCHEMA,
  PADDING_OBJECT,
  PADDING_SCHEMA,
  SHAPE_SCHEMA,
} from './primitives';

const BUTTON_PADDING_DEFAULT = { top: 12, bottom: 12, left: 24, right: 24 } as const;

const SIZE_SCHEMA = z
  .union([z.enum(['x-small', 'small', 'medium']), BORDER_SIZE_SCHEMA])
  .optional()
  .nullable();

export const ButtonPropsSchema = z
  .object({
    style: z
      .object({
        backgroundColor: COLOR_SCHEMA,
        fontSize: z.number().min(0).default(16).optional().nullable(),
        fontSizeMobile: z.number().min(0).optional().nullable(),
        fontFamily: FONT_FAMILY_SCHEMA,
        background: z.string().nullable().optional(),
        buttonBackgroundColor: COLOR_SCHEMA,
        buttonTextColor: COLOR_SCHEMA,
        fontWeight: z.enum(['bold', 'normal']).default('bold').optional().nullable(),
        textAlign: z.enum(['left', 'center', 'right']).default('center').optional().nullable(),
        textAlignMobile: z.enum(['left', 'center', 'right']).optional().nullable(),
        padding: PADDING_OBJECT.default(BUTTON_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
        shape: SHAPE_SCHEMA,
      })
      .passthrough()
      .optional()
      .nullable(),
    props: z
      .object({
        buttonBackgroundColor: COLOR_SCHEMA,
        buttonTextColor: COLOR_SCHEMA,
        fullWidth: z.boolean().optional().nullable(),
        fullWidthMobile: z.boolean().optional().nullable(),
        size: SIZE_SCHEMA,
        sizeMobile: SIZE_SCHEMA,
        sizePaddingSidesLinked: z.boolean().optional(),
        sizeMobilePaddingSidesLinked: z.boolean().optional(),
        text: z.string().optional().nullable(),
        url: z.string().optional().nullable(),
      })
      .optional()
      .nullable(),
  })
  .passthrough();

export type ButtonProps = z.infer<typeof ButtonPropsSchema>;
