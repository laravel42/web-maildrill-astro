/**
 * Sistema de selectores granulares para bloques
 * Permite suscripciones ultra-específicas que minimizan re-renders
 */

import { makeComponentTreeColumnSlotId } from './componentTreeColumnSlot';
import type { TEditorBlock } from './core';
import { editorStateStore } from './EditorContext';

/** Nodo del árbol de bloques para el panel flotante Component Tree */
export type TreeNode = {
  blockId: string;
  type: string;
  label: string;
  iconName: string;
  children: TreeNode[];
  depth: number;
  /** Fila sintética: ranura de columna dentro de ColumnsContainer (no es un bloque del documento) */
  columnSlot?: { parentBlockId: string; columnIndex: number; columnsCount: 2 | 3 };
};

const BLOCK_TREE_META: Record<string, { label: string; iconName: string }> = {
  EmailLayout: { label: 'Email', iconName: 'DashboardOutlined' },
  NotionText: { label: 'Text', iconName: 'ArticleOutlined' },
  SocialMedia: { label: 'Social', iconName: 'Groups2' },
  Button: { label: 'Button', iconName: 'SmartButtonOutlined' },
  Image: { label: 'Image', iconName: 'ImageOutlined' },
  Divider: { label: 'Divider', iconName: 'HorizontalRuleOutlined' },
  Spacer: { label: 'Spacer', iconName: 'Crop32Outlined' },
  ColumnsContainer: { label: 'Columns', iconName: 'ViewColumnOutlined' },
  Container: { label: 'Container', iconName: 'LibraryAddOutlined' },
  Html: { label: 'HTML', iconName: 'CodeOutlined' },
};

/**
 * Selector para obtener un bloque completo
 * Usa comparación de referencia para evitar re-renders innecesarios
 */
export const selectBlock =
  (blockId: string) =>
  (state: any): TEditorBlock | undefined => {
    return state.document[blockId];
  };

/**
 * Selector para props de un bloque
 * Solo se actualiza cuando las props cambian
 */
export const selectBlockProps =
  (blockId: string) =>
  (state: any): any => {
    return state.document[blockId]?.data?.props;
  };

/**
 * Selector para una prop específica
 * Máxima granularidad - solo se actualiza cuando cambia ESA prop
 */
export const selectBlockProp =
  <T = any>(blockId: string, propName: string) =>
  (state: any): T => {
    return state.document[blockId]?.data?.props?.[propName];
  };

/**
 * Selector para el tipo de bloque
 */
export const selectBlockType =
  (blockId: string) =>
  (state: any): string | undefined => {
    return state.document[blockId]?.type;
  };

/**
 * Selector para los estilos de un bloque
 */
export const selectBlockStyles =
  (blockId: string) =>
  (state: any): any => {
    return state.document[blockId]?.data?.style;
  };

/**
 * Selector para un estilo específico
 */
export const selectBlockStyle =
  (blockId: string, styleName: string) =>
  (state: any): any => {
    return state.document[blockId]?.data?.style?.[styleName];
  };

/**
 * Selector para childrenIds de un bloque
 */
export const selectBlockChildren =
  (blockId: string) =>
  (state: any): string[] => {
    const block = state.document[blockId];
    if (!block) return [];

    // Diferentes estructuras según el tipo de bloque
    switch (block.type) {
      case 'EmailLayout':
        return block.data?.childrenIds || [];
      case 'Container':
        return block.data?.props?.childrenIds || [];
      case 'ColumnsContainer':
        // Para columnas, retornar todos los childrenIds de todas las columnas
        return block.data?.props?.columns?.flatMap((col: any) => col.childrenIds || []) || [];
      default:
        return [];
    }
  };

/** Child ids for subtree walks; aligned with EditorContext isChildOf. */
function getDirectChildBlockIdsForHierarchy(block: any): string[] {
  if (!block) return [];
  switch (block.type) {
    case 'EmailLayout':
      return block.data?.childrenIds || [];
    case 'Container':
      return block.data?.props?.childrenIds || [];
    case 'ColumnsContainer':
      return block.data?.props?.columns?.flatMap((col: any) => col.childrenIds || []) || [];
    default:
      return [];
  }
}

