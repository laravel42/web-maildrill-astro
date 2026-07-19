import './slash-menu.css';
import './placeholder.css';
import './tiptap-content.css';
import './notion-text-editor.css';

import React, { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Editor, EditorContent, type EditorContentProps, useEditor } from '@tiptap/react';

const EditorContentComponent = EditorContent as unknown as React.ComponentType<EditorContentProps>;

import { getPadding } from '../../email-builder/src/helpers/getCssProperties';
import { shortCssId } from '../../email-builder/src/helpers/utils';
import Wrapper from '../../email-builder-standalone/src/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/containers/Wrapper';
import { getFontFamily } from '../../email-builder-standalone/src/documents/blocks/helpers/fontFamily';
import {
  editorStateStore,
  setNotionTextInlineEditingBlockId,
  updateBlockPropsSync,
  useNotionTextInlineEditingBlockId,
  useRoot,
  useSelectedScreenSize,
} from '../../email-builder-standalone/src/documents/editor/EditorContext';

import BubbleMenuToolbar from './BubbleMenuToolbar';
import { getFormattedHtmlCached, normalizeNotionTextHtml } from './helper-notion-text';
import { NotionTextProps, NotionTextPropsDefaults, NotionTextPropsSchema } from './NotionTextPropsSchema';
import { getTiptapExtensions } from './tiptap-config';

/** Devuelve true si el HTML es vacío o solo contiene párrafos vacíos */
function isHtmlEmpty(html: string): boolean {
  if (!html) return true;
  // State-machine tag stripping (avoids regex backtracking)
  let text = '';
  let inTag = false;
  for (let i = 0; i < html.length; i++) {
    if (html[i] === '<') {
      inTag = true;
    } else if (html[i] === '>') {
      inTag = false;
    } else if (!inTag) {
      text += html[i];
    }
  }
  return text.replace(/&nbsp;/g, '').trim().length === 0;
}

// ─── FIX CORE ─────────────────────────────────────────────────────────────────
// Set a nivel de MÓDULO (singleton), compartido entre TODAS las instancias del
// componente. Esto es necesario porque React puede montar dos instancias del mismo
// componente con el mismo blockId (doble render, lista virtualizada, StrictMode, etc.).
//
// El problema original: el evento `notion-text-force-save` llega a AMBAS instancias.
// La primera guarda el contenido correcto (<p>H</p>). La segunda —cuyo editor ya
// fue puesto en modo no-editable o cuyo editorContentRef todavía es el valor inicial—
// guarda <p></p>, sobrescribiendo el contenido y generando un snapshot fantasma
// en el historial de undo/redo.
//
// Con un Set de módulo: el primer handler que ejecuta agrega el blockId al Set.
// El segundo lo encuentra ya presente y hace return inmediato, sin importar
// en qué instancia se ejecute.
// ──────────────────────────────────────────────────────────────────────────────
const _forceSaveExecutedForBlock = new Set<string>();

export type NotionTextEditorProps = {
  blockId: string;
  style?: NotionTextProps['style'];
  props?: NotionTextProps['props'];
  isNotClient?: boolean;
};

