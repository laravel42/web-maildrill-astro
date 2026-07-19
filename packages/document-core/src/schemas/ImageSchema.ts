import { z } from 'zod';

import { BORDER_RADIUS_SCHEMA, COLOR_SCHEMA, PADDING_OBJECT, PADDING_SCHEMA } from './primitives';

export const UnsplashMetadataSchema = z
  .object({
    photoId: z.string().min(1),
    photographerName: z.string().min(1),
    photographerProfileUrl: z.string().url(),
    unsplashUrl: z.string().url(),
    downloadLocation: z.string().url(),
  })
  .optional()
  .nullable();

export type UnsplashMetadata = z.infer<typeof UnsplashMetadataSchema>;

const IMAGE_PADDING_DEFAULT = { top: 0, bottom: 0, left: 0, right: 0 } as const;

export const ImagePropsSchema = z
  .object({
    style: z
      .object({
        padding: PADDING_OBJECT.default(IMAGE_PADDING_DEFAULT).optional().nullable(),
        mobilePadding: PADDING_SCHEMA,
        background: z.string().nullable().optional(),
        backgroundColor: COLOR_SCHEMA,
        textAlign: z.enum(['center', 'left', 'right']).default('center').optional().nullable(),
        textAlignMobile: z.enum(['center', 'left', 'right']).optional().nullable(),
        shape: z
          .union([z.enum(['rectangle', 'pill']), BORDER_RADIUS_SCHEMA])
          .optional()
          .nullable(),
        height: z.number().optional().nullable(),
        heightMobile: z.number().optional().nullable(),
        objectFit: z.enum(['cover', 'contain', 'fill']).optional().nullable(),
        objectFitMobile: z.enum(['cover', 'contain', 'fill']).optional().nullable(),
        objectPosition: z.string().optional().nullable(),
        objectPositionMobile: z.string().optional().nullable(),
      })
      .passthrough()
      .optional()
      .nullable(),
    props: z
      .object({
        touched: z.boolean().optional().nullable(),
        scale: z.number().optional().nullable(),
        size: z.string().optional().nullable(),
        sizeMobile: z.string().optional().nullable(),
        width: z.number().optional().nullable(),
        widthMobile: z.number().optional().nullable(),
        scaleMobile: z.number().optional().nullable(),
        touchedMobile: z.boolean().optional().nullable(),
        original_width: z.number().optional().nullable(),
        height: z.number().optional().nullable(),
        url: z.string().optional().nullable(),
        alt: z.string().optional().nullable(),
        linkHref: z.string().optional().nullable(),
        contentAlignment: z.enum(['top', 'middle', 'bottom']).optional().nullable(),
        _unsplash: UnsplashMetadataSchema,
      })
      .optional()
      .nullable(),
  })
  .passthrough();

export type ImageProps = z.infer<typeof ImagePropsSchema>;
