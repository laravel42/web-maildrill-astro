import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatListBulleted, FormatListNumbered } from '@mui/icons-material';
import { List, ListItemButton, ListItemIcon, ListItemText, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import {
  MENU_ICON_SX,
  MENU_ITEM_SX,
  MENU_ITEM_TEXT_SX,
  MENU_LABEL_SX,
  MENU_LIST_SX,
} from './menu-skin';
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
    [editor, handleClose],
  );

  const isActive = editor.isActive('bulletList') || editor.isActive('orderedList');

  const getCurrentIcon = () => {
    const iconColor = theme.palette.text.secondary;
    if (editor.isActive('orderedList'))
      return <FormatListNumbered fontSize="small" sx={{ color: iconColor }} />;
    return <FormatListBulleted fontSize="small" sx={{ color: iconColor }} />;
  };

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.lists')}
        active={isActive}
        onClick={handleClick}
        showArrow
      >
        {getCurrentIcon()}
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={MENU_LIST_SX}>
          <ListItemButton
            onClick={() => toggleList('bullet')}
            selected={editor.isActive('bulletList')}
            sx={MENU_ITEM_SX}
          >
            <ListItemIcon sx={MENU_ICON_SX}>
              <FormatListBulleted fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t('bubbleMenu.bulletList')}
              sx={MENU_ITEM_TEXT_SX}
              slotProps={{ primary: { sx: MENU_LABEL_SX } }}
            />
          </ListItemButton>
          <ListItemButton
            onClick={() => toggleList('ordered')}
            selected={editor.isActive('orderedList')}
            sx={MENU_ITEM_SX}
          >
            <ListItemIcon sx={MENU_ICON_SX}>
              <FormatListNumbered fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={t('bubbleMenu.numberedList')}
              sx={MENU_ITEM_TEXT_SX}
              slotProps={{ primary: { sx: MENU_LABEL_SX } }}
            />
          </ListItemButton>
        </List>
      </ToolbarPopover>
    </>
  );
}
