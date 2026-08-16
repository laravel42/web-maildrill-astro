import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DataObject as MergeTagIcon } from '@mui/icons-material';
import { Box, ListItemButton, Typography } from '@mui/material';
import type { Editor } from '@tiptap/react';

import { groupMergeTagsForDisplay } from '../merge-tags-groups';
import { getMergeTags } from '../merge-tags-config';

import {
  MENU_ITEM_SX,
  MENU_LABEL_SX,
  MENU_LIST_SX,
  MENU_SECTION_SX,
  MENU_SUBLABEL_SX,
} from './menu-skin';
import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

export default function MergeTagsDropdown({ editor }: Props) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const mergeTags = getMergeTags();
  const groups = useMemo(
    () => groupMergeTagsForDisplay(mergeTags.children),
    [mergeTags.children],
  );

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
        <MergeTagIcon fontSize="small" />
      </ToolbarIconButton>

      <ToolbarPopover
        anchorEl={anchor}
        onClose={handleClose}
        paperSx={{ p: 0, overflow: 'hidden', minWidth: 268 }}
      >
        <Box
          sx={{
            maxHeight: '13rem',
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            ...MENU_LIST_SX,
          }}
        >
          {groups.map((group) => (
            <Box key={group.title} sx={{ py: 0.25 }}>
              <Typography component="div" sx={MENU_SECTION_SX}>
                {group.title}
              </Typography>
              {group.items.map((tag) => (
                <ListItemButton
                  key={tag.value}
                  onClick={() => tag.value && insertTag(tag.value)}
                  sx={{ ...MENU_ITEM_SX, display: 'block' }}
                >
                  <Typography component="span" sx={{ ...MENU_LABEL_SX, display: 'block' }}>
                    {tag.label}
                  </Typography>
                  <Typography component="span" sx={MENU_SUBLABEL_SX}>
                    {tag.value}
                  </Typography>
                </ListItemButton>
              ))}
            </Box>
          ))}
        </Box>
      </ToolbarPopover>
    </>
  );
}
