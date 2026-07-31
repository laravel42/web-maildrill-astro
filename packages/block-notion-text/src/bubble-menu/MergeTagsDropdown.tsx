import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LocalOffer as TagsIcon } from '@mui/icons-material';
import { Divider, List, ListItemButton, ListItemIcon, ListItemText, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import { getMergeTags } from '../merge-tags-config';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

export default function MergeTagsDropdown({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const mergeTags = getMergeTags();

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const insertTag = useCallback(
    (tag: string) => {
      requestAnimationFrame(() => {
        editor.chain().focus().insertContent(tag).run();
      });
      handleClose();
    },
    [editor, handleClose],
  );

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.insertMergeTag')} onClick={handleClick}>
        <TagsIcon fontSize="small" />
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={{ maxHeight: 400, overflow: 'auto', p: '8px 4px' }}>
          {mergeTags.children.map((tag, idx) => {
            if (tag.type === 'divider') {
              return <Divider key={idx} sx={{ my: 0.5, backgroundColor: theme.palette.divider }} />;
            }

            return (
              <ListItemButton
                key={idx}
                onClick={() => tag.value && insertTag(tag.value)}
                sx={{
                  p: '8px 10px',
                  borderRadius: '6px',
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                  transition: 'all 150ms ease',
                }}
              >
                {tag.icon && (
                  <ListItemIcon
                    sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}
                  >
                    {tag.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={tag.label}
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
