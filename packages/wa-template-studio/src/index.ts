/**
 * wa-template-studio — public API.
 *
 * `Studio` is the full four-panel editor. The core (registries, store,
 * validation, serialization, variables) is exported so hosts can
 * register custom plugins, drive the document programmatically, or run
 * validation/serialization headlessly (server-side included).
 */

export { Studio, type StudioProps } from './app/Studio';

// Plugin system
export { registerBlock, registerButton, listBlockPlugins, listButtonPlugins } from './core/registry';
export { registerBuiltInPlugins } from './blocks';
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
  setTemplateField,
  undo,
  updateBlockData,
  updateButtonData,
  useStudio,
} from './core/store';

// Validation + serialization
export { hasErrors, issuesForBlock, issuesForSlot, validateTemplate } from './core/validation';
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
