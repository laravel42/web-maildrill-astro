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
        <List sx={{ p: '8px 4px' }}>
          {ALIGNMENTS.map((alignment) => {
            const Icon = ALIGN_ICONS[alignment];
            const active = editor.isActive({ textAlign: alignment });
            return (
              <ListItemButton
                key={alignment}
                onClick={() => setAlignment(alignment)}
                selected={active}
                sx={{
                  p: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: active ? theme.palette.action.selected : 'transparent',
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                  transition: 'all 150ms ease',
                }}
              >
                <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={t(ALIGN_KEYS[alignment])}
                  slotProps={{
                    primary: { sx: { fontSize: '14px', color: theme.palette.text.primary } },
                  }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </ToolbarPopover>
    </>
  );
}
