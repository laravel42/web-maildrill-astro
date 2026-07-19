import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatListBulleted, FormatListNumbered } from '@mui/icons-material';
import { List, ListItemButton, ListItemIcon, ListItemText, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

export default function ListDropdown({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const toggleList = useCallback(
    (listType: 'bullet' | 'ordered') => {
      requestAnimationFrame(() => {
        if (listType === 'bullet') {
          editor.chain().focus().toggleBulletList().run();
        } else {
          editor.chain().focus().toggleOrderedList().run();
        }
      });
      handleClose();
    },
    [editor, handleClose]
  );

  const isActive = editor.isActive('bulletList') || editor.isActive('orderedList');

  const getCurrentIcon = () => {
    const iconColor = theme.palette.text.secondary;
    if (editor.isActive('orderedList')) return <FormatListNumbered fontSize="small" sx={{ color: iconColor }} />;
    return <FormatListBulleted fontSize="small" sx={{ color: iconColor }} />;
  };

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.lists')} active={isActive} onClick={handleClick} showArrow>
        {getCurrentIcon()}
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={{ p: '8px 4px' }}>
          <ListItemButton
            onClick={() => toggleList('bullet')}
            selected={editor.isActive('bulletList')}
            sx={{
              p: '8px 10px',
              borderRadius: '6px',
              backgroundColor: editor.isActive('bulletList') ? theme.palette.action.selected : 'transparent',
              '&:hover': { backgroundColor: theme.palette.action.hover },
              transition: 'all 150ms ease',
            }}
          >
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}>
              <FormatListBulleted fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t('bubbleMenu.bulletList')}
              slotProps={{ primary: { sx: { fontSize: '14px', color: theme.palette.text.primary } } }}
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => toggleList('ordered')}
            selected={editor.isActive('orderedList')}
            sx={{
              p: '8px 10px',
              borderRadius: '6px',
              backgroundColor: editor.isActive('orderedList') ? theme.palette.action.selected : 'transparent',
              '&:hover': { backgroundColor: theme.palette.action.hover },
              transition: 'all 150ms ease',
            }}
          >
            <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}>
              <FormatListNumbered fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t('bubbleMenu.numberedList')}
              slotProps={{ primary: { sx: { fontSize: '14px', color: theme.palette.text.primary } } }}
            />
          </ListItemButton>
        </List>
      </ToolbarPopover>
    </>
  );
}
