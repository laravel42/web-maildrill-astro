/* eslint-disable react-hooks/rules-of-hooks */
import React, { CSSProperties, memo, useEffect, useMemo, useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import {
  DragIndicator as DragIndicatorIcon,
  EditOutlined as EditIconOutlined,
} from '@mui/icons-material';
import { Box, Chip, Fade, IconButton, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { BUTTONS } from '../../../../App/ComponentsLibrary/builtInBlocks';
import {
  type FetchableLibraryCategory,
  LIBRARY_COMPONENT_DND_TYPE,
  type LibraryComponentDragItem,
} from '../../../../App/ComponentsLibrary/dnd';
import { fetchSavedSubtree } from '../../../../App/ComponentsLibrary/fetchSavedSubtree';
import { PRIMITIVES } from '../../../../App/ComponentsLibrary/primitivesCatalog';
import type { TEditorBlock } from '../../../editor/core';
import { useCurrentBlockId } from '../../../editor/EditorBlock';
import {
  changeBlockPosition,
  editorStateStore,
  insertBuiltInBlockAfterSibling,
  insertBuiltInBlockBeforeSibling,
  insertSavedComponentAfterSibling,
  insertSavedComponentBeforeSibling,
  isChildOf,
  setCanvasHoveredBlockId,
  setSelectedBlockId,
  useBlockType,
  useCanvasHoveredBlockId,
  useEditingBlockId,
  useHighlightColor,
  useIsBlockSelected,
  useIsInFocusedEditingMode,
  useNotionTextInlineEditingBlockId,
  useSelectedMainTab,
} from '../../../editor/EditorContext';

import TuneMenu from './TuneMenu';

/** Retraso base antes de mostrar hover/commit de controles al entrar en un bloque. */
const HOVER_DELAY_MS = 150;
/** Cada nivel extra de anidación suma este tiempo (p. ej. hijo vs contenedor). */
const HOVER_DELAY_EXTRA_PER_DEPTH_MS = 25;

let pendingCanvasHoverApplyTimer: ReturnType<typeof setTimeout> | null = null;
let pendingCanvasHoverApplyBlockId: string | null = null;

function clearPendingCanvasHoverApply() {
  if (pendingCanvasHoverApplyTimer) {
    clearTimeout(pendingCanvasHoverApplyTimer);
    pendingCanvasHoverApplyTimer = null;
  }
  pendingCanvasHoverApplyBlockId = null;
}

function clearPendingCanvasHoverApplyIfForBlock(blockId: string) {
  if (pendingCanvasHoverApplyBlockId === blockId) {
    clearPendingCanvasHoverApply();
  }
}

function scheduleCanvasHoverApply(
  blockId: string,
  delayMs: number,
  isWrapperMounted: () => boolean,
  applyMouseInside: () => void,
) {
  clearPendingCanvasHoverApply();
  pendingCanvasHoverApplyBlockId = blockId;
  pendingCanvasHoverApplyTimer = setTimeout(() => {
    pendingCanvasHoverApplyTimer = null;
    pendingCanvasHoverApplyBlockId = null;
    if (!isWrapperMounted()) {
      return;
    }
    setCanvasHoveredBlockId(blockId);
    applyMouseInside();
  }, delayMs);
}

function getHoverDelayMsForElement(host: Element): number {
  const preview = host.closest('.preview-container');
  if (!preview) {
    return HOVER_DELAY_MS;
  }
  let depth = 0;
  let el: Element | null = host;
  while (el && preview.contains(el)) {
    if (el.hasAttribute('data-block-id')) {
      depth += 1;
    }
    if (el === preview) {
      break;
    }
    el = el.parentElement;
  }
  return HOVER_DELAY_MS + Math.max(0, depth - 1) * HOVER_DELAY_EXTRA_PER_DEPTH_MS;
}

/** Props we merge via cloneElement; explicit so React 19 keeps `props` typed (not `unknown`). */
type EditorBlockWrapperChildProps = {
  onClick?: React.MouseEventHandler<Element>;
  onMouseDown?: React.MouseEventHandler<Element>;
  onMouseUp?: React.MouseEventHandler<Element>;
};

type TEditorBlockWrapperProps = {
  children: React.ReactElement<EditorBlockWrapperChildProps>;
  canEdit?: boolean;
  isNotClient?: boolean;
};

/**
 * Hook para verificar si algún hijo de este bloque está en modo edición inline
 * @param blockId - ID del bloque padre a verificar
 * @returns true si algún hijo está editando, false en caso contrario
 */
function useIsAnyChildEditing(blockId: string): boolean {
  const notionTextInlineEditingBlockId = useNotionTextInlineEditingBlockId();

  return useMemo(() => {
    if (!notionTextInlineEditingBlockId) return false;

    // Verificar si el bloque que está editando es hijo de este bloque
    // isChildOf verifica recursivamente toda la jerarquía
    return isChildOf({
      draggedId: blockId,
      targetId: notionTextInlineEditingBlockId,
    });
  }, [blockId, notionTextInlineEditingBlockId]);
}

function resolveCanvasHoverTargetFromRelatedTarget(related: EventTarget | null): string | null {
  if (!related || typeof (related as Node).nodeType !== 'number') {
    return null;
  }
  const el = related as Element;
  const preview = el.closest?.('.preview-container');
  if (!preview) {
    return null;
  }
  const marked = el.closest?.('[data-block-id]');
  const id = marked?.getAttribute('data-block-id') ?? null;
  if (!id || !marked || !preview.contains(marked)) {
    return null;
  }
  return id;
}

function EditorBlockWrapperInner({
  children,
  canEdit = true,
  isNotClient = false,
}: TEditorBlockWrapperProps) {
  const blockId = useCurrentBlockId();
  const { t } = useTranslation();
  const canvasHoveredBlockId = useCanvasHoveredBlockId();
  const isSelected = useIsBlockSelected(blockId);
  const blockType = useBlockType(blockId);
  const selectedMainTab = useSelectedMainTab();
  const notionTextInlineEditingBlockId = useNotionTextInlineEditingBlockId();
  const editingBlockId = useEditingBlockId();
  const _highlightColor = useHighlightColor();
  const isAnyChildEditing = useIsAnyChildEditing(blockId);
  const [mouseInside, setMouseInside] = useState(false);
  const [dragStartTime, setDragStartTime] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [dropPosition, setDropPosition] = useState<'up' | 'down' | null>(null);
  const theme = useTheme();
  const isInFocusedEditingMode = useIsInFocusedEditingMode();

  // Deshabilitar drag cuando:
  // 1. Este bloque está en modo edición inline (NotionText)
  // 2. Alguno de sus hijos está en modo edición inline
  const isDragDisabled = notionTextInlineEditingBlockId === blockId || isAnyChildEditing;

  // Verificar si ESTE bloque específico está en modo edición
  const isThisBlockEditing = editingBlockId === blockId;

  // Color de resaltado para el modo edición:
  // usamos el color primario del tema en su variante "light" (más tenue),
  // y caemos a "main" si por alguna razón no existe la variante light.
  const editingHighlightColor = theme.palette.primary.light || theme.palette.primary.main;

  // Debounce para hover (leave) y coordinación con el timer global de enter
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperMountedRef = useRef(true);

  if (isNotClient) {
    return (
      <>
        <div
          style={{
            width: '100%',
          }}
        ></div>
        <Box
          sx={{
            position: 'relative',
            maxWidth: '100%',
          }}
        >
          <div>{children}</div>
        </Box>
        <div
          style={{
            width: '100%',
          }}
        ></div>
      </>
    );
  }

  let outline: CSSProperties['outline'];
  let zIndexEditable: CSSProperties['zIndex'];

  if (isThisBlockEditing && canEdit) {
    // Estado: Editando inline - Máxima prioridad visual
    outline = `2px solid ${editingHighlightColor}`;
    zIndexEditable = '10'; // Z-index alto para destacar sobre otros bloques
  } else if (isSelected && canEdit) {
    // Estado: Seleccionado (pero no editando)
    outline = `2px solid ${theme.palette.secondary.main}`;
    zIndexEditable = '1';
  } else if (mouseInside && canEdit) {
    // Estado: Hover
    outline = `2px dotted ${theme.palette.secondary.main}`;
  } else {
    zIndexEditable = 'auto';
  }

  const renderMenu = () => {
    if (!isSelected || !canEdit) {
      return null;
    }
    // While the block is in inline text editing its own format bar owns the
    // space around it, so the block actions would sit on top of that bar
    // whichever edge they take. They come back as soon as editing ends.
    if (notionTextInlineEditingBlockId === blockId) {
      return null;
    }
    return <TuneMenu blockId={blockId} />;
  };

  const getPosition = (monitor) => {
    const clientOffset = monitor.getClientOffset();
    const topCurrent = topRef.current?.getBoundingClientRect();
    const bottomCurrent = bottomRef.current?.getBoundingClientRect();

    if (!clientOffset || !topCurrent || !bottomCurrent) {
      return null;
    }

    const distanceTop = Math.abs(clientOffset.y - topCurrent.y);
    const distanceBottom = Math.abs(clientOffset.y - bottomCurrent.y);

    return distanceTop < distanceBottom ? 'up' : 'down';
  };

  const [{ isOver }, drop] = useDrop(() => ({
    accept: ['block', LIBRARY_COMPONENT_DND_TYPE],
    drop: (item: any, monitor) => {
      // Library-component drops are dispatched independently — they
      // ignore the `actualId === draggedId` guard (no draggedId exists)
      // and the `changeBlockPosition` logic. Instead we fetch the saved
      // NDJSON and splice it next to the hovered sibling. After L42-309
      // the payload carries `category` (primitive/layout/section/
      // template) so we can branch on it; today only Section drops are
      // wired (Phase 9 will generalise to Primitive/Layout, and
      // Templates go to the document-root drop zone elsewhere).
      const itemType = monitor.getItemType();
      if (itemType === LIBRARY_COMPONENT_DND_TYPE) {
        if (monitor.didDrop()) {
          monitor.getDropResult();
          return;
        }
        if (item.category === 'block' && typeof item.buttonIndex === 'number') {
          const entry = BUTTONS[item.buttonIndex];
          if (!entry) return;
          const position = getPosition(monitor);
          if (position === 'up') {
            insertBuiltInBlockBeforeSibling(blockId, entry.block());
          } else {
            insertBuiltInBlockAfterSibling(blockId, entry.block());
          }
          return;
        }
        if (item.category === 'block-preset' && typeof item.presetIndex === 'number') {
          const preset = PRIMITIVES[item.presetIndex];
          if (!preset) return;
          const position = getPosition(monitor);
          if (position === 'up') {
            insertBuiltInBlockBeforeSibling(blockId, preset.block as TEditorBlock);
          } else {
            insertBuiltInBlockAfterSibling(blockId, preset.block as TEditorBlock);
          }
          return;
        }
        const libItem = item as Omit<LibraryComponentDragItem, 'category'> & {
          category: FetchableLibraryCategory;
        };
        if (libItem.category === 'template') {
          // Templates do not insert inline — they replace the entire
          // document. The user applies them by clicking the template
          // card in the drawer (see TemplatesCategoryContent).

          console.warn(
            '[ComponentsLibrary] templates cannot be dropped inline; click the card in the drawer to apply.',
          );
          return;
        }
        const position = getPosition(monitor);
        const insertion: 'before' | 'after' = position === 'up' ? 'before' : 'after';
        void (async () => {
          try {
            const result = await fetchSavedSubtree(libItem.category, libItem.axis, libItem.id);
            if (insertion === 'after') {
              insertSavedComponentAfterSibling(blockId, result.blocks);
            } else {
              insertSavedComponentBeforeSibling(blockId, result.blocks);
            }
          } catch (err) {
            console.error('[ComponentsLibrary] failed to insert saved subtree', err);
          }
        })();
        return;
      }

      const actualId = blockId;
      const draggedId = item.blockId;

      // Si el elemento se suelta en el mismo lugar, no hacer nada
      if (actualId === draggedId) {
        return;
      }

      if (monitor.didDrop()) {
        monitor.getDropResult();
        return;
      }

      const position = getPosition(monitor);

      if (!position) {
        changeBlockPosition(actualId, draggedId, 'down');
        return;
      } else {
        changeBlockPosition(actualId, draggedId, position);
      }
    },
    canDrop: (item: any, monitor) => {
      // Library-component items have no `blockId` and can always drop on
      // a canvas block (no parent/child cycle to worry about).
      if (monitor.getItemType() === LIBRARY_COMPONENT_DND_TYPE) {
        return true;
      }
      // Permitir drop en el mismo elemento para que funcione correctamente el hover
      // pero la lógica de movimiento se maneja en la función drop
      return !isChildOf({ targetId: blockId, draggedId: item.blockId });
    },
    collect: (monitor) => ({
      isOver: monitor.canDrop() ? monitor.isOver({ shallow: true }) : false,
    }),
    hover: (item: any, monitor) => {
      // Library-component hover only paints the up/down indicator —
      // there's no source block to suppress.
      if (monitor.getItemType() === LIBRARY_COMPONENT_DND_TYPE) {
        if (!monitor.canDrop() || !monitor.isOver({ shallow: true })) {
          setDropPosition(null);
          return;
        }
        const position = getPosition(monitor);
        setDropPosition(position ?? null);
        return;
      }

      // Si es el mismo elemento, no mostrar indicadores visuales
      if (item.blockId === blockId) {
        setDropPosition(null);
        return;
      }

      // Evitar hover después de drop
      if (!monitor.canDrop() || !monitor.isOver({ shallow: true })) {
        setDropPosition(null);
        return;
      }

      const position = getPosition(monitor);
      if (!position) {
        setDropPosition(null);
        return;
      }
      setDropPosition(position);
    },
    end: () => {
      setDropPosition(null);
    },
  }));

  useEffect(() => {
    if (!isOver) {
      setDropPosition(null);
    }
  }, [isOver]);

  const InsertIcons = () => {
    return (
      <div
        style={{
          height: '3px',
          background: theme.palette.secondary.main,
          position: 'relative',
          color: theme.palette.secondary.main,
        }}
      >
        <svg
          style={{ position: 'absolute', left: '-25px', top: '50%', transform: 'translateY(-50%)' }}
          width="20"
          height="20"
          viewBox="0 0 32 32"
        >
          <path
            fill="currentColor"
            d="M28 12H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M10 4v6h18V4zm18 26H10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2m-18-8v6h18v-6zm-1-6l-5.586-5.586L2 11.828L6.172 16L2 20.172l1.414 1.414z"
          />
        </svg>
        <svg
          style={{
            position: 'absolute',
            right: '-25px',
            top: '50%',
            transform: 'translateY(-50%) scaleX(-1)',
          }}
          width="20"
          height="20"
          viewBox="0 0 32 32"
        >
          <path
            fill="currentColor"
            d="M28 12H10a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2M10 4v6h18V4zm18 26H10a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2m-18-8v6h18v-6zm-1-6l-5.586-5.586L2 11.828L6.172 16L2 20.172l1.414 1.414z"
          />
        </svg>
      </div>
    );
  };

  const dragResult = useDrag(
    () => ({
      type: 'block',
      item: () => {
        const editingId = editorStateStore.getState().notionTextInlineEditingBlockId;
        if (editingId) {
          window.dispatchEvent(
            new CustomEvent('notion-text-force-save', { detail: { blockId: editingId } }),
          );
        }
        return { blockId };
      },
      canDrag: !isDragDisabled,
      collect: (monitor) => ({
        borderDrag: monitor.isDragging() ? '2px dotted yellow' : '',
        isDragging: monitor.isDragging(),
      }),
      end: () => {
        setDragStartTime(Date.now());
      },
    }),
    [isDragDisabled, blockId],
  );

  const [{ borderDrag = '', isDragging }, dragRef] = dragResult || [
    { borderDrag: '', isDragging: false },
    React.useRef(null),
  ];

  // Barra: prioridad al bloque con hover global; si no hay hover, la del seleccionado.
  const showDragHandle =
    canEdit &&
    selectedMainTab !== 'preview' &&
    !isDragDisabled &&
    !isInFocusedEditingMode &&
    (isDragging ||
      canvasHoveredBlockId === blockId ||
      (canvasHoveredBlockId == null && isSelected));

  useEffect(() => {
    wrapperMountedRef.current = true;
    return () => {
      wrapperMountedRef.current = false;
      clearPendingCanvasHoverApplyIfForBlock(blockId);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = null;
      }
      if (editorStateStore.getState().canvasHoveredBlockId === blockId) {
        setCanvasHoveredBlockId(null);
      }
    };
  }, [blockId]);

  // Función mejorada para manejar clicks
  const handleWrapperClick = (ev: React.MouseEvent) => {
    // Si estamos arrastrando o acabamos de terminar un drag (dentro de 200ms), no procesar el click
    const timeSinceDragEnd = Date.now() - dragStartTime;
    if (isDragging || (dragStartTime > 0 && timeSinceDragEnd < 200)) {
      return;
    }

    ev.stopPropagation();
    // REMOVIDO: ev.preventDefault() — interfiere con focus management de MUI en Windows

    if (selectedMainTab !== 'preview') {
      if (blockType === 'NotionText') {
        const customEvent = new CustomEvent<boolean>('email-builder-highlight-editor', {
          detail: true,
        });
        window.dispatchEvent(customEvent);
      }
      setSelectedBlockId(blockId);
    }
  };

  // Memoizar children mejorados para evitar recreación en cada render
  const enhancedChildren = React.useMemo(() => {
    return React.cloneElement(children, {
      // Preservar eventos de click de los hijos
      onClick: (ev: React.MouseEvent) => {
        // Llamar al onClick original del hijo si existe
        if (children.props.onClick) {
          children.props.onClick(ev);
        }

        // Si el hijo no previno la propagación, permitir que el wrapper maneje el evento
        if (!ev.defaultPrevented && !ev.isPropagationStopped()) {
          // Solo procesar si no estamos en estado de drag
          if (!isDragging) {
            handleWrapperClick(ev);
          }
        }
      },
      // Preservar otros eventos que puedan ser importantes
      onMouseDown: (ev: React.MouseEvent) => {
        if (children.props.onMouseDown) {
          children.props.onMouseDown(ev);
        }
      },
      onMouseUp: (ev: React.MouseEvent) => {
        if (children.props.onMouseUp) {
          children.props.onMouseUp(ev);
        }
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- clones children with merged handlers; handleWrapperClick is stable and intentionally excluded to avoid re-cloning every render
  }, [children, isDragging, blockId, blockType, selectedMainTab]);

  return (
    <>
      {dropPosition === 'up' && <InsertIcons />}

      <div
        ref={topRef}
        style={{
          width: '100%',
        }}
      />

      <Box
        data-block-id={blockId}
        sx={{
          position: 'relative',
          maxWidth: '100%',
        }}
        ref={drop as unknown as React.Ref<HTMLDivElement>}
        onMouseEnter={(ev) => {
          ev.stopPropagation();
          clearPendingCanvasHoverApply();
          if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
          }
          const delayMs = getHoverDelayMsForElement(ev.currentTarget as Element);
          scheduleCanvasHoverApply(
            blockId,
            delayMs,
            () => wrapperMountedRef.current,
            () => setMouseInside(true),
          );
        }}
        onMouseLeave={(ev) => {
          clearPendingCanvasHoverApplyIfForBlock(blockId);
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
          const related = ev.relatedTarget;
          hoverTimeoutRef.current = setTimeout(() => {
            setMouseInside(false);
            if (editorStateStore.getState().canvasHoveredBlockId !== blockId) {
              return;
            }
            const nextId = resolveCanvasHoverTargetFromRelatedTarget(related);
            if (nextId && nextId !== blockId) {
              setCanvasHoveredBlockId(nextId);
            } else {
              setCanvasHoveredBlockId(null);
            }
          }, 150);
        }}
        onClick={handleWrapperClick}
      >
        <Box
          sx={{
            position: 'relative',
            maxWidth: '100%',
            outlineOffset: '-1px',
            outline,
            zIndex: zIndexEditable,
            transition: 'outline 0.2s ease-in-out, z-index 0.2s ease-in-out',
          }}
        >
          {renderMenu()}

          {showDragHandle ? (
            <Box
              sx={{
                position: 'absolute',
                left: '50%',
                top: -20,
                transform: 'translateX(-50%)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                borderRadius: '6px 6px 0 0',
                overflow: 'hidden',
                backgroundColor:
                  isThisBlockEditing && canEdit
                    ? editingHighlightColor
                    : theme.palette.secondary.main,
              }}
            >
              {/* Botón: Drag handle */}
              <Tooltip title={t('editor.dragBlockHandle')} placement="top">
                <IconButton
                  ref={dragRef as unknown as React.Ref<HTMLButtonElement>}
                  type="button"
                  aria-label={t('editor.dragBlockHandle')}
                  size="small"
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    padding: '3px 6px',
                    rotate: '90deg',
                    borderRadius: 0,
                    color: 'white',
                    cursor: isDragging ? 'grabbing' : 'grab',
                    // Touch DnD: let the handle start a drag on touch
                    // instead of scrolling the canvas. Desktop unaffected.
                    touchAction: 'none',
                    '&:hover': {
                      backgroundColor: 'rgba(255,255,255,0.15)',
                    },
                  }}
                >
                  <DragIndicatorIcon sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Box>
          ) : null}

          {/* Badge "Editing..." con animación fade */}
          <Fade in={isThisBlockEditing && canEdit} timeout={200}>
            <Chip
              label={t('editor.editing')}
              icon={<EditIconOutlined />}
              size="small"
              sx={{
                position: 'absolute',
                left: -1,
                top: -26,
                backgroundColor: editingHighlightColor,
                color: 'white',
                fontWeight: 600,
                fontSize: '0.75rem',
                zIndex: -1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                '& .MuiChip-icon': {
                  color: 'white',
                  fontSize: '1rem',
                },
              }}
            />
          </Fade>

          <div
            style={{
              border: borderDrag,
            }}
          >
            {enhancedChildren}
          </div>
        </Box>
      </Box>
      {dropPosition === 'down' && <InsertIcons />}

      <div
        ref={bottomRef}
        style={{
          width: '100%',
        }}
      />
    </>
  );
}

// Memoizar con comparación personalizada para evitar re-renders innecesarios
const EditorBlockWrapper = memo(EditorBlockWrapperInner, (prevProps, nextProps) => {
  // Solo re-renderizar si:
  // 1. Los children cambiaron (comparación por referencia es suficiente gracias a memo en EditorBlock)
  // 2. canEdit cambió
  // 3. isNotClient cambió
  return (
    prevProps.children === nextProps.children &&
    prevProps.canEdit === nextProps.canEdit &&
    prevProps.isNotClient === nextProps.isNotClient
  );
});

export default EditorBlockWrapper;
