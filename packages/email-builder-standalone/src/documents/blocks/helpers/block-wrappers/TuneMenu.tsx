import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ContentCopy as ContentCopyIcon } from '@mui/icons-material';
import BookmarkAddOutlined from '@mui/icons-material/BookmarkAddOutlined';
import { IconButton, Paper, Tooltip } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

import SaveSubtreeDialog from '../../../../App/ComponentsLibrary/SaveSubtreeDialog';
import { classifyBlockSubtree } from '../../../editor/classifyBlockSubtree';
import { TEditorBlock } from '../../../editor/core';
import {
  duplicateBlock,
  editorStateStore,
  setDocument,
  setNotionTextInlineEditingBlockId,
  setSelectedBlockId,
  useBlock,
  useComponentsStorageMode,
  useDevMode,
} from '../../../editor/EditorContext';

/** Clearance the strip keeps from the top of the canvas viewport. */
const MENU_EDGE_GAP = 8;

const getSx =
  (positionBelow: boolean, alignBottom: boolean): SxProps<Theme> =>
  (theme) => ({
    position: 'absolute',
    ...(positionBelow
      ? {
          top: '100%',
          right: 0,
          marginTop: '8px',
          flexDirection: 'row',
          width: 'auto',
        }
      : {
          // Bottom-aligned with the block rather than top-aligned: the strip is
          // taller than a short block, and hanging off the bottom put it level
          // with the inline-text format bar that opens under the block. Blocks
          // near the top of the canvas fall back to top-aligned, otherwise the
          // overhang disappears behind the editor's toolbar.
          ...(alignBottom ? { bottom: 0 } : { top: 0 }),
          right: '-3rem',
          flexDirection: 'column',
          width: '2.5rem',
        }),
    borderRadius: '8px!important',
    zIndex: '90 !important;',
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.1)',
    border: '1px solid',
    borderColor: theme.palette.secondary.main,
    padding: '1px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  });

type Props = {
  blockId: string;
};

// Estado global para el formato copiado
let copiedFormat: { styles: any; blockType: string } | null = null;

function TuneMenuInner({ blockId }: Props) {
  const currentBlock = useBlock(blockId) as TEditorBlock;
  const { t } = useTranslation('inspector');
  const { t: tEditor } = useTranslation();
  const devMode = useDevMode();
  const componentsStorageMode = useComponentsStorageMode();
  // Per-block Save targets Sections / Primitives / Layouts, which are
  // backend-only. Hide it in local storage mode (Templates + Themes only).
  const canSaveSubtree = devMode && componentsStorageMode !== 'local';
  // Dev-only Components Library save entry point.
  //
  // Sections-only save (library-first-block-insertion plan): the
  // button is enabled only when the block's subtree classifies as a
  // Section (Container/ColumnsContainer with at least one non-structural
  // descendant). Primitive/Layout classifications no longer have a save
  // path — `classifyBlockSubtree` is kept for this check (and future
  // callers) but `SaveSubtreeDialog` itself now only ever POSTs
  // Sections. Templates have their own entry point in the inspector "no
  // block selected" view — so the Save button stays disabled when the
  // current block is the EmailLayout `root`. The legacy "Manage"
  // (folder) icon was removed: the persistent drawer covers list /
  // rename / delete UX now.
  const [saveComponentOpen, setSaveComponentOpen] = useState(false);
  const canSaveComponent = useMemo(() => {
    if (!currentBlock || currentBlock.type === 'EmailLayout') return false;
    try {
      const document = editorStateStore.getState().document;
      return classifyBlockSubtree(blockId, document) === 'section';
    } catch {
      return false;
    }
  }, [currentBlock, blockId]);
  // Verificar si hay formato copiado y si es compatible
  const canPasteFormat = copiedFormat && copiedFormat.blockType === currentBlock?.type;
  const menuRef = useRef<HTMLDivElement>(null);
  const [positionBelow, setPositionBelow] = useState(false);
  const [alignBottom, setAlignBottom] = useState(true);

  useEffect(() => {
    const checkPosition = () => {
      if (!menuRef.current) return;

      const menuElement = menuRef.current;
      const blockElement = menuElement.parentElement;
      if (!blockElement) return;

      const blockRect = blockElement.getBoundingClientRect();
      const containerElement = blockElement.closest('.preview-container');
      if (!containerElement) return;

      const containerRect = containerElement.getBoundingClientRect();
      const spaceRight = containerRect.right - blockRect.right;
      const menuWidth = 48; // 2.5rem = 40px + margen

      // Si no hay suficiente espacio a la derecha, posicionar debajo
      if (spaceRight < menuWidth) {
        setPositionBelow(true);
      } else {
        setPositionBelow(false);
      }

      // Bottom-aligning a strip taller than the room above the block's bottom
      // edge would run it up under the editor toolbar, so top-align instead.
      const roomAbove = blockRect.bottom - containerRect.top;
      setAlignBottom(roomAbove >= menuElement.offsetHeight + MENU_EDGE_GAP);
    };

    checkPosition();
    window.addEventListener('resize', checkPosition);
    window.addEventListener('scroll', checkPosition, true);

    // Revisar después de un pequeño delay para asegurar que el DOM esté actualizado
    const timeoutId = setTimeout(checkPosition, 100);

    return () => {
      window.removeEventListener('resize', checkPosition);
      window.removeEventListener('scroll', checkPosition, true);
      clearTimeout(timeoutId);
    };
  }, [blockId]);

  const handleDeleteClick = useCallback(() => {
    const document = editorStateStore.getState().document;
    const currentEditingId = editorStateStore.getState().notionTextInlineEditingBlockId;

    const collectNestedChildrenIds = (
      id: string,
      doc: typeof document,
      collected = new Set<string>(),
    ) => {
      if (collected.has(id)) return; // evitar ciclos
      collected.add(id);
      const block = doc[id] as TEditorBlock;

      if (!block) return;

      if (block.type === 'Container') {
        const children = block.data?.props?.childrenIds || [];
        children.forEach((childId) => collectNestedChildrenIds(childId, doc, collected));
      }

      if (block.type === 'ColumnsContainer') {
        const columns = block.data?.props?.columns || [];
        columns.forEach((col: any) => {
          (col.childrenIds || []).forEach((childId: string) =>
            collectNestedChildrenIds(childId, doc, collected),
          );
        });
      }
    };

    // Recolecta todos los bloques a eliminar (incluido el bloque principal)
    const blocksToDelete = new Set<string>();
    collectNestedChildrenIds(blockId, document, blocksToDelete);
    blocksToDelete.add(blockId);

    const filterChildrenIds = (childrenIds: string[] | null | undefined) => {
      if (!childrenIds) return childrenIds;
      return childrenIds.filter((id) => !blocksToDelete.has(id));
    };

    const nDocument: typeof document = { ...document };

    for (const [id, b] of Object.entries(nDocument)) {
      if (blocksToDelete.has(id)) continue;

      const block = b as TEditorBlock;

      switch (block.type) {
        case 'EmailLayout':
          nDocument[id] = {
            ...block,
            data: {
              ...block.data,
              childrenIds: filterChildrenIds(block.data.childrenIds),
            },
          } as TEditorBlock;
          break;
        case 'Container':
          nDocument[id] = {
            ...block,
            data: {
              ...block.data,
              props: {
                ...block.data.props,
                childrenIds: filterChildrenIds(block.data.props?.childrenIds),
              },
            },
          } as TEditorBlock;
          break;
        case 'ColumnsContainer':
          nDocument[id] = {
            ...block,
            data: {
              ...block.data,
              props: {
                ...block.data.props,
                columns: block.data.props?.columns?.map((col: any) => ({
                  ...col,
                  childrenIds: filterChildrenIds(col.childrenIds),
                })),
              },
            },
          } as TEditorBlock;
          break;
        default:
          nDocument[id] = block;
      }
    }

    // Elimina todos los bloques recolectados
    for (const id of blocksToDelete) {
      delete nDocument[id];
    }

    // Limpiar estado de edición inline si el bloque eliminado estaba editándose
    if (
      currentEditingId &&
      (currentEditingId === blockId || blocksToDelete.has(currentEditingId))
    ) {
      setNotionTextInlineEditingBlockId(null);
    }

    setDocument(nDocument);
    setSelectedBlockId(null);
  }, [blockId]);

  const handleCopyFormat = useCallback(() => {
    if (currentBlock && 'style' in currentBlock.data && currentBlock.data.style) {
      copiedFormat = {
        styles: JSON.parse(JSON.stringify(currentBlock.data.style)),
        blockType: currentBlock.type,
      };
    }
  }, [currentBlock]);

  const handlePasteFormat = useCallback(() => {
    const document = editorStateStore.getState().document;
    if (!copiedFormat || copiedFormat.blockType !== currentBlock?.type) {
      return;
    }

    const nDocument: typeof document = { ...document };
    const targetBlock = nDocument[blockId] as TEditorBlock;

    if (targetBlock) {
      nDocument[blockId] = {
        ...targetBlock,
        data: {
          ...targetBlock.data,
          style: JSON.parse(JSON.stringify(copiedFormat.styles)),
        },
      } as TEditorBlock;
      setDocument(nDocument);
      setSelectedBlockId(blockId);
    }
  }, [blockId, currentBlock]);

  const handleDuplicateBlock = useCallback(() => {
    duplicateBlock(blockId);
  }, [blockId]);

  return (
    <>
      <Paper
        ref={menuRef}
        sx={getSx(positionBelow, alignBottom)}
        onClick={(ev) => ev.stopPropagation()}
        elevation={10}
      >
        <Tooltip title={t('actions.copyFormat')} placement="left-start">
          <span>
            <IconButton
              onClick={handleCopyFormat}
              sx={{
                padding: '4px',
                overflow: 'hidden',
                color: 'text.primary',
              }}
              disabled={!(currentBlock && 'style' in currentBlock.data && currentBlock.data.style)}
            >
              <svg
                width="24"
                height="25"
                viewBox="0 0 24 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 22.5C6.49 22.5 2 18.01 2 12.5C2 6.99 6.49 2.5 12 2.5C17.51 2.5 22 6.54 22 11.5C22 14.81 19.31 17.5 16 17.5H14.23C13.95 17.5 13.73 17.72 13.73 18C13.73 18.12 13.78 18.23 13.86 18.33C14.27 18.8 14.5 19.39 14.5 20C14.5 21.38 13.38 22.5 12 22.5ZM12 4.5C7.59 4.5 4 8.09 4 12.5C4 16.91 7.59 20.5 12 20.5C12.28 20.5 12.5 20.28 12.5 20C12.5 19.84 12.42 19.72 12.36 19.65C11.95 19.19 11.73 18.6 11.73 18C11.73 16.62 12.85 15.5 14.23 15.5H16C18.21 15.5 20 13.71 20 11.5C20 7.64 16.41 4.5 12 4.5Z"
                  fill="currentColor"
                />
                <path
                  d="M6.5 13.5C7.32843 13.5 8 12.8284 8 12C8 11.1716 7.32843 10.5 6.5 10.5C5.67157 10.5 5 11.1716 5 12C5 12.8284 5.67157 13.5 6.5 13.5Z"
                  fill="currentColor"
                />
                <path
                  d="M9.5 9.5C10.3284 9.5 11 8.82843 11 8C11 7.17157 10.3284 6.5 9.5 6.5C8.67157 6.5 8 7.17157 8 8C8 8.82843 8.67157 9.5 9.5 9.5Z"
                  fill="currentColor"
                />
                <path
                  d="M14.5 9.5C15.3284 9.5 16 8.82843 16 8C16 7.17157 15.3284 6.5 14.5 6.5C13.6716 6.5 13 7.17157 13 8C13 8.82843 13.6716 9.5 14.5 9.5Z"
                  fill="currentColor"
                />
                <path
                  d="M17.5 13.5C18.3284 13.5 19 12.8284 19 12C19 11.1716 18.3284 10.5 17.5 10.5C16.6716 10.5 16 11.1716 16 12C16 12.8284 16.6716 13.5 17.5 13.5Z"
                  fill="currentColor"
                />
              </svg>
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip
          title={canPasteFormat ? t('actions.pasteFormatting') : t('actions.noFormatSupported')}
          placement="left-start"
        >
          <span>
            <IconButton
              onClick={handlePasteFormat}
              sx={{
                padding: '4px',
                overflow: 'hidden',
                color: canPasteFormat ? 'text.primary' : 'text.disabled',
              }}
              disabled={!canPasteFormat}
            >
              <svg
                width="24"
                height="25"
                viewBox="0 0 24 25"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M10.9551 22.6497C10.5139 22.6497 10.1287 22.4888 9.79934 22.167C9.47017 21.8451 9.30559 21.4582 9.30559 21.0062V16.1317H5.54784C5.09367 16.1317 4.69725 15.9624 4.35859 15.6237C4.01992 15.2851 3.85059 14.8886 3.85059 14.4345V7.10448C3.85059 6.07631 4.21 5.19264 4.92884 4.45348C5.6475 3.71431 6.52667 3.34473 7.56634 3.34473H19.2978C19.5378 3.34473 19.7408 3.42773 19.9066 3.59373C20.0726 3.75956 20.1556 3.96248 20.1556 4.20248V14.4345C20.1556 14.8886 19.9871 15.2851 19.6501 15.6237C19.3131 15.9624 18.9138 16.1317 18.4523 16.1317H14.7006V21.0062C14.7006 21.4582 14.536 21.8451 14.2068 22.167C13.8775 22.4888 13.4923 22.6497 13.0511 22.6497H10.9551ZM5.54784 10.6145H18.4523V5.04798H17.0463V8.41773C17.0463 8.63189 16.9744 8.81139 16.8306 8.95623C16.6869 9.10106 16.5063 9.17348 16.2888 9.17348C16.0715 9.17348 15.8924 9.10106 15.7516 8.95623C15.6108 8.81139 15.5403 8.63189 15.5403 8.41773V5.04798H13.7533V6.40148C13.7533 6.61814 13.6815 6.79789 13.5378 6.94073C13.394 7.08373 13.2134 7.15523 12.9961 7.15523C12.7786 7.15523 12.5994 7.08373 12.4586 6.94073C12.3178 6.79789 12.2473 6.61814 12.2473 6.40148V5.04798H7.56634C6.97717 5.04798 6.4935 5.24764 6.11534 5.64698C5.737 6.04631 5.54784 6.53214 5.54784 7.10448V10.6145ZM5.54784 14.4345H18.4523V12.0965H5.54784V14.4345Z"
                  fill="currentColor"
                />
              </svg>
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={tEditor('editor.cloneBlock')} placement="left-start">
          <IconButton
            onClick={handleDuplicateBlock}
            sx={{
              padding: '4px',
              overflow: 'hidden',
              color: 'text.primary',
            }}
          >
            <ContentCopyIcon sx={{ fontSize: '1.25rem' }} />
          </IconButton>
        </Tooltip>

        <Tooltip title={t('actions.delete')} placement="left-start">
          <IconButton
            onClick={handleDeleteClick}
            sx={{
              overflow: 'hidden',
              color: 'error.main',
              padding: '4px',
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="25"
              viewBox="0 0 24 25"
              fill="none"
            >
              <path
                d="M16 9.5V19.5H8V9.5H16ZM14.5 3.5H9.5L8.5 4.5H5V6.5H19V4.5H15.5L14.5 3.5ZM18 7.5H6V19.5C6 20.6 6.9 21.5 8 21.5H16C17.1 21.5 18 20.6 18 19.5V7.5Z"
                fill="currentColor"
              />
            </svg>
          </IconButton>
        </Tooltip>

        {canSaveSubtree && (
          <Tooltip title={t('componentsLibrary.save.tooltip')} placement="left-start">
            <span>
              <IconButton
                onClick={() => setSaveComponentOpen(true)}
                disabled={!canSaveComponent}
                sx={{
                  padding: '4px',
                  overflow: 'hidden',
                  color: canSaveComponent ? 'text.primary' : 'text.disabled',
                }}
                aria-label={t('componentsLibrary.save.button')}
              >
                <BookmarkAddOutlined sx={{ fontSize: '1.25rem' }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Paper>
      {canSaveSubtree && saveComponentOpen && canSaveComponent && (
        <SaveSubtreeDialog
          open={saveComponentOpen}
          rootBlockId={blockId}
          onClose={() => setSaveComponentOpen(false)}
        />
      )}
    </>
  );
}

// Memoizar para evitar re-renders innecesarios
const TuneMenu = memo(TuneMenuInner);
export default TuneMenu;
