import React from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useTranslation } from 'react-i18next';

import {
  ArticleOutlined,
  Close,
  CodeOutlined,
  Crop32Outlined,
  DashboardOutlined,
  Groups2,
  HorizontalRuleOutlined,
  ImageOutlined,
  LibraryAddOutlined,
  SmartButtonOutlined,
  TextFieldsOutlined,
  Title,
  ViewColumnOutlined,
  WidgetsOutlined,
} from '@mui/icons-material';
import { Box, ClickAwayListener, Grow, IconButton, Paper, Popper, Typography } from '@mui/material';

import {
  changeBlockPosition,
  editorStateStore,
  isChildOf,
  setSelectedBlockId,
  toggleComponentTree,
  useComponentTreeOpen,
} from '../../documents/editor/EditorContext';
import {
  isSelectedBlockInColumnsSlot,
  selectBlockTree,
  type TreeNode,
  useBlockSelector,
} from '../../documents/editor/granular';

import {
  Columns2TreeIcon,
  ColumnsTreeIcon,
  type ColumnTreeIconComponent,
  selectSlotColumnIconComponent,
} from './ComponentTreeColumnIcons';

type IconComponentType = React.ComponentType<{
  fontSize?: 'small' | 'inherit';
  sx?: any;
}>;

const ICON_MAP: Record<string, IconComponentType> = {
  ArticleOutlined,
  CodeOutlined,
  Crop32Outlined,
  DashboardOutlined,
  Groups2,
  HorizontalRuleOutlined,
  ImageOutlined,
  LibraryAddOutlined,
  SmartButtonOutlined,
  TextFieldsOutlined,
  Title,
  ViewColumnOutlined,
  WidgetsOutlined,
};

/** True if `selectedId` is this node or any descendant block in the tree subtree. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function subtreeContainsSelectedBlock(node: TreeNode, selectedId: string | null): boolean {
  if (!selectedId) return false;
  for (const child of node.children) {
    if (child.blockId === selectedId) return true;
    if (subtreeContainsSelectedBlock(child, selectedId)) return true;
  }
  return false;
}

function columnTreeIconColor(theme: any, active: boolean, darkMode: boolean) {
  return active ? theme.palette.primary.main : darkMode ? theme.palette.text.primary : theme.palette.text.secondary;
}

function ComponentTreeColumnIconFrame({
  Icon,
  active,
  darkMode,
  width = 20,
  height = 20,
}: {
  Icon: ColumnTreeIconComponent;
  active: boolean;
  darkMode: boolean;
  width?: number;
  height?: number;
}) {
  return (
    <Icon
      aria-hidden
      sx={(theme) => ({
        width,
        height,
        flexShrink: 0,
        display: 'block',
        color: columnTreeIconColor(theme, active, darkMode),
      })}
    />
  );
}

/** Fixed slot so column/layout SVGs align with MUI icons and `body2` label. */
const TREE_ROW_ICON_SLOT_SX = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  flexShrink: 0,
} as const;

/** Row icon for the columns container block (2- or 3-column layout). */
function ComponentTreeColumnsContainerIcon({
  columnsCount,
  active,
  darkMode,
}: {
  columnsCount: 2 | 3;
  active: boolean;
  darkMode: boolean;
}) {
  if (columnsCount === 3) {
    return <ComponentTreeColumnIconFrame Icon={ColumnsTreeIcon} active={active} darkMode={darkMode} />;
  }
  return <ComponentTreeColumnIconFrame Icon={Columns2TreeIcon} active={active} darkMode={darkMode} />;
}

