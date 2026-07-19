import { z } from 'zod';
export const PADDING_SCHEMA = z
  .object({
    top: z.number(),
    bottom: z.number(),
    right: z.number(),
    left: z.number(),
  })
  .optional()
  .nullable();

export const getPadding = (padding: z.infer<typeof PADDING_SCHEMA>) => {
  if (!padding) {
    return {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    };
  }
  return {
    top: padding?.top ?? 0,
    right: padding?.right ?? 0,
    bottom: padding?.bottom ?? 0,
    left: padding?.left ?? 0,
  };
};
