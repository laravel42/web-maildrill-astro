import React, { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import data from '@emoji-mart/data';
import { EmojiEmotions as EmojiIcon } from '@mui/icons-material';
import { Box, CircularProgress, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import SafeEmojiMartPicker from '../SafeEmojiMartPicker';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = {
  editor: Editor;
  onOpenChange?: (open: boolean) => void;
};

/**
 * Trimmed emoji-mart layout: the default picker is ~435px tall, mostly nav,
 * a frequent-emoji block and a preview bar that repeats the emoji under the
 * cursor. Dropping the preview and most frequent rows keeps it in scale with
 * the other toolbar panels.
 */
const PICKER_LAYOUT = {
  perLine: 8,
  emojiSize: 20,
  emojiButtonSize: 30,
  maxFrequentRows: 1,
  previewPosition: 'none',
  // Home for the skin-tone control now that the preview bar is gone.
  skinTonePosition: 'search',
} as const;

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
    [editor],
  );

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.insertEmoji')} onClick={handleClick}>
        <EmojiIcon fontSize="small" />
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose} disableAutoFocus>
        <SafeEmojiMartPicker
          data={data}
          onEmojiSelect={handleSelect}
          theme={theme.palette.mode === 'dark' ? 'dark' : 'light'}
          {...PICKER_LAYOUT}
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
