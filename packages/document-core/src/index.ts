export { default as buildBlockComponent } from './builders/buildBlockComponent';
export { default as buildBlockConfigurationSchema } from './builders/buildBlockConfigurationSchema';
export { default as buildBlockConfigurationDictionary } from './builders/buildBlockConfigurationDictionary';

// ---------------------------------------------------------------------------
// Block schemas (Node-safe, no browser deps)
// ---------------------------------------------------------------------------
export {
  // Primitives
  COLOR_SCHEMA,
  PADDING_OBJECT,
  PADDING_SCHEMA,
  FONT_FAMILY_NAMES,
  FONT_FAMILY_SCHEMA,
  FONT_CATALOG,
  ALL_GOOGLE_FONTS_HREF,
  buildGoogleFontsHref,
  collectDocumentFonts,
  BORDER_RADIUS_SCHEMA,
  SHAPE_SCHEMA,
  BORDER_SIZE_SCHEMA,
  // Block schemas
  ButtonPropsSchema,
  ColumnsContainerPropsSchema,
  ContainerPropsSchema,
  DividerPropsSchema,
  EmailLayoutPropsSchema,
  ImagePropsSchema,
  UnsplashMetadataSchema,
  NotionTextPropsSchema,
  SocialMediaPropsSchema,
  SocialMediaItemSchema,
  SpacerPropsSchema,
  // Composite schemas
  EditorBlockSchema,
  EditorConfigurationSchema,
  BLOCK_TYPES,
} from './schemas';

export type {
  ButtonProps,
  ColumnsContainerProps,
  ContainerProps,
  DividerProps,
  EmailLayoutProps,
  ImageProps,
  UnsplashMetadata,
  NotionTextProps,
  SocialMediaProps,
  SpacerProps,
  TEditorBlock,
  TEditorConfiguration,
  BlockType,
  FontFamilyKey,
  FontCatalogEntry,
} from './schemas';

// ---------------------------------------------------------------------------
// Validation (Node-safe, no browser deps)
// ---------------------------------------------------------------------------
export { validateDocument, extractAllChildIds, isValidationFailure } from './validation';

export type { ValidationResult, ValidationSuccess, ValidationFailure } from './validation';

export type {
  BlockConfiguration,
  BaseZodDictionary,
  BlockEditorComponentProps,
  DocumentBlocksDictionary,
} from './utils';

export { themeJsonSchema } from './builders/themeJsonSchema';
export type { ThemeJson, BlockThemeOverride, ResponsiveValue } from './builders/themeJsonSchema';

export {
  themeBundleSchema,
  themeBundlePayloadSchema,
  themeBundleGlobalsSchema,
  themeBundleIdSchema,
  THEME_BUNDLE_GLOBAL_KEYS,
  extractThemeBundlePayload,
  applyThemeBundle,
} from './builders/themeBundleSchema';
export type {
  ThemeBundle,
  ThemeBundlePayload,
  ThemeBundleGlobals,
} from './builders/themeBundleSchema';

export { resolveBlockProp, pickResponsive } from './builders/resolveBlockProp';
export type { Viewport, BlockSection, ResolvableBlock } from './builders/resolveBlockProp';

export { resolveBlockData } from './builders/resolveBlockData';
export type { BlockSchemaDefaults } from './builders/resolveBlockData';

export { extractEditedFields, getSchemaDefaults } from './builders/extractEditedFields';
export type { ExtractableBlock } from './builders/extractEditedFields';
