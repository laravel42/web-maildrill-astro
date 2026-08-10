import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DataObject as MergeTagIcon } from '@mui/icons-material';
import { Box, ListItemButton, Typography } from '@mui/material';
import type { Editor } from '@tiptap/react';

import { groupMergeTagsForDisplay } from '../merge-tags-groups';
import { getMergeTags } from '../merge-tags-config';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

/** Matches wa-template-studio `.wts-select-menu` panel skin (light). */
const MENU_SKIN = {
  border: '1px solid #e4e2da',
  borderRadius: '10px',
  backgroundColor: '#ffffff',
  color: '#1f1e1b',
  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.1)',
} as const;

const ITEM_HOVER_BG = '#eef0ff';
const TOKEN_COLOR = '#77756c';

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
        paperSx={{
          ...MENU_SKIN,
          p: 0,
          overflow: 'hidden',
          minWidth: 288,
        }}
      >
        <Box
          sx={{
            maxHeight: '14rem',
            overflowX: 'hidden',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            WebkitOverflowScrolling: 'touch',
            p: 0.5,
          }}
        >
          {groups.map((group) => (
            <Box key={group.title} sx={{ py: 0.5 }}>
              <Typography
                component="div"
                sx={{
                  px: 1,
                  py: 0.75,
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: TOKEN_COLOR,
                  lineHeight: 1.2,
                }}
              >
                {group.title}
              </Typography>
              {group.items.map((tag) => (
                <ListItemButton
                  key={tag.value}
                  onClick={() => tag.value && insertTag(tag.value)}
                  sx={{
                    display: 'block',
                    px: 1,
                    py: 0.75,
                    borderRadius: '6px',
                    transition: 'background-color 150ms ease',
                    '&:hover': { backgroundColor: ITEM_HOVER_BG },
                    '&:focus-visible': { backgroundColor: ITEM_HOVER_BG },
                  }}
                >
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      fontSize: '0.9375rem',
                      fontWeight: 500,
                      lineHeight: 1.25,
                      color: MENU_SKIN.color,
                    }}
                  >
                    {tag.label}
                  </Typography>
                  <Typography
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.25,
                      fontSize: '0.75rem',
                      lineHeight: 1.3,
                      color: TOKEN_COLOR,
                      wordBreak: 'break-word',
                    }}
                  >
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