function scrollToBlock(blockId: string) {
  const el = document.querySelector(`[data-block-id="${blockId}"]`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function TreeRow({
  node,
  selectedBlockId,
  onSelect,
}: {
  node: TreeNode;
  selectedBlockId: string | null;
  onSelect: (blockId: string) => void;
}) {
  const { t } = useTranslation('inspector');
  const IconComponent = ICON_MAP[node.iconName] ?? WidgetsOutlined;
  const selectionId = node.columnSlot?.parentBlockId ?? node.blockId;
  const isSelected = selectedBlockId === selectionId;
  const columnSlotParentId = node.columnSlot?.parentBlockId;
  const columnSlotIndex = node.columnSlot?.columnIndex;
  const columnContainsSelection = editorStateStore(
    React.useMemo(
      () => (s: { document: any; selectedBlockId: string | null }) =>
        columnSlotParentId !== undefined && columnSlotIndex !== undefined
          ? isSelectedBlockInColumnsSlot(s.document, columnSlotParentId, columnSlotIndex, s.selectedBlockId)
          : false,
      [columnSlotParentId, columnSlotIndex]
    )
  );
  const darkMode = editorStateStore((s) => s.darkMode);
  const [dropPosition, setDropPosition] = React.useState<'up' | 'down' | null>(null);
  const ref = React.useRef<HTMLDivElement | null>(null);

  const getPosition = (monitor: any): 'up' | 'down' | null => {
    const clientOffset = monitor.getClientOffset();
    const rect = ref.current?.getBoundingClientRect();

    if (!clientOffset || !rect) {
      return null;
    }

    const hoverMiddleY = (rect.bottom - rect.top) / 2;
    const hoverClientY = clientOffset.y - rect.top;

    return hoverClientY < hoverMiddleY ? 'up' : 'down';
  };

  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'block',
    drop: (item: any, monitor) => {
      const actualId = node.blockId;
      const draggedId = item.blockId;

      if (actualId === draggedId) {
        return;
      }

      if (monitor.didDrop()) {
        return;
      }

      const position = getPosition(monitor) ?? 'down';

      changeBlockPosition(actualId, draggedId, position);
    },
    canDrop: (item: any) => {
      const targetId = node.columnSlot?.parentBlockId ?? node.blockId;
      return !isChildOf({ targetId, draggedId: item.blockId });
    },
    collect: (monitor) => ({
      isOver: monitor.canDrop() ? monitor.isOver({ shallow: true }) : false,
    }),
    hover: (item: any, monitor) => {
      if (item.blockId === node.blockId) {
        setDropPosition(null);
        return;
      }

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

  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'block',
    item: { blockId: node.blockId },
    canDrag: !node.columnSlot,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  React.useEffect(() => {
    if (!isOver) {
      setDropPosition(null);
    }
  }, [isOver]);

  const setRefs = (el: HTMLDivElement | null) => {
    ref.current = el;
    if (el) {
      drag(drop(el));
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.columnSlot) {
      onSelect(node.columnSlot.parentBlockId);
      scrollToBlock(node.columnSlot.parentBlockId);
      return;
    }
    if (node.type === 'NotionText') {
      window.dispatchEvent(new CustomEvent<boolean>('email-builder-highlight-editor', { detail: true }));
    }
    onSelect(node.blockId);
    scrollToBlock(node.blockId);
  };

  const columnSlot = node.columnSlot;

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        ref={setRefs}
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          py: 0.5,
          px: 1,
          pl: 1 + (node.depth - 1) * 2,
          cursor: 'pointer',
          backgroundColor: isSelected ? 'action.selected' : isOver ? 'action.hover' : 'transparent',
          borderLeftWidth: 3,
          borderLeftStyle: 'solid',
          borderLeftColor: isSelected || (node.columnSlot && columnContainsSelection) ? 'primary.main' : 'transparent',
          borderTop: dropPosition === 'up' ? 2 : 0,
          borderTopColor: 'primary.main',
          borderBottom: dropPosition === 'down' ? 2 : 0,
          borderBottomColor: 'primary.main',
          opacity: isDragging ? 0.6 : 1,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <Box sx={TREE_ROW_ICON_SLOT_SX}>
          {columnSlot ? (
            <ComponentTreeColumnIconFrame
              Icon={selectSlotColumnIconComponent(columnSlot.columnsCount, columnSlot.columnIndex)}
              active={isSelected || columnContainsSelection}
              darkMode={darkMode}
            />
          ) : node.type === 'ColumnsContainer' ? (
            <ComponentTreeColumnsContainerIcon
              columnsCount={(node.children.length === 2 ? 2 : 3) as 2 | 3}
              active={isSelected}
              darkMode={darkMode}
            />
          ) : (
            <IconComponent
              fontSize="small"
              sx={(theme) => ({
                color: isSelected
                  ? theme.palette.primary.main
                  : darkMode
                    ? theme.palette.text.primary
                    : theme.palette.text.secondary,
                flexShrink: 0,
                display: 'block',
              })}
            />
          )}
        </Box>
        <Typography
          variant="body2"
          noWrap
          sx={(theme) => ({
            flex: 1,
            minWidth: 0,
            fontWeight: isSelected || (node.columnSlot && columnContainsSelection) ? 600 : 400,
            ...(node.columnSlot &&
              !isSelected && {
                color: columnContainsSelection ? theme.palette.primary.main : theme.palette.text.secondary,
              }),
          })}
        >
          {node.columnSlot ? t('header.componentTreeColumn', { n: node.columnSlot.columnIndex + 1 }) : node.label}
        </Typography>
      </Box>
      {node.children.map((child) => (
        <TreeRow key={child.blockId} node={child} selectedBlockId={selectedBlockId} onSelect={onSelect} />
      ))}
    </Box>
  );
}

export default function ComponentTreePanel() {
  const { t } = useTranslation('inspector');
  const tree = useBlockSelector(selectBlockTree);
  const selectedBlockId = editorStateStore((s) => s.selectedBlockId);
  const componentTreeOpen = useComponentTreeOpen();
  const anchorEl =
    typeof document !== 'undefined'
      ? (document.querySelector('[data-component-tree-toggle="true"]') as HTMLElement | null)
      : null;

  const handleClickAway = (event: MouseEvent | TouchEvent) => {
    if (anchorEl && anchorEl.contains(event.target as Node)) {
      return;
    }
    toggleComponentTree();
  };

  if (!tree || !componentTreeOpen || !anchorEl) return null;

  return (
    <Popper
      open={componentTreeOpen}
      anchorEl={anchorEl}
      placement="bottom-end"
      transition
      popperOptions={{ strategy: 'fixed' }}
      sx={{ zIndex: 1300 }}
    >
      {({ TransitionProps }) => (
        <Grow {...TransitionProps} style={{ transformOrigin: 'right top' }}>
          <Paper
            elevation={8}
            sx={{
              width: 260,
              maxHeight: '50vh',
              overflow: 'hidden',
              borderRadius: 2,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 16,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <ClickAwayListener onClickAway={handleClickAway}>
              <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: '50vh' }}>
                <Box
                  sx={{
                    p: 1,
                    pb: 0,
                    borderBottom: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                >
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('header.componentTree', 'Component tree')}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => toggleComponentTree()}
                    aria-label={t('header.closeComponentTree', 'Close component tree')}
                    sx={(theme) => ({
                      color: theme.palette.text.secondary,
                    })}
                  >
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
                <Box
                  sx={{
                    p: 0.5,
                    pb: 2,
                    overflowY: 'auto',
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  {tree.children.map((child) => (
                    <TreeRow
                      key={child.blockId}
                      node={child}
                      selectedBlockId={selectedBlockId}
                      onSelect={(blockId) => setSelectedBlockId(blockId)}
                    />
                  ))}
                </Box>
              </Box>
            </ClickAwayListener>
          </Paper>
        </Grow>
      )}
    </Popper>
  );
}
