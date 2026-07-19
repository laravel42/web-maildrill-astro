import React from 'react';
import { useTranslation } from 'react-i18next';

import { FormatBold, FormatItalic, FormatUnderlined, StrikethroughS } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';

import ToolbarIconButton from './ToolbarIconButton';

type Props = { editor: Editor };

export default function FormatButtons({ editor }: Props) {
  const { t } = useTranslation();

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.bold')}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <FormatBold fontSize="small" />
      </ToolbarIconButton>

      <ToolbarIconButton
        tooltip={t('bubbleMenu.italic')}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <FormatItalic fontSize="small" />
      </ToolbarIconButton>

      <ToolbarIconButton
        tooltip={t('bubbleMenu.underline')}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <FormatUnderlined fontSize="small" />
      </ToolbarIconButton>

      <ToolbarIconButton
        tooltip={t('bubbleMenu.strikethrough')}
        active={editor.isActive('strike')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <StrikethroughS fontSize="small" />
      </ToolbarIconButton>
    </>
  );
}
