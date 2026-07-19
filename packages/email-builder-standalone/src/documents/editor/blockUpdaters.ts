/**
 * Sistema de actualizaciones atómicas para bloques
 * Cada función actualiza SOLO lo necesario, sin tocar el resto del documento
 *
 * NOTA: Estas funciones usan updateBlock internamente para mantener
 * consistencia con el sistema de undo/redo
 */

import type { TEditorBlock } from './core';
import { editorStateStore, updateBlock } from './EditorContext';

/**
 * Tipo para funciones de actualización
 */
type BlockUpdater<T = any> = (current: T) => T;

/**
 * Actualización atómica de un bloque completo
 * Usa shallow copy para máxima eficiencia
 */
export function atomicUpdateBlock(blockId: string, updater: BlockUpdater<TEditorBlock>) {
  // Usar updateBlock internamente para mantener consistencia con undo/redo
  // updateBlock ya está optimizado con startTransition y maneja todo correctamente
  updateBlock(blockId, updater);
}

/**
 * Actualización atómica de props de un bloque
 * Solo toca las props, no el resto del bloque
 */
export function atomicUpdateBlockProps(blockId: string, propsUpdater: BlockUpdater | Partial<any>) {
  atomicUpdateBlock(blockId, (block): TEditorBlock => {
    const raw = block.data && 'props' in block.data ? block.data.props : undefined;
    const currentProps: Record<string, unknown> = {
      ...(raw !== null && typeof raw === 'object' ? raw : {}),
    };

    const nextPartial: unknown =
      typeof propsUpdater === 'function' ? propsUpdater(currentProps) : (propsUpdater as Record<string, unknown>);
    const updatedProps: Record<string, unknown> = {
      ...currentProps,
      ...(typeof nextPartial === 'object' && nextPartial !== null ? (nextPartial as Record<string, unknown>) : {}),
    };

    if (currentProps === updatedProps) {
      return block;
    }

    return {
      ...block,
      data: {
        ...block.data,
        props: updatedProps,
      },
    } as TEditorBlock;
  });
}

/**
 * Actualización atómica de UNA SOLA prop
 * Máxima granularidad - solo cambia un campo
 */
export function atomicUpdateBlockProp<T = any>(blockId: string, propName: string, value: T) {
  atomicUpdateBlock(blockId, (block): TEditorBlock => {
    const props = block.data && 'props' in block.data ? block.data.props : undefined;
    const currentValue = (props as Record<string, T> | undefined)?.[propName];

    // Verificar si el valor realmente cambió
    if (currentValue === value) {
      return block;
    }

    return {
      ...block,
      data: {
        ...block.data,
        props: {
          ...(props as object),
          [propName]: value,
        },
      },
    } as TEditorBlock;
  });
}

/**
 * Actualización atómica de estilos de un bloque
 */
export function atomicUpdateBlockStyles(blockId: string, stylesUpdater: BlockUpdater | Partial<any>) {
  atomicUpdateBlock(blockId, (block): TEditorBlock => {
    const currentStyles = block.data && 'style' in block.data && block.data.style ? block.data.style : {};

    const updatedStyles =
      typeof stylesUpdater === 'function' ? stylesUpdater(currentStyles) : { ...currentStyles, ...stylesUpdater };

    if (currentStyles === updatedStyles) {
      return block;
    }

    return {
      ...block,
      data: {
        ...block.data,
        style: updatedStyles,
      },
    } as TEditorBlock;
  });
}

/**
 * Actualización atómica de UN SOLO estilo
 */
export function atomicUpdateBlockStyle<T = any>(blockId: string, styleName: string, value: T) {
  atomicUpdateBlock(blockId, (block): TEditorBlock => {
    const style = block.data && 'style' in block.data ? block.data.style : undefined;
    const currentValue = (style as Record<string, T> | undefined)?.[styleName];

    if (currentValue === value) {
      return block;
    }

    return {
      ...block,
      data: {
        ...block.data,
        style: {
          ...(style as object),
          [styleName]: value,
        },
      },
    } as TEditorBlock;
  });
}

/**
 * Actualización batch de múltiples props
 * Más eficiente que múltiples llamadas individuales
 */
export function atomicBatchUpdateProps(blockId: string, updates: Record<string, any>) {
  atomicUpdateBlockProps(blockId, (currentProps) => ({
    ...currentProps,
    ...updates,
  }));
}

/**
 * Actualización batch de múltiples estilos
 */
export function atomicBatchUpdateStyles(blockId: string, updates: Record<string, any>) {
  atomicUpdateBlockStyles(blockId, (currentStyles) => ({
    ...currentStyles,
    ...updates,
  }));
}

/**
 * Actualización condicional - solo actualiza si la condición se cumple
 */
export function atomicConditionalUpdate(
  blockId: string,
  condition: (block: TEditorBlock) => boolean,
  updater: BlockUpdater<TEditorBlock>
) {
  const currentBlock = editorStateStore.getState().document[blockId];

  if (!currentBlock) return;

  if (condition(currentBlock)) {
    atomicUpdateBlock(blockId, updater);
  }
}

/**
 * Actualización optimista - actualiza inmediatamente y permite rollback
 */
export function atomicOptimisticUpdate(
  blockId: string,
  updater: BlockUpdater<TEditorBlock>,
  onError?: (error: Error) => void
): () => void {
  const state = editorStateStore.getState();
  const originalBlock = state.document[blockId];

  if (!originalBlock) {
    console.warn(`[atomicOptimisticUpdate] Block ${blockId} not found`);
    return () => {};
  }

  // Aplicar actualización optimista
  atomicUpdateBlock(blockId, updater);

  // Retornar función de rollback
  return () => {
    try {
      editorStateStore.setState({
        document: {
          ...editorStateStore.getState().document,
          [blockId]: originalBlock,
        },
      });
    } catch (error) {
      onError?.(error as Error);
    }
  };
}
