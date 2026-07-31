/**
 * wa-template-studio — public API.
 *
 * `Studio` is the full four-panel editor. The core (registries, store,
 * validation, serialization, variables) is exported so hosts can
 * register custom plugins, drive the document programmatically, or run
 * validation/serialization headlessly (server-side included).
 */

export { Studio, type StudioProps } from './app/Studio';
export type { ApprovalStatus } from './app/TopBar';

// Plugin system
export { registerBlock, registerButton, listBlockPlugins, listButtonPlugins } from './core/registry';
export { registerBuiltInPlugins } from './blocks';
// Not registered by default; re-enable with registerButton(quickReplyPlugin).
export { quickReplyPlugin } from './blocks/buttons/basic';
export type {
  Availability,
  BlockInstance,
  BlockPlugin,
  ButtonInstance,
  ButtonPlugin,
  EditorProps,
  MetaButton,
  MetaComponent,
  MetaTemplate,
  PluginMeta,
  PreviewContext,
  TemplateCategory,
  TemplateDoc,
  ValidationIssue,
} from './core/types';

// Document + state
export {
  addButton,
  applyGalleryTemplate,
  changeTemplateCategory,
  emptyDoc,
  loadDraft,
  clearDraft,
  placeBlock,
  redo,
  removeBlock,
  removeButton,
  reorderButtons,
  replaceDoc,
  setCategory,
  setGalleryCatalog,
  setTemplateField,
  undo,
  updateBlockData,
  updateButtonData,
  useStudio,
} from './core/store';

// Validation + serialization
export {
  canRequestApproval,
  docHasContent,
  hasErrors,
  issuesForBlock,
  issuesForSlot,
  validateTemplate,
} from './core/validation';
export {
  fromMetaJson,
  InvalidTemplateError,
  toInternalJson,
  toMetaJson,
  toMetaJsonString,
} from './core/serialize';

// Variables
export {
  analyzeVariables,
  examplePayload,
  extractVariables,
  nextVariableNumber,
  renumberVariables,
  uniqueVariables,
} from './core/variables';

// Constraints
export { CATEGORIES, CATEGORY_CAPS, LANGUAGES, LIMITS } from './core/limits';

// Template gallery (host-provided catalog → curated presets)
export {
  galleryTemplateToDoc,
  normalizeGalleryCatalog,
  pickGalleryText,
  slugifyTemplateName,
} from './presets/gallery';
export type {
  GalleryCategory,
  GalleryTemplate,
  GalleryVariable,
  RawGalleryCatalog,
  RawGalleryCategory,
  RawGalleryTemplate,
} from './presets/gallery';
