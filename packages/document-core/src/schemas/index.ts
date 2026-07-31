import { z } from 'zod';

export * from './primitives';
export * from './fontCatalog';
export { ButtonPropsSchema, type ButtonProps } from './ButtonSchema';
export { ColumnsContainerPropsSchema, type ColumnsContainerProps } from './ColumnsContainerSchema';
export { ContainerPropsSchema, type ContainerProps } from './ContainerSchema';
export { DividerPropsSchema, type DividerProps } from './DividerSchema';
export { EmailLayoutPropsSchema, type EmailLayoutProps } from './EmailLayoutSchema';
export {
  ImagePropsSchema,
  UnsplashMetadataSchema,
  type ImageProps,
  type UnsplashMetadata,
} from './ImageSchema';
export { NotionTextPropsSchema, type NotionTextProps } from './NotionTextSchema';
export {
  SocialMediaPropsSchema,
  SocialMediaItemSchema,
  type SocialMediaProps,
} from './SocialMediaSchema';
export { SpacerPropsSchema, type SpacerProps } from './SpacerSchema';

import { ButtonPropsSchema } from './ButtonSchema';
import { ColumnsContainerPropsSchema } from './ColumnsContainerSchema';
import { ContainerPropsSchema } from './ContainerSchema';
import { DividerPropsSchema } from './DividerSchema';
import { EmailLayoutPropsSchema } from './EmailLayoutSchema';
import { ImagePropsSchema } from './ImageSchema';
import { NotionTextPropsSchema } from './NotionTextSchema';
import { SocialMediaPropsSchema } from './SocialMediaSchema';
import { SpacerPropsSchema } from './SpacerSchema';

/**
 * Discriminated union of all 9 valid block types. Each entry maps
 * `type` → the corresponding PropsSchema under `data`.
 */
export const EditorBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('EmailLayout'), data: EmailLayoutPropsSchema }),
  z.object({ type: z.literal('Container'), data: ContainerPropsSchema }),
  z.object({ type: z.literal('ColumnsContainer'), data: ColumnsContainerPropsSchema }),
  z.object({ type: z.literal('Button'), data: ButtonPropsSchema }),
  z.object({ type: z.literal('Image'), data: ImagePropsSchema }),
  z.object({ type: z.literal('NotionText'), data: NotionTextPropsSchema }),
  z.object({ type: z.literal('Divider'), data: DividerPropsSchema }),
  z.object({ type: z.literal('Spacer'), data: SpacerPropsSchema }),
  z.object({ type: z.literal('SocialMedia'), data: SocialMediaPropsSchema }),
]);

export type TEditorBlock = z.infer<typeof EditorBlockSchema>;

/**
 * Schema for a full email document: a Record of blockId → TEditorBlock.
 * Used by the MCP `validate_document` tool and by the editor's
 * `validateGeneratedTemplate`.
 */
export const EditorConfigurationSchema = z.record(z.string(), EditorBlockSchema);

export type TEditorConfiguration = z.infer<typeof EditorConfigurationSchema>;

/** The 9 valid block type literals. */
export const BLOCK_TYPES = [
  'EmailLayout',
  'Container',
  'ColumnsContainer',
  'Button',
  'Image',
  'NotionText',
  'Divider',
  'Spacer',
  'SocialMedia',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
