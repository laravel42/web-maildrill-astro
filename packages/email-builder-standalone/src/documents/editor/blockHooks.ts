/**
 * Hooks granulares optimizados para bloques
 * Cada hook se suscribe SOLO a lo que necesita
 */

import { useCallback, useMemo } from 'react';

import {
  selectBlock,
  selectBlockChildren,
  selectBlockExists,
  selectBlockProp,
  selectBlockProps,
  selectBlockStyle,
  selectBlockStyles,
  selectBlockType,
  selectIsBlockSelected,
} from './blockSelectors';
import {
  atomicBatchUpdateProps,
  atomicBatchUpdateStyles,
  atomicUpdateBlock,
  atomicUpdateBlockProp,
  atomicUpdateBlockProps,
  atomicUpdateBlockStyle,
  atomicUpdateBlockStyles,
} from './blockUpdaters';
import type { TEditorBlock } from './core';
import { editorStateStore } from './EditorContext';

/**
 * Hook para obtener un bloque completo
 * Solo se re-renderiza cuando el bloque cambia
 */
export function useBlock(blockId: string): TEditorBlock | undefined {
  return editorStateStore(selectBlock(blockId));
}

/**
 * Hook para obtener las props de un bloque
 * Solo se re-renderiza cuando las props cambian
 */
export function useBlockPropsGranular<T = any>(blockId: string): T {
  return editorStateStore(selectBlockProps(blockId));
}

/**
 * Hook para obtener UNA prop específica
 * Máxima granularidad - solo se re-renderiza cuando cambia ESA prop
 */
export function useBlockPropGranular<T = any>(blockId: string, propName: string): T {
  return editorStateStore(selectBlockProp<T>(blockId, propName));
}

/**
 * Hook para obtener el tipo de bloque
 */
export function useBlockTypeGranular(blockId: string): string | undefined {
  return editorStateStore(selectBlockType(blockId));
}

/**
 * Hook para obtener los estilos de un bloque
 */
export function useBlockStylesGranular(blockId: string): any {
  return editorStateStore(selectBlockStyles(blockId));
}

/**
 * Hook para obtener UN estilo específico
 */
export function useBlockStyleGranular<T = any>(blockId: string, styleName: string): T {
  return editorStateStore(selectBlockStyle(blockId, styleName));
}

/**
 * Hook para obtener los childrenIds de un bloque
 */
export function useBlockChildrenGranular(blockId: string): string[] {
  return editorStateStore(selectBlockChildren(blockId));
}

/**
 * Hook para verificar si un bloque está seleccionado
 */
export function useIsBlockSelectedGranular(blockId: string): boolean {
  return editorStateStore(selectIsBlockSelected(blockId));
}

/**
 * Hook para verificar si un bloque existe
 */
export function useBlockExistsGranular(blockId: string): boolean {
  return editorStateStore(selectBlockExists(blockId));
}

/**
 * Hook que retorna funciones de actualización memoizadas
 * Evita crear nuevas funciones en cada render
 */
export function useBlockUpdater(blockId: string) {
  const updateBlock = useCallback(
    (updater: (block: TEditorBlock) => TEditorBlock) => {
      atomicUpdateBlock(blockId, updater);
    },
    [blockId],
  );

  const updateProps = useCallback(
    (propsUpdater: any) => {
      atomicUpdateBlockProps(blockId, propsUpdater);
    },
    [blockId],
  );

  const updateProp = useCallback(
    (propName: string, value: any) => {
      atomicUpdateBlockProp(blockId, propName, value);
    },
    [blockId],
  );

  const updateStyles = useCallback(
    (stylesUpdater: any) => {
      atomicUpdateBlockStyles(blockId, stylesUpdater);
    },
    [blockId],
  );

  const updateStyle = useCallback(
    (styleName: string, value: any) => {
      atomicUpdateBlockStyle(blockId, styleName, value);
    },
    [blockId],
  );

  const batchUpdateProps = useCallback(
    (updates: Record<string, any>) => {
      atomicBatchUpdateProps(blockId, updates);
    },
    [blockId],
  );

  const batchUpdateStyles = useCallback(
    (updates: Record<string, any>) => {
      atomicBatchUpdateStyles(blockId, updates);
    },
    [blockId],
  );

  return useMemo(
    () => ({
      updateBlock,
      updateProps,
      updateProp,
      updateStyles,
      updateStyle,
      batchUpdateProps,
      batchUpdateStyles,
    }),
    [
      updateBlock,
      updateProps,
      updateProp,
      updateStyles,
      updateStyle,
      batchUpdateProps,
      batchUpdateStyles,
    ],
  );
}

/**
 * Hook combinado: obtiene una prop Y su función de actualización
 * Patrón común optimizado
 */
export function useBlockPropWithUpdater<T = any>(
  blockId: string,
  propName: string,
): [T, (value: T) => void] {
  const value = useBlockPropGranular<T>(blockId, propName);

  const setValue = useCallback(
    (newValue: T) => {
      atomicUpdateBlockProp(blockId, propName, newValue);
    },
    [blockId, propName],
  );

  return [value, setValue];
}

/**
 * Hook combinado: obtiene un estilo Y su función de actualización
 */
export function useBlockStyleWithUpdater<T = any>(
  blockId: string,
  styleName: string,
): [T, (value: T) => void] {
  const value = useBlockStyleGranular<T>(blockId, styleName);

  const setValue = useCallback(
    (newValue: T) => {
      atomicUpdateBlockStyle(blockId, styleName, newValue);
    },
    [blockId, styleName],
  );

  return [value, setValue];
}

/**
 * Hook para múltiples props con un solo re-render
 * Útil cuando necesitas varias props del mismo bloque
 */
export function useBlockPropsMultiple<T extends Record<string, any>>(
  blockId: string,
  propNames: (keyof T)[],
): Partial<T> {
  return editorStateStore(
    useCallback(
      (state) => {
        const data = state.document[blockId]?.data;
        const props = (data && 'props' in data ? data.props : undefined) || {};
        const result: any = {};

        for (const propName of propNames) {
          result[propName] = props[propName];
        }

        return result;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- granular subscription key — propNames.join(",") is the intentional stable dep; the array members are derived from it
      [blockId, propNames.join(',')],
    ),
  );
}

/**
 * Hook para múltiples estilos con un solo re-render
 */
export function useBlockStylesMultiple<T extends Record<string, any>>(
  blockId: string,
  styleNames: (keyof T)[],
): Partial<T> {
  return editorStateStore(
    useCallback(
      (state) => {
        const data = state.document[blockId]?.data;
        const styles = ((data && 'style' in data ? data.style : undefined) || {}) as Record<
          string,
          unknown
        >;
        const result: any = {};

        for (const styleName of styleNames) {
          result[styleName] = styles[styleName as string];
        }

        return result;
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps -- granular subscription key — styleNames.join(",") is the intentional stable dep; the array members are derived from it
      [blockId, styleNames.join(',')],
    ),
  );
}

/**
 * Hook para observar cambios en un bloque sin causar re-renders
 * Útil para efectos secundarios
 */
export function useBlockObserver(
  blockId: string,
  callback: (block: TEditorBlock) => void,
  deps: any[] = [],
) {
  const block = useBlock(blockId);

  useMemo(() => {
    if (block) {
      callback(block);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generic observer passes caller-supplied deps via spread; callback is intentionally excluded so callers control re-runs
  }, [block, ...deps]);
}
