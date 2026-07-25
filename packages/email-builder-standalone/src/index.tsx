import './global.css';

import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { I18nextProvider } from 'react-i18next';

import { ALL_GOOGLE_FONTS_HREF, type TEditorBlock, type TEditorConfiguration } from '@eb/document-core';
import type { TReaderDocument } from '@eb/email-builder';
import { CssBaseline, GlobalStyles, ThemeProvider } from '@mui/material';
import { alpha } from '@mui/material/styles';
import r2wc from '@r2wc/react-to-web-component';

import App from './App';
import DragPreview from './App/DragPreview';
import renderToStaticMarkup from './App/TemplatePanel/renderToStaticMarkup';
import {
  DEFAULT_IMAGE_PLACEHOLDER,
  editorStateStore,
  flushUndoRedo,
  resetDocument,
} from './documents/editor/EditorContext';
import { migrateDocument } from './documents/editor/migrateDocument';
import { EMAIL_CHANNEL_COLOR } from './constants';
import i18n, { normalizeLocale } from './i18n';
import getTheme from './theme';

// Detect touch capability once at module load. We deliberately choose a single
// backend statically instead of switching dynamically: the multi-backend
// transition logic flip-flops to HTML5 on the first native `dragstart` (which
// Chrome's touch emulation still fires), permanently disabling the touch
// preview after the first drag. A static choice is stable across drags.
const IS_TOUCH_DEVICE =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0));

const DND_BACKEND = IS_TOUCH_DEVICE ? TouchBackend : HTML5Backend;
const DND_BACKEND_OPTIONS = IS_TOUCH_DEVICE
  ? { enableMouseEvents: false, delayTouchStart: 150, ignoreContextMenu: true }
  : undefined;

/**
 * Inject the editor's Google Fonts stylesheet once, into the top-level
 * `document.head`. The catalog `<link>` (built from the single-source
 * FONT_CATALOG in `@eb/document-core`) loads EVERY supported web font so
 * the canvas can preview any font the user picks. We inject into
 * `document.head` rather than the shadow root because `@font-face`
 * definitions are document-scoped, not shadow-scoped — so a single link
 * in the top-level head covers both the light-DOM build and the Shadow
 * DOM standalone build. Idempotent (guards on a data attribute).
 */
function ensureEditorFontsLink(): void {
  if (typeof document === 'undefined' || !ALL_GOOGLE_FONTS_HREF) return;
  if (document.head.querySelector('link[data-eb-editor-fonts]')) return;
  const link = document.createElement('link');
  link.setAttribute('data-eb-editor-fonts', '1');
  link.rel = 'stylesheet';
  link.href = ALL_GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}

export interface AIFeatureRequest {
  text: string;
  content: string;
  action: string;
  blockId?: string;
}

export interface MergeTag {
  label?: string;
  value?: string;
  icon?: React.ReactNode;
  type?: 'divider';
}

export interface MergeTagGroup {
  label: string;
  icon?: React.ReactNode;
  children: MergeTag[];
}

/**
 * Request passed to the consumer's `onAIGenerateTemplate` callback when the
 * user triggers AI template generation from the editor UI.
 */
export interface AIGenerateTemplateRequest {
  /** Natural language description of the desired email template. */
  prompt: string;
  /**
   * Current document, included when the user runs AI generation in "Refine"
   * mode so the backend can produce a modified version of the existing
   * template. Omitted (undefined) for fresh generation.
   */
  currentDocument?: TEditorConfiguration;
  /**
   * UI locale (e.g. `"en"`, `"es"`). Hint for the LLM so the generated copy
   * is written in the same language the user is editing in.
   */
  locale?: string;
}

/**
 * Response returned by the consumer's `onAIGenerateTemplate` callback.
 *
 * The editor accepts three shapes:
 *
 * 1. `ReadableStream<string>` / `AsyncIterable<string>` — a stream of **raw SSE
 *    bytes** already decoded to strings (e.g.
 *    `res.body.pipeThrough(new TextDecoderStream())`). The stream must follow
 *    the NDJSON-per-block contract emitted by `@eb/backend`:
 *
 *    ```text
 *    data: {"id":"root","block":{...EmailLayout...}}\n\n
 *    data: {"id":"block-1","block":{...TEditorBlock...}}\n\n
 *    data: {"id":"block-2","block":{...TEditorBlock...}}\n\n
 *    ...
 *    data: [DONE]\n\n
 *    ```
 *
 *    The editor splits frames by `\n\n`, strips the `data: ` prefix, parses
 *    each JSON payload as `{ id: string; block: TEditorBlock }`, and
 *    accumulates them into a flat `Record<id, TEditorBlock>` used to render
 *    the live preview. `event: error\ndata: {...}` frames are surfaced in the
 *    preview panel without aborting the stream. The terminator `data: [DONE]`
 *    transitions the dialog state machine to `complete`.
 *
 * 2. `TEditorConfiguration` — the fully-generated template returned
 *    synchronously (no progressive preview). The editor applies it to the
 *    document when the user clicks Apply.
 *
 * See `plan-ai-template-generation.md` (section *Contrato de streaming*) for
 * the full protocol.
 */
