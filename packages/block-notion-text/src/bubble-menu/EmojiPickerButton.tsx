import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmojiPickerPanel } from '@md/emoji-picker';
import { EmojiEmotions as EmojiIcon } from '@mui/icons-material';
import { Box, CircularProgress, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = {
  editor: Editor;
  onOpenChange?: (open: boolean) => void;
};

export default function EmojiPickerButton({ editor, onOpenChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

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

      setAnchor(event.currentTarget);
      onOpenChange?.(true);
    },
    [editor, onOpenChange],
  );

  const handleClose = useCallback(() => {
    setAnchor(null);
    insertionRef.current = null;
    onOpenChange?.(false);
  }, [onOpenChange]);

  const handleSelect = useCallback(
    (native: string) => {
      if (!insertionRef.current) return;

      const emojiLength = native.length;

      if (insertionRef.current.isFirstEmoji) {
        const { from, to } = insertionRef.current.originalSelection;
        editor.chain().deleteRange({ from, to }).insertContentAt(from, native).run();

        insertionRef.current.insertPosition = from + emojiLength;
        insertionRef.current.isFirstEmoji = false;
      } else {
        const insertPos = insertionRef.current.insertPosition;
        editor.chain().insertContentAt(insertPos, native).run();

        insertionRef.current.insertPosition = insertPos + emojiLength;
      }
    },
    [editor],
  );

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.insertEmoji')} onClick={handleClick}>
        <EmojiIcon fontSize="small" />
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose} disableAutoFocus>
        {/* Left open after a pick so several emoji can be inserted in a row. */}
        <EmojiPickerPanel
          onPick={handleSelect}
          theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
          fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 2 }}>
              <CircularProgress size={20} />
            </Box>
          }
        />
      </ToolbarPopover>
    </>
  );
}
