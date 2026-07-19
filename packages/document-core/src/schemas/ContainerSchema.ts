import { z } from 'zod';

import { COLOR_SCHEMA, PADDING_OBJECT, PADDING_SCHEMA, SHAPE_SCHEMA } from './primitives';

const CONTAINER_PADDING_DEFAULT = { top: 16, bottom: 16, left: 24, right: 24 } as const;

export const ContainerPropsSchema = z
  .object({
    style: z
      .object({
        backgroundColor: COLOR_SCHEMA,
        background: z.string().nullable().optional(),
        borderColor: COLOR_SCHEMA,
        borderRadius: z.number().optional().nullable(),
        borderTop: z.number().default(0).optional().nullable(),
        borderBottom: z.number().default(0).optional().nullable(),
        borderLeft: z.number().default(0).optional().nullable(),
        borderRight: z.number().default(0).optional().nullable(),
        borderTopMobile: z.number().optional().nullable(),
        borderBottomMobile: z.number().optional().nullable(),
        borderLeftMobile: z.number().optional().nullable(),
        borderRightMobile: z.number().optional().nullable(),
        shape: SHAPE_SCHEMA,
        padding: PADDING_OBJECT.default(CONTAINER_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
      })
      .passthrough()
      .optional()
      .nullable(),
    props: z
      .object({
        childrenIds: z.array(z.string()).optional().nullable(),
      })
      .optional()
      .nullable(),
    blockId: z.string().optional(),
    isNotClient: z.boolean().optional(),
  })
  .passthrough();

export type ContainerProps = z.infer<typeof ContainerPropsSchema>;