export type AIGenerateTemplateResponse = ReadableStream<string> | AsyncIterable<string> | TEditorConfiguration;

export interface EmailBuilderProps {
  primaryColor?: string;
  secondaryColor?: string;
  galleryImages?: boolean;
  darkMode?: boolean;
  height?: string;
  stickyHeader?: boolean;
  sticky?: boolean;
  htmlTab?: boolean;
  jsonTab?: boolean;
  locale?: string;
  dataLocale?: string;
  imagePlaceholder?: string;
  /** Show URL field in the Image block picker. Defaults to `true`. */
  imageUrlInput?: boolean;
  /** Show drag & drop / file upload zone in the Image block picker. Defaults to `true`. */
  imageUploadInput?: boolean;
  /**
   * Show URL field in the Background image picker (Container,
   * ColumnsContainer, EmailLayout). Defaults to `true`.
   */
  backgroundUrlInput?: boolean;
  /** Show drag & drop / file upload zone in the Background image picker. Defaults to `true`. */
  backgroundUploadInput?: boolean;
  initialDocument?: TEditorConfiguration | string;
  data?: TEditorConfiguration | string;
  onSave?: (document: TEditorConfiguration) => void;
  onAutoSave?: (document: TEditorConfiguration) => void;
  customImageProvider?: React.ReactNode;
  mergeTags?: MergeTag[] | MergeTagGroup;
  enableAI?: boolean;
  /** Show the built-in Unsplash picker tab. Requires the backend proxy. */
  unsplashEnabled?: boolean;
  /** Overrides the default `VITE_AI_BACKEND_URL` for Unsplash proxy calls. */
  unsplashBackendUrl?: string;
  onAIRequest?: (request: AIFeatureRequest) => Promise<string>;
  /**
   * Callback invoked when the user triggers AI template generation from the
   * editor UI. Receives a prompt (plus optional `currentDocument` / `locale`)
   * and an `AbortSignal` that fires when the user clicks Cancel in the
   * generation dialog. Consumers must forward this signal to their `fetch`
   * (or equivalent) call so the upstream request is aborted and the SSE
   * reader is released.
   *
   * Must return a `Promise` resolving to either a streaming response
   * (preferred, for progressive preview) or a complete `TEditorConfiguration`.
   *
   * When the returned stream carries SSE-framed NDJSON blocks following the
   * `@eb/backend` contract, the dialog renders the template live as each
   * block arrives. See `AIGenerateTemplateResponse` for the full contract.
   *
   * When this prop is undefined the "Generate with AI" entry point is hidden
   * from the editor header.
   *
   * @example
   * ```ts
   * const handleAIGenerateTemplate = async (request, { signal }) => {
   *   const res = await fetch('/api/generate', {
   *     method: 'POST',
   *     body: JSON.stringify(request),
   *     signal,
   *   });
   *   return res.body!.pipeThrough(new TextDecoderStream());
   * };
   * ```
   */
  onAIGenerateTemplate?: (
    request: AIGenerateTemplateRequest,
    options: { signal: AbortSignal }
  ) => Promise<AIGenerateTemplateResponse>;
  showVersion?: boolean;
  componentTree?: boolean;
  portalContainer?: HTMLElement;
  /**
   * Storage backend for the Components Library Templates + Themes:
   * `'backend'` (default) uses the dev `/dev/*` HTTP API; `'local'`
   * persists to the browser `localStorage` (no backend required) and
   * restricts the drawer to the Templates + Themes tabs.
   */
  componentsStorage?: 'backend' | 'local';
  /** When false, hides the "Save as template" button. Defaults to true. */
  templateSaving?: boolean;
  /** When false, hides the Templates tab in the Components Library drawer. Defaults to true. */
  templateLibrary?: boolean;
  /** When true, shows the "Save as theme" button in the root inspector panel. Defaults to false. */
  themeSaving?: boolean;
}

