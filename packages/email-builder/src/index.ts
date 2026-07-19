export type { TReaderBlock, TReaderDocument, TReaderBlockProps, TReaderProps } from './Reader/core';

export {
  ReaderBlockSchema,
  ReaderDocumentSchema,
  ReaderBlock,
  READER_SCHEMA_DEFAULTS_BY_TYPE,
  default as Reader,
} from './Reader/core';

export { initDummyAIEvents, useDummyAIEvents } from './helpers/ai-dummy-events';
export type { AIAction } from './helpers/ai-dummy-events';

// ---------------------------------------------------------------------------
// Shared rendering primitives (Node-safe, store-free). Consumed by the block
// packages and by the Node-safe HTML renderer so neither imports the editor
// app (`email-builder-standalone`).
// ---------------------------------------------------------------------------
export { MAX_WIDTH_DESKTOP, MAX_WIDTH_MOBILE } from './constants';

export { ViewportContext, ViewportProvider, useViewport } from './Reader/viewport';
export type { Viewport } from './Reader/viewport';

export {
  RootDataContext,
  RootDataProvider,
  useRootData,
  DisableEditionContext,
  DisableEditionProvider,
  useDisableEdition,
  ImageUploadingContext,
  ImageUploadingProvider,
  useImageUploading,
  ImageAutoWidthContext,
  ImageAutoWidthProvider,
  useImageAutoWidth,
} from './Reader/renderContext';
export type { ImageUploadingState, ImageAutoWidthFn } from './Reader/renderContext';

export {
  FONT_FAMILIES,
  DEFAULT_FONT,
  FONT_FAMILY_SCHEMA,
  FONT_FAMILY_NAMES,
  FONT_CATALOG,
  ALL_GOOGLE_FONTS_HREF,
  buildGoogleFontsHref,
  collectDocumentFonts,
  getFontFamily,
  useFontFamily,
} from './helpers/fontFamily';
export type { FontFamilyName } from './helpers/fontFamily';

export { default as Wrapper } from './blocks/helpers/Wrapper';
export { getCleanURL } from './helpers/formatting';
export { shortCssId } from './helpers/utils';

// ---------------------------------------------------------------------------
// HTML export helpers (Node-safe). `cleanDocument` emits the per-block CSS
// (`!important` base + `@media` mobile) that accompanies the inline styles
// from `Reader`; `globalsStyles` is the static `<head>` reset.
// ---------------------------------------------------------------------------
export { default as cleanDocument } from './render/cleanDocument';
export { globalsStyles } from './render/globalsStyles';
export { renderEmailHtml } from './render/renderEmailHtml';
export type { RenderEmailHtmlOptions } from './render/renderEmailHtml';
