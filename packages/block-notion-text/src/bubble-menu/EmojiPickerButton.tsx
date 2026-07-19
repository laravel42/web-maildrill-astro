import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import data from '@emoji-mart/data';
import { EmojiEmotions as EmojiIcon } from '@mui/icons-material';
import { Box, CircularProgress, Popover, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import SafeEmojiMartPicker from '../SafeEmojiMartPicker';

import ToolbarIconButton from './ToolbarIconButton';

type Props = {
  editor: Editor;
  onOpenChange?: (open: boolean) => void;
};

export default function EmojiPickerButton({ editor, onOpenChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [anchorPosition, setAnchorPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const insertionRef = useRef<{
    isFirstEmoji: boolean;
    insertPosition: number;
    originalSelection: { from: number; to: number };
  } | null>(null);

  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const { from, to } = editor.state.selection;
      insertionRef.current = {
        isFirstEmoji: true,
        insertPosition: from,
        originalSelection: { from, to },
      };

      const PICKER_HEIGHT = 435;
      const PICKER_WIDTH = 352;
      const MARGIN = 8;
      const GAP = 4;

      const rect = event.currentTarget.getBoundingClientRect();
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      let left = rect.left + rect.width / 2 - PICKER_WIDTH / 2;
      left = Math.max(MARGIN, Math.min(left, vw - PICKER_WIDTH - MARGIN));

      let top: number;
      if (rect.bottom + PICKER_HEIGHT + GAP <= vh) {
        top = rect.bottom + GAP;
      } else if (rect.top - PICKER_HEIGHT - GAP >= 0) {
        top = rect.top - PICKER_HEIGHT - GAP;
      } else {
        top = Math.max(MARGIN, vh - PICKER_HEIGHT - MARGIN);
      }

      setAnchorPosition({ top, left });
      setOpen(true);
      onOpenChange?.(true);
    },
    [editor, onOpenChange]
  );

  const handleClose = useCallback(() => {
    setOpen(false);
    insertionRef.current = null;
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleSelect = useCallback(
    (emoji: { native: string }) => {
      if (!insertionRef.current) return;

      const emojiLength = emoji.native.length;

      if (insertionRef.current.isFirstEmoji) {
        const { from, to } = insertionRef.current.originalSelection;
        editor.chain().deleteRange({ from, to }).insertContentAt(from, emoji.native).run();

        insertionRef.current.insertPosition = from + emojiLength;
        insertionRef.current.isFirstEmoji = false;
      } else {
        const insertPos = insertionRef.current.insertPosition;
        editor.chain().insertContentAt(insertPos, emoji.native).run();

        insertionRef.current.insertPosition = insertPos + emojiLength;
      }
    },
    [editor]
  );

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.insertEmoji')} onClick={handleClick}>
        <EmojiIcon fontSize="small" />
      </ToolbarIconButton>

      <Popover
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition}
        disableEnforceFocus
        disableAutoFocus
        onClose={(_event, reason) => {
          if (reason === 'escapeKeyDown' || reason === 'backdropClick') {
            handleClose();
          }
        }}
      >
        <SafeEmojiMartPicker
          data={data}
          onEmojiSelect={handleSelect}
          theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          }
        />
      </Popover>
    </>
  );
}