export interface EmailBuilderRef {
  getDocument: () => TEditorConfiguration;
  setDocument: (document: TEditorConfiguration) => void;
  save: () => TEditorConfiguration;
  getHtml: () => string;
  setImageUrl: (blockId: string, url: string) => void;
}

const EmailBuilder = forwardRef<EmailBuilderRef, EmailBuilderProps>(
  (
    {
      primaryColor,
      secondaryColor,
      galleryImages,
      darkMode,
      height,
      stickyHeader,
      sticky,
      htmlTab,
      jsonTab,
      locale,
      dataLocale,
      imagePlaceholder,
      imageUrlInput,
      imageUploadInput,
      backgroundUrlInput,
      backgroundUploadInput,
      initialDocument,
      data,
      onSave,
      onAutoSave,
      customImageProvider,
      mergeTags,
      enableAI,
      unsplashEnabled,
      unsplashBackendUrl,
      onAIRequest,
      onAIGenerateTemplate,
      showVersion,
      componentTree = true,
      portalContainer,
      componentsStorage,
      templateSaving,
      templateLibrary,
      themeSaving,
    },
    ref
  ) => {
    // Derive values directly from props — no local state copy needed.
    // r2wc calls root.render() with fresh props on every attribute change,
    // so React will re-render automatically.
    const resolvedPrimaryColor = primaryColor || EMAIL_CHANNEL_COLOR;
    const resolvedSecondaryColor = secondaryColor || EMAIL_CHANNEL_COLOR;
    const resolvedGalleryImages = galleryImages ?? false;
    const resolvedImagePlaceholder = imagePlaceholder || DEFAULT_IMAGE_PLACEHOLDER;

    const resolvedDarkMode = darkMode ?? false;
    const resolvedStickyHeader = stickyHeader ?? true;
    const resolvedSticky = sticky ?? false;
    const resolvedHeight = height;
    const resolvedImageUrlInput = imageUrlInput ?? true;
    const resolvedImageUploadInput = imageUploadInput ?? true;
    const resolvedBackgroundUrlInput = backgroundUrlInput ?? true;
    const resolvedBackgroundUploadInput = backgroundUploadInput ?? true;

    // Expose methods through ref
    useImperativeHandle(
      ref,
      () => ({
        getDocument: () => {
          return editorStateStore.getState().document;
        },
        setDocument: (document: TEditorConfiguration) => {
          resetDocument(document);
        },
        save: () => {
          flushUndoRedo();
          const currentDocument = editorStateStore.getState().document;
          if (onSave) {
            onSave(currentDocument);
          }
          return currentDocument;
        },
        getHtml: () => {
          const currentDocument = editorStateStore.getState().document;
          const html = renderToStaticMarkup(currentDocument as TReaderDocument, { rootBlockId: 'root' });
          return html.props.children as string;
        },
        setImageUrl: (blockId: string, url: string) => {
          const event = new CustomEvent('email-builder-set-image', {
            detail: url,
          });
          window.dispatchEvent(event);

          // Also update the block directly if we have access to it
          const currentDocument = editorStateStore.getState().document;
          const prev = currentDocument[blockId];
          if (prev?.type === 'Image') {
            const updatedBlock: TEditorBlock = {
              ...prev,
              data: {
                ...prev.data,
                props: {
                  ...prev.data.props,
                  url,
                },
              },
            };
            editorStateStore.setState({
              document: {
                ...currentDocument,
                [blockId]: updatedBlock,
              },
            });
          }
        },
      }),
      [onSave]
    );

    // Inject the editor's Google Fonts stylesheet once on mount so the
    // canvas can preview every supported font.
    useEffect(() => {
      ensureEditorFontsLink();
    }, []);

    // Auto-save listener
    useEffect(() => {
      const handleAutoSave = (event: CustomEvent<boolean>) => {
        if (onAutoSave && event.detail) {
          const currentDocument = editorStateStore.getState().document;
          onAutoSave(currentDocument);
        }
      };

      window.addEventListener('email-builder-auto-save', handleAutoSave as EventListener);

      return () => {
        window.removeEventListener('email-builder-auto-save', handleAutoSave as EventListener);
      };
    }, [onAutoSave]);

    // Load document listener (for dev tools)
    useEffect(() => {
      const handleLoadDocument = (event: CustomEvent<{ document: TEditorConfiguration }>) => {
        if (event.detail?.document) {
          try {
            let document = event.detail.document;

            // Migrate CustomEditor and Wysiwyg blocks to NotionText
            document = migrateDocument(document);

            // Deep clone to avoid mutations
            resetDocument(JSON.parse(JSON.stringify(document)));
          } catch (error) {
            console.error('Error loading document from custom event:', error);
          }
        }
      };

      window.addEventListener('email-builder:load-document', handleLoadDocument as EventListener);

      return () => {
        window.removeEventListener('email-builder:load-document', handleLoadDocument as EventListener);
      };
    }, []);

    useEffect(() => {
      const nextLocale = locale ?? dataLocale;
      if (nextLocale) {
        const normalized = normalizeLocale(nextLocale);
        if (normalized !== i18n.language) {
          i18n.changeLanguage(normalized).catch(() => {
            // Silently ignore language change errors
          });
        }
      }
    }, [locale, dataLocale]);

    // Set custom image provider in window for access by ImageInput component
    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__emailBuilderCustomImageProvider = customImageProvider;
      }
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__emailBuilderCustomImageProvider;
        }
      };
    }, [customImageProvider]);

    // Set custom merge tags in window for access by NotionText block
    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__emailBuilderCustomMergeTags = mergeTags;
      }
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__emailBuilderCustomMergeTags;
        }
      };
    }, [mergeTags]);

    // Set AI features configuration
    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__emailBuilderEnableAI = Boolean(enableAI);

        (window as any).__emailBuilderOnAIRequest = onAIRequest;
        (window as any).__emailBuilderOnAIGenerateTemplate = onAIGenerateTemplate;
        // Notify components that read these globals (e.g. AIGeneration button in
        // the editor header) so they can refresh their visibility/reactivity.
        window.dispatchEvent(new Event('email-builder-ai-features-updated'));
        // The rich-text bubble/slash menus and the image AI tabs listen for
        // `email-builder-ai-generation` (boolean detail) to toggle their AI
        // affordances — nothing dispatched it before, so they only ever saw the
        // initial global read and could stay hidden depending on mount order.
        window.dispatchEvent(new CustomEvent('email-builder-ai-generation', { detail: Boolean(enableAI) }));
      }
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__emailBuilderOnAIRequest;
          delete (window as any).__emailBuilderOnAIGenerateTemplate;
          window.dispatchEvent(new Event('email-builder-ai-features-updated'));
          window.dispatchEvent(new CustomEvent('email-builder-ai-generation', { detail: false }));
        }
      };
    }, [enableAI, onAIRequest, onAIGenerateTemplate]);

    // Bridge the rich-text inline AI (bubble menu / slash menu) to the host's
    // `onAIRequest`. block-notion-text dispatches a window `ai-request`
    // CustomEvent (see `requestAIFeature`) and waits for a `text-ai-processed`
    // event to replace the selection. Previously the ONLY listener was a local
    // dummy (`initDummyAIEvents`) that never called the backend — so inline
    // text AI made no request. This wires the event to the real callback and
    // echoes back the selection info the editor needs to apply the result.
    useEffect(() => {
      if (typeof window === 'undefined' || !onAIRequest) return undefined;

      const handleAiRequest = (event: Event) => {
        const detail = (
          event as CustomEvent<
            AIFeatureRequest & { replaceSelection?: boolean; selectionFrom?: number; selectionTo?: number }
          >
        ).detail;
        if (!detail) return;

        void (async () => {
          let processedContent = '';
          try {
            processedContent = await onAIRequest(detail);
          } catch (err) {
            console.error('[EmailBuilder] onAIRequest failed', err);
          }
          window.dispatchEvent(
            new CustomEvent('text-ai-processed', {
              detail: {
                processedContent,
                replaceSelection: detail.replaceSelection,
                selectionFrom: detail.selectionFrom,
                selectionTo: detail.selectionTo,
              },
            }),
          );
        })();
      };

      window.addEventListener('ai-request', handleAiRequest);
      return () => window.removeEventListener('ai-request', handleAiRequest);
    }, [onAIRequest]);

    // Expose Unsplash configuration to `ImageInput` / `BackgroundImageInput`
    // via the same window-global pattern used by the AI features. The picker
    // itself reads these globals through its own resolver in `unsplash-api.ts`
    // (for `backendUrl`) and `ImageInput` reads `__emailBuilderUnsplashEnabled`
    // to decide whether to render the Gallery tab.
    useEffect(() => {
      if (typeof window !== 'undefined') {
        (window as any).__emailBuilderUnsplashEnabled = Boolean(unsplashEnabled);
        (window as any).__emailBuilderUnsplashBackendUrl = unsplashBackendUrl;
        window.dispatchEvent(new Event('email-builder-unsplash-updated'));
      }
      return () => {
        if (typeof window !== 'undefined') {
          delete (window as any).__emailBuilderUnsplashEnabled;
          delete (window as any).__emailBuilderUnsplashBackendUrl;
          window.dispatchEvent(new Event('email-builder-unsplash-updated'));
        }
      };
    }, [unsplashEnabled, unsplashBackendUrl]);

    // Initialize document with initialDocument or data if provided
    useEffect(() => {
      const documentSource = data || initialDocument;
      if (documentSource) {
        try {
          let document: TEditorConfiguration;
          if (typeof documentSource === 'string') {
            // If it's a string, try to parse it as JSON
            document = JSON.parse(documentSource);
          } else {
            document = documentSource;
          }

          // Migrate CustomEditor and Wysiwyg blocks to NotionText
          document = migrateDocument(document);

          // Deep clone to avoid mutations
          resetDocument(JSON.parse(JSON.stringify(document)));
        } catch (error) {
          console.error('Error initializing document:', error);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- reactive to the data prop only; initialDocument is a mount-time seed handled by the prior effect
    }, []); // Only run once on mount

    // Update document when data prop changes (reactive)
    useEffect(() => {
      if (data) {
        try {
          let document: TEditorConfiguration;
          if (typeof data === 'string') {
            document = JSON.parse(data);
          } else {
            document = data;
          }

          // Migrate CustomEditor and Wysiwyg blocks to NotionText
          document = migrateDocument(document);

          // Deep clone to avoid mutations
          resetDocument(JSON.parse(JSON.stringify(document)));
        } catch (error) {
          console.error('Error updating document:', error);
        }
      }
    }, [data]); // React to data prop changes

    const theme = useMemo(
      () => getTheme(resolvedPrimaryColor, resolvedSecondaryColor, resolvedDarkMode, portalContainer),
      [resolvedPrimaryColor, resolvedSecondaryColor, resolvedDarkMode, portalContainer]
    );

    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <DndProvider backend={DND_BACKEND} options={DND_BACKEND_OPTIONS}>
          {IS_TOUCH_DEVICE && <DragPreview />}
          <ThemeProvider theme={theme}>
            <I18nextProvider i18n={i18n}>
              {/* Global overrides to replace old CSS variable usage with theme colors */}
              <GlobalStyles
                styles={(t) => ({
                  '.ce-inline-toolbar, .codex-editor--narrow .ce-toolbox, .ce-conversion-toolbar, .ce-settings, .ce-settings__button, .ce-toolbar__settings-btn:hover, .cdx-button, .ce-popover, .ce-toolbar__plus:hover':
                    {
                      background: t.palette.primary.main,
                      color: '#fff',
                    },
                  '::selection, .ce-block--selected .ce-block__content': {
                    background: `${t.palette.secondary.main} !important`,
                  },
                  '.ce-popover-item:hover': {
                    backgroundColor: `${t.palette.primary.main} !important`,
                    color: '#fff',
                  },
                  '.cdx-settings-button:hover, .ce-settings__button:hover, .ce-toolbox__button--active, .ce-toolbox__button:hover, .cdx-button:hover, .ce-inline-toolbar__dropdown:hover, .ce-inline-tool:hover, .ce-popover__item:hover, .ce-toolbar__settings-btn:hover':
                    {
                      backgroundColor: t.palette.primary.main,
                      color: '#fff !important',
                    },
                  '.tag__title': {
                    color: `${t.palette.primary.main} !important`,
                  },
                  '.editor-js-loader': {
                    borderBottomColor: t.palette.primary.main,
                  },
                  '.ql-tooltip .ql-action': {
                    background: t.palette.secondary.main,
                    color: '#fff !important',
                  },
                  '.email-builder-body::-webkit-scrollbar-thumb': {
                    background: t.palette.primary.main,
                  },
                  '.buttonsUndoRedo': {
                    color: t.palette.primary.main,
                    transition: 'color 0.2s, background-color 0.2s',
                    borderRadius: '8px',
                  },
                  '.buttonsUndoRedo:hover': {
                    color: t.palette.primary.dark,
                    backgroundColor: `${alpha(t.palette.primary.main, 0.08)}`,
                  },
                  '.buttonsUndoRedo.disabledButton': {
                    color: t.palette.text.disabled,
                  },
                  '.ql-snow .ql-toolbar button.ql-active': {
                    color: t.palette.primary.main,
                  },
                  '.lucide-loader-circle': {
                    color: t.palette.primary.main,
                  },
                  '.eb-editor-esc-tip': {
                    backgroundColor: t.palette.secondary.main,
                  },
                })}
              />
              <CssBaseline />
              <App
                sticky={resolvedSticky}
                heightContent={resolvedHeight}
                darkMode={resolvedDarkMode}
                galleryImages={resolvedGalleryImages}
                stickyHeader={resolvedStickyHeader}
                htmlTab={htmlTab}
                jsonTab={jsonTab}
                imagePlaceholder={resolvedImagePlaceholder}
                imageUrlInput={resolvedImageUrlInput}
                imageUploadInput={resolvedImageUploadInput}
                backgroundUrlInput={resolvedBackgroundUrlInput}
                backgroundUploadInput={resolvedBackgroundUploadInput}
                componentTree={componentTree}
                showVersion={showVersion ?? false}
                componentsStorage={componentsStorage ?? 'backend'}
                templateSaving={templateSaving}
                templateLibrary={templateLibrary}
                themeSaving={themeSaving}
              />
            </I18nextProvider>
          </ThemeProvider>
        </DndProvider>
      </div>
    );
  }
);

