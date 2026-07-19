import { z } from 'zod';

import { ContainerPropsSchema as BaseContainerPropsSchema } from '@eb/block-container';

export const ContainerPropsSchema = z
  .object({
    style: BaseContainerPropsSchema.shape.style,
    props: z
      .object({
        childrenIds: z.array(z.string()).optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
  })
  .passthrough();

export type ContainerProps = z.infer<typeof ContainerPropsSchema>;
