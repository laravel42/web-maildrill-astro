import React, { createContext, memo, useContext, useMemo } from 'react';

import { resolveBlockData, type ThemeJson } from '@eb/document-core';

import { EDITOR_SCHEMA_DEFAULTS_BY_TYPE, EditorBlock as CoreEditorBlock } from './core';
import { editorStateStore, useSelectedScreenSize } from './EditorContext';

const EditorBlockContext = createContext<string | null>(null);
export const useCurrentBlockId = () => useContext(EditorBlockContext)!;

type EditorBlockProps = {
  id: string;
  isNotClient?: boolean;
};

/**
 * Componente memoizado que solo se re-renderiza cuando su bloque específico cambia
 * @param id - Block id
 * @returns EditorBlock component that loads data from the EditorDocumentContext
 */
const EditorBlockComponent = memo(
  function EditorBlock({ id, isNotClient }: EditorBlockProps) {
    // Usar selector granular: solo este bloque
    const block = editorStateStore((state) => state.document[id]);
    // Phase 2b — theme override source. Subscribed via a granular selector
    // so blocks only re-render when the theme actually changes (not on
    // unrelated root edits like backdropColor).
    const theme = editorStateStore((state) => (state.document?.root?.data as { theme?: ThemeJson } | undefined)?.theme);
    const viewport = useSelectedScreenSize();

    const resolved = useMemo(
      () =>
        block ? resolveBlockData(block as any, theme, viewport, EDITOR_SCHEMA_DEFAULTS_BY_TYPE[block.type]) : undefined,
      [block, theme, viewport]
    );

    if (!resolved) {
      console.warn(`Block ${id} not found`);
      return null;
    }

    return (
      <EditorBlockContext.Provider value={id}>
        <CoreEditorBlock isNotClient={isNotClient} {...(resolved as any)} blockId={id} />
      </EditorBlockContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    // Comparación personalizada: solo re-renderizar si el ID o isNotClient cambió
    return prevProps.id === nextProps.id && prevProps.isNotClient === nextProps.isNotClient;
  }
);

export default EditorBlockComponent;
