import { z } from 'zod';

import { PADDING_OBJECT, PADDING_SCHEMA } from './primitives';

const FIXED_WIDTHS_SCHEMA = z
  .tuple([z.number().nullish(), z.number().nullish(), z.number().nullish()])
  .optional()
  .nullable();

const COLUMNS_CONTAINER_PADDING_DEFAULT = { top: 0, bottom: 0, left: 0, right: 0 } as const;

export const ColumnsContainerPropsSchema = z
  .object({
    style: z
      .object({
        background: z.string().nullable().optional(),
        backgroundColor: z.string().nullable().optional(),
        padding: PADDING_OBJECT.default(COLUMNS_CONTAINER_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
      })
      .passthrough()
      .optional()
      .nullable(),
    props: z
      .object({
        fixedWidths: FIXED_WIDTHS_SCHEMA,
        columnsCount: z
          .union([z.literal(2), z.literal(3)])
          .optional()
          .nullable(),
        layout: z.string().optional().nullable(),
        /** Space between adjacent columns, in px. Split across their facing edges. */
        columnsGap: z.number().min(0).optional().nullable(),
        contentAlignment: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
        contentAlignmentMobile: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
        stackColumnsOnMobile: z.boolean().optional().nullable(),
        columns: z.tuple([
          z.object({ childrenIds: z.array(z.string()) }),
          z.object({ childrenIds: z.array(z.string()) }),
          z.object({ childrenIds: z.array(z.string()) }),
        ]),
      })
      .optional()
      .nullable(),
    blockId: z.string().optional(),
    isNotClient: z.boolean().optional(),
  })
  .passthrough();

export type ColumnsContainerProps = z.infer<typeof ColumnsContainerPropsSchema>;
