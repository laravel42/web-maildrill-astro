import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  FormatAlignCenter,
  FormatAlignJustify,
  FormatAlignLeft,
  FormatAlignRight,
} from '@mui/icons-material';
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

const ALIGNMENTS = ['left', 'center', 'right', 'justify'] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const ALIGN_ICONS: Record<Alignment, React.ComponentType<{ fontSize?: 'small' }>> = {
  left: FormatAlignLeft,
  center: FormatAlignCenter,
  right: FormatAlignRight,
  justify: FormatAlignJustify,
};

const ALIGN_KEYS: Record<Alignment, string> = {
  left: 'bubbleMenu.alignLeft',
  center: 'bubbleMenu.alignCenter',
  right: 'bubbleMenu.alignRight',
  justify: 'bubbleMenu.alignJustify',
};

export default function AlignDropdown({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const setAlignment = useCallback(
    (alignment: Alignment) => {
      requestAnimationFrame(() => {
        editor.chain().focus().setTextAlign(alignment).run();
      });
      handleClose();
    },
    [editor, handleClose],
  );

  const isActive = ALIGNMENTS.some((a) => a !== 'left' && editor.isActive({ textAlign: a }));

  const getCurrentIcon = () => {
    const iconColor = theme.palette.text.secondary;
    if (editor.isActive({ textAlign: 'center' }))
      return <FormatAlignCenter fontSize="small" sx={{ color: iconColor }} />;
    if (editor.isActive({ textAlign: 'right' }))
      return <FormatAlignRight fontSize="small" sx={{ color: iconColor }} />;
    if (editor.isActive({ textAlign: 'justify' }))
      return <FormatAlignJustify fontSize="small" sx={{ color: iconColor }} />;
    return <FormatAlignLeft fontSize="small" sx={{ color: iconColor }} />;
  };

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.textAlign')}
        active={isActive}
        onClick={handleClick}
        showArrow
      >
        {getCurrentIcon()}
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={MENU_LIST_SX}>
          {ALIGNMENTS.map((alignment) => {
            const Icon = ALIGN_ICONS[alignment];
            return (
              <ListItemButton
                key={alignment}
                onClick={() => setAlignment(alignment)}
                selected={editor.isActive({ textAlign: alignment })}
                sx={MENU_ITEM_SX}
              >
                <ListItemIcon sx={MENU_ICON_SX}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t(ALIGN_KEYS[alignment])}
                  sx={MENU_ITEM_TEXT_SX}
                  slotProps={{ primary: { sx: MENU_LABEL_SX } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </ToolbarPopover>
    </>
  );
}