// Lazy singleton to avoid redefining the element
let EmailBuilderElementClass: CustomElementConstructor | null = null;
function ensureElementClass(): CustomElementConstructor {
  if (EmailBuilderElementClass) return EmailBuilderElementClass;
  EmailBuilderElementClass = r2wc(EmailBuilder, {
    props: {
      primaryColor: 'string',
      secondaryColor: 'string',
      galleryImages: 'boolean',
      darkMode: 'boolean',
      height: 'string',
      stickyHeader: 'boolean',
      sticky: 'boolean',
      htmlTab: 'boolean',
      jsonTab: 'boolean',
      locale: 'string',
      dataLocale: 'string',
      imagePlaceholder: 'string',
      imageUrlInput: 'boolean',
      imageUploadInput: 'boolean',
      backgroundUrlInput: 'boolean',
      backgroundUploadInput: 'boolean',
      data: 'json',
      showVersion: 'boolean',
      componentTree: 'boolean',
      componentsStorage: 'string',
      templateSaving: 'boolean',
      templateLibrary: 'boolean',
      themeSaving: 'boolean',
      enableAI: 'boolean',
      mergeTags: 'json',
    },
  }) as unknown as CustomElementConstructor;
  return EmailBuilderElementClass;
}

// Registers the <email-builder> custom element (works in Nuxt 3 client plugin)
export function registerEmailBuilder(tagName: string = 'email-builder') {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ensureElementClass());
  }
}

