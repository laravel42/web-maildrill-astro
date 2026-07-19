import { z } from 'zod';

import { COLOR_SCHEMA } from './primitives';

export const SpacerPropsSchema = z.object({
  style: z
    .object({
      height: z.number().optional().nullable().default(16),
      heightMobile: z.number().optional().nullable(),
      background: z.string().nullable().optional(),
      backgroundColor: COLOR_SCHEMA,
    })
    .optional()
    .nullable(),
});

export type SpacerProps = z.infer<typeof SpacerPropsSchema>;
