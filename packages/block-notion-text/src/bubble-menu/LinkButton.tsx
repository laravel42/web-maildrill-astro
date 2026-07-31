import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Link as LinkIcon } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';

import { LinkEditorPopover } from '../LinkEditorPopover';

import ToolbarIconButton from './ToolbarIconButton';

type Props = { editor: Editor };

export default function LinkButton({ editor }: Props) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.preventDefault();

    if (editor.isActive('link')) {
      setAnchor(event.currentTarget);
    } else {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      setAnchor(event.currentTarget);
    }
  };

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.link')}
        active={editor.isActive('link')}
        onClick={handleClick}
      >
        <LinkIcon fontSize="small" />
      </ToolbarIconButton>

      <LinkEditorPopover
        editor={editor}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        initialUrl={editor.isActive('link') ? editor.getAttributes('link').href : ''}
      />
    </>
  );
}