// Auto-register in browser environments for backward compatibility
if (typeof window !== 'undefined') {
  try {
    registerEmailBuilder('email-builder');
  } catch {
    /* ignore if already defined */
  }
}

export default EmailBuilder;
export { EmailBuilder };

// ---------------------------------------------------------------------------
// Re-export schemas & validation from @eb/document-core
// Enables consumers of the published package to validate documents without
// needing the private workspace package.
// ---------------------------------------------------------------------------
export {
  // Primitives
  COLOR_SCHEMA,
  PADDING_SCHEMA,
  FONT_FAMILY_SCHEMA,
  FONT_FAMILY_NAMES,
  SHAPE_SCHEMA,
  // Block schemas
  ButtonPropsSchema,
  ColumnsContainerPropsSchema,
  ContainerPropsSchema,
  DividerPropsSchema,
  EmailLayoutPropsSchema,
  ImagePropsSchema,
  NotionTextPropsSchema,
  SocialMediaPropsSchema,
  SpacerPropsSchema,
  // Composite
  EditorBlockSchema,
  EditorConfigurationSchema,
  BLOCK_TYPES,
  // Validation
  validateDocument,
} from '@eb/document-core';

export type { TEditorBlock, TEditorConfiguration, BlockType, ValidationResult } from '@eb/document-core';