export function NotionText({ blockId, style, props, isNotClient = false }: NotionTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation('common');
  const placeholderText = t('editor.notionTextPlaceholder');
  const notionTextInlineEditingBlockId = useNotionTextInlineEditingBlockId();
  const selectedScreenSize = useSelectedScreenSize();
  const root = useRoot() as any;
  const isEditing = !isNotClient && notionTextInlineEditingBlockId === blockId;
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);

  // Safety net: limpiar estado de edición inline si este bloque se desmonta mientras edita.
  // Las instancias isNotClient (preview) NO deben participar en el ciclo de edición.
  useEffect(() => {
    if (isNotClient) return;
    return () => {
      const currentEditingId = editorStateStore.getState().notionTextInlineEditingBlockId;
      if (currentEditingId === blockId) {
        setNotionTextInlineEditingBlockId(null);
      }
    };
  }, [blockId, isNotClient]);

  const editorContentRef = useRef(normalizeNotionTextHtml(props?.html ?? NotionTextPropsDefaults.html));
  const linkGlobal = root?.linkGlobal ?? null;

  const justFinishedEditingRef = useRef(false);
  const externalUpdateRef = useRef(false);
  const debounceSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBlockIdRef = useRef(blockId);

  // Escuchar eventos del slash menu para ocultar el toolbar
  useEffect(() => {
    if (!isEditing) return;
    const onOpen = () => setSlashMenuOpen(true);
    const onClose = () => setSlashMenuOpen(false);
    window.addEventListener('slash-menu-opened', onOpen);
    window.addEventListener('slash-menu-closed', onClose);
    return () => {
      window.removeEventListener('slash-menu-opened', onOpen);
      window.removeEventListener('slash-menu-closed', onClose);
    };
  }, [isEditing]);

  const debouncedSaveToStore = useCallback(() => {
    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
    }
    debounceSaveTimerRef.current = setTimeout(() => {
      const latestHtml = editorContentRef.current;
      if (blockId) {
        const storeBlock = editorStateStore.getState().document[blockId] as any;
        const storeHtml = storeBlock?.data?.props?.html;
        if (storeHtml !== latestHtml) {
          updateBlockPropsSync(blockId, { html: latestHtml });
        }
      }
      debounceSaveTimerRef.current = null;
    }, 300);
  }, [blockId]);

  useEffect(() => {
    return () => {
      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
      }
    };
  }, []);

  const editor = useEditor(
    {
      extensions: getTiptapExtensions(placeholderText),
      content: editorContentRef.current,
      editable: isNotClient ? false : isEditing,
      shouldRerenderOnTransaction: false,
      immediatelyRender: !isNotClient,
      onUpdate: ({ editor }: { editor: Editor }) => {
        const newHtml = editor.getHTML();
        const prevHtml = editorContentRef.current;
        editorContentRef.current = newHtml;

        if (newHtml === prevHtml) return;

        if (!justFinishedEditingRef.current && !externalUpdateRef.current && editor.isEditable) {
          debouncedSaveToStore();
        }
      },
    },
    [placeholderText]
  );

  // Listener para eventos AI (solo cuando está editando)
  useEffect(() => {
    if (!isEditing || !editor || !blockId) return;

    const handleAIProcessed = (event: Event) => {
      const customEvent = event as CustomEvent<{
        processedContent: string;
        replaceSelection?: boolean;
        selectionFrom?: number;
        selectionTo?: number;
      }>;

      const { processedContent, replaceSelection, selectionFrom, selectionTo } = customEvent.detail;

      if (processedContent) {
        if (replaceSelection && selectionFrom !== undefined && selectionTo !== undefined) {
          editor.chain().focus().insertContentAt({ from: selectionFrom, to: selectionTo }, processedContent).run();
        } else {
          editor.chain().focus().setContent(processedContent).run();
        }

        const newHtml = editor.getHTML();
        updateBlockPropsSync(blockId, { html: newHtml });
      }
    };

    window.addEventListener('text-ai-processed', handleAIProcessed);

    return () => {
      window.removeEventListener('text-ai-processed', handleAIProcessed);
    };
  }, [isEditing, editor, blockId]);

  // When not editing, keep the Tiptap document in sync with the store (e.g. undo/redo).
  // Compare normalized store html to normalized editor.getHTML(): editorContentRef is forced
  // to match props during render, so a ref-only gate would skip setContent while Tiptap stays stale.
  useEffect(() => {
    if (justFinishedEditingRef.current) {
      justFinishedEditingRef.current = false;
      return;
    }

    if (!isEditing && props?.html !== undefined) {
      if (editor?.isEditable) {
        return;
      }
      if (!editor || editor.isDestroyed) {
        return;
      }

      const normalized = normalizeNotionTextHtml(props.html);
      const editorNorm = normalizeNotionTextHtml(editor.getHTML());
      const bothEmpty = isHtmlEmpty(normalized) && isHtmlEmpty(editorNorm);

      if (!bothEmpty && normalized !== editorNorm) {
        editorContentRef.current = normalized;
        externalUpdateRef.current = true;
        editor.commands.setContent(normalized, { emitUpdate: false });
        Promise.resolve().then(() => {
          externalUpdateRef.current = false;
        });
      }
    }
  }, [isEditing, props?.html, editor, blockId]);

  useEffect(() => {
    if (!isEditing) return;
    const handleForceSave = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail.blockId !== blockId) return;

      // Deduplicación a nivel de módulo: el Set es compartido entre TODAS las
      // instancias del componente. Sea cual sea la instancia que llegue segunda,
      // el blockId ya estará en el Set y se ignora sin tocar el store.
      if (_forceSaveExecutedForBlock.has(blockId)) return;
      _forceSaveExecutedForBlock.add(blockId);

      if (debounceSaveTimerRef.current) {
        clearTimeout(debounceSaveTimerRef.current);
        debounceSaveTimerRef.current = null;
      }

      // Preferir editorContentRef.current sobre editor.getHTML().
      // Cuando hay dos instancias, la segunda puede tener el editor ya en modo
      // no-editable (o sin contenido actualizado), devolviendo <p></p>.
      // editorContentRef.current siempre refleja el último onUpdate del usuario.
      const currentContent = (editor?.isEditable ? editor?.getHTML() : null) ?? editorContentRef.current;

      editorContentRef.current = currentContent;

      const storeBlock = editorStateStore.getState().document[blockId] as any;
      const storeHtml = storeBlock?.data?.props?.html;
      if (storeHtml !== currentContent && blockId) {
        updateBlockPropsSync(blockId, { html: currentContent });
      }

      justFinishedEditingRef.current = true;
    };

    window.addEventListener('notion-text-force-save', handleForceSave);
    return () => window.removeEventListener('notion-text-force-save', handleForceSave);
  }, [isEditing, blockId, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
      if (isEditing) {
        justFinishedEditingRef.current = false;
        _forceSaveExecutedForBlock.delete(blockId);
        setTimeout(() => editor.commands.focus('end'), 0);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- blockId is read but intentionally excluded: each blockId has its own memoized EditorBlock/editor instance, so blockId never changes under a stable editor. Re-running on blockId would call focus('end') and steal the caret during editing.
  }, [isEditing, editor]);

  useEffect(() => {
    if (prevBlockIdRef.current !== blockId) {
      prevBlockIdRef.current = blockId;
      const freshHtml = normalizeNotionTextHtml(props?.html ?? NotionTextPropsDefaults.html);
      if (editor && !editor.isDestroyed && editor.getHTML() !== freshHtml) {
        editorContentRef.current = freshHtml;
        externalUpdateRef.current = true;
        editor.commands.setContent(freshHtml, { emitUpdate: false });
        Promise.resolve().then(() => {
          externalUpdateRef.current = false;
        });
      } else {
        editorContentRef.current = freshHtml;
      }
    }
  }, [blockId, props?.html, editor]);

  /** Lienzo editor: entrar a edición inline; en `<a>` evitar navegación (HTML exportado no cambia). */
  const handleDisplaySurfaceClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest?.('a[href]')) {
        e.preventDefault();
      }
      if (blockId) {
        setNotionTextInlineEditingBlockId(blockId);
      }
    },
    [blockId]
  );

  const finishEditing = useCallback(() => {
    if (debounceSaveTimerRef.current) {
      clearTimeout(debounceSaveTimerRef.current);
      debounceSaveTimerRef.current = null;
    }

    // Misma lógica que force-save: preferir ref cuando el editor ya no es editable
    const currentContent = (editor?.isEditable ? editor?.getHTML() : null) ?? editorContentRef.current;

    editorContentRef.current = currentContent;

    const storeBlock = editorStateStore.getState().document[blockId] as any;
    const storeHtml = storeBlock?.data?.props?.html;
    if (storeHtml !== currentContent && blockId) {
      updateBlockPropsSync(blockId, { html: currentContent });
    }

    justFinishedEditingRef.current = true;
    setNotionTextInlineEditingBlockId(null);
  }, [blockId, editor]);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      const currentEditingId = editorStateStore.getState().notionTextInlineEditingBlockId;
      const currentlyEditing = currentEditingId === blockId;

      if (!currentlyEditing || !containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;

      const target = e.target as Element;

      if (target?.closest?.('[data-notion-text-toolbar]')) return;

      if (
        target?.closest?.('.MuiPopover-root, .MuiModal-root, .MuiBackdrop-root, .MuiMenu-root, .MuiDialog-root') ||
        target?.closest?.('[data-slash-menu]') ||
        target?.closest?.('em-emoji-picker') ||
        target?.shadowRoot ||
        target?.closest?.('[role="presentation"]')
      ) {
        return;
      }

      if (document.querySelector('.MuiPopover-root, .MuiModal-root, .MuiDialog-root')) {
        return;
      }

      finishEditing();
    },
    [blockId, finishEditing]
  );

  useEffect(() => {
    if (!isEditing) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        finishEditing();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isEditing, finishEditing, handleClickOutside]);

  const padding = getPadding(
    selectedScreenSize === 'desktop' ? style?.padding : (style?.mobilePadding ?? style?.padding)
  );
  const textAlign = style?.textAlign ?? undefined;
  const border = {
    color: style?.borderColor ?? undefined,
    top: style?.borderTop ?? undefined,
    bottom: style?.borderBottom ?? undefined,
    left: style?.borderLeft ?? undefined,
    right: style?.borderRight ?? undefined,
  };

  const fontSize =
    selectedScreenSize === 'desktop'
      ? (style?.fontSize ?? undefined)
      : (style?.fontSizeMobile ?? style?.fontSize ?? undefined);

  const textColor = style?.color ?? undefined;

  const wStyle: CSSProperties = {
    color: textColor,
    fontSize,
    fontFamily: getFontFamily(style?.fontFamily),
    fontWeight: style?.fontWeight ?? undefined,
    lineHeight: style?.lineHeight ?? 'inherit',
    maxWidth: '100%',
    wordBreak: 'break-word' as const,
  };

  const displayHtml = isEditing
    ? editorContentRef.current
    : normalizeNotionTextHtml(props?.html ?? NotionTextPropsDefaults.html);

  if (!isEditing) {
    editorContentRef.current = displayHtml;
  }

  const formattedHtml = getFormattedHtmlCached(blockId || 'default', displayHtml, linkGlobal);

  const containerStyle = linkGlobal
    ? {
        '--global-link-color': linkGlobal.linkColor || 'inherit',
        '--global-link-text-decoration': linkGlobal.underline ? 'underline' : 'none',
      }
    : {};

  if (isNotClient) {
    return (
      <div style={containerStyle as React.CSSProperties}>
        <Wrapper
          className={shortCssId(blockId as any)}
          padding={padding}
          backgroundColor={style?.backgroundColor}
          align={textAlign}
          width="100%"
          border={border}
        >
          <div
            className={`eb-notion-content ${shortCssId(blockId as any)}`}
            style={{ ...wStyle, minHeight: '20px' }}
            dangerouslySetInnerHTML={{ __html: formattedHtml }}
          />
        </Wrapper>
      </div>
    );
  }

  const isEmpty = isHtmlEmpty(displayHtml);

  if (!isEditing) {
    return (
      <div ref={containerRef} style={containerStyle as React.CSSProperties}>
        <Wrapper
          className={shortCssId(blockId as any)}
          padding={padding}
          backgroundColor={style?.backgroundColor}
          align={textAlign}
          width="100%"
          border={border}
        >
          {isEmpty ? (
            <div
              className={`eb-notion-content ${shortCssId(blockId as any)}`}
              tabIndex={-1}
              role="textbox"
              aria-label="Text content"
              style={{
                ...wStyle,
                cursor: 'text',
                minHeight: '20px',
                color: '#adb5bd',
                transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={handleDisplaySurfaceClick}
            >
              {placeholderText}
            </div>
          ) : (
            <div
              className={`eb-notion-content ${shortCssId(blockId as any)}`}
              tabIndex={-1}
              role="textbox"
              aria-label="Text content"
              style={{
                ...wStyle,
                cursor: 'text',
                minHeight: '20px',
                transition: 'opacity 0.2s ease, box-shadow 0.2s ease',
              }}
              onClick={handleDisplaySurfaceClick}
              dangerouslySetInnerHTML={{ __html: formattedHtml }}
            />
          )}
        </Wrapper>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...(containerStyle as React.CSSProperties) }}>
      <Wrapper
        className={shortCssId(blockId as any)}
        padding={padding}
        backgroundColor={style?.backgroundColor}
        align={textAlign}
        width="100%"
        border={border}
      >
        <div className="notion-text-inline-editor" style={wStyle}>
          {editor && <BubbleMenuToolbar editor={editor} hidden={slashMenuOpen} />}
          <EditorContentComponent editor={editor} className="tiptap" />
        </div>
      </Wrapper>
    </div>
  );
}

export { NotionTextPropsSchema, NotionTextPropsDefaults };
export type { NotionTextProps };
export { NotionTextReader } from './NotionTextReader';
export { getFormattedHtmlCached, clearHtmlCache } from './helper-notion-text';