function isDescendantInDocumentSubtree(
  document: any,
  rootBlockId: string,
  targetId: string,
): boolean {
  const children = getDirectChildBlockIdsForHierarchy(document[rootBlockId]);
  for (const cid of children) {
    if (cid === targetId) return true;
    if (isDescendantInDocumentSubtree(document, cid, targetId)) return true;
  }
  return false;
}

/**
 * True if selectedId is in this column slot (root id or nested under any root in the column).
 * Uses the flat document — source of truth for Component Tree selection highlights.
 */
export function isSelectedBlockInColumnsSlot(
  document: any,
  columnsParentId: string,
  columnIndex: number,
  selectedId: string | null,
): boolean {
  if (!selectedId) return false;
  const columnsBlock = document[columnsParentId];
  if (!columnsBlock || columnsBlock.type !== 'ColumnsContainer') return false;
  const rootIds: string[] = columnsBlock.data?.props?.columns?.[columnIndex]?.childrenIds || [];
  for (const id of rootIds) {
    if (id === selectedId) return true;
    if (isDescendantInDocumentSubtree(document, id, selectedId)) return true;
  }
  return false;
}

/**
 * Selector para verificar si un bloque está seleccionado
 */
export const selectIsBlockSelected =
  (blockId: string) =>
  (state: any): boolean => {
    return state.selectedBlockId === blockId;
  };

/**
 * Selector para verificar si un bloque existe
 */
export const selectBlockExists =
  (blockId: string) =>
  (state: any): boolean => {
    return blockId in state.document;
  };

/**
 * Selector que construye el árbol jerárquico de bloques desde el documento plano.
 * Usado por el panel flotante Component Tree.
 */
export function selectBlockTree(state: any): TreeNode | null {
  const doc = state.document;
  if (!doc || !doc['root']) return null;

  function getChildrenIds(blockId: string, s: any): string[] {
    const block = s.document[blockId];
    if (!block) return [];
    switch (block.type) {
      case 'EmailLayout':
        return block.data?.childrenIds || [];
      case 'Container':
        return block.data?.props?.childrenIds || [];
      case 'ColumnsContainer':
        return block.data?.props?.columns?.flatMap((col: any) => col.childrenIds || []) || [];
      default:
        return [];
    }
  }

  function buildNode(blockId: string, depth: number, s: any): TreeNode {
    const block = s.document[blockId];
    const type = block?.type ?? 'Unknown';
    const meta = BLOCK_TREE_META[type] ?? { label: type, iconName: 'WidgetsOutlined' };

    if (type === 'ColumnsContainer') {
      const cols = block.data?.props?.columns;
      const columnsCountProp = block.data?.props?.columnsCount;
      const columnsCount = (columnsCountProp === 2 ? 2 : 3) as 2 | 3;
      const slotChildren: TreeNode[] = [];
      for (let i = 0; i < columnsCount; i++) {
        const childIds = cols?.[i]?.childrenIds ?? [];
        const slotId = makeComponentTreeColumnSlotId(blockId, i);
        slotChildren.push({
          blockId: slotId,
          type: 'ColumnSlot',
          label: '',
          iconName: 'WidgetsOutlined',
          children: childIds.map((cid: string) => buildNode(cid, depth + 2, s)),
          depth: depth + 1,
          columnSlot: { parentBlockId: blockId, columnIndex: i, columnsCount },
        });
      }
      return {
        blockId,
        type,
        label: meta.label,
        iconName: meta.iconName,
        children: slotChildren,
        depth,
      };
    }

    const childrenIds = getChildrenIds(blockId, s);
    const children = childrenIds.map((id: string) => buildNode(id, depth + 1, s));
    return {
      blockId,
      type,
      label: meta.label,
      iconName: meta.iconName,
      children,
      depth,
    };
  }

  return buildNode('root', 0, state);
}

/**
 * Hook optimizado para usar selectores
 * Evita crear funciones nuevas en cada render
 */
export function useBlockSelector<T>(selector: (state: any) => T): T {
  return editorStateStore(selector);
}
