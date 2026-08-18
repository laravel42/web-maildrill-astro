import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MergeTagMenuPanel, type MergeTagGroup } from '@md/merge-tag-menu';
import { DataObject as MergeTagIcon } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';

import { groupMergeTagsForDisplay } from '../merge-tags-groups';
import { getMergeTags } from '../merge-tags-config';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

/** Panel skin comes from @md/merge-tag-menu; this file owns the popover only. */
const PAPER_SX = { p: 0, overflow: 'hidden', minWidth: 268 } as const;

export default function MergeTagsDropdown({ editor }: Props) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const mergeTags = getMergeTags();
  const groups = useMemo<MergeTagGroup[]>(
    () =>
      groupMergeTagsForDisplay(mergeTags.children).map((group) => ({
        title: group.title,
        options: group.items.map((tag) => ({
          id: tag.value ?? tag.label ?? '',
          label: tag.label ?? '',
          token: tag.value ?? '',
        })),
      })),
    [mergeTags.children],
  );

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const insertTag = useCallback(
    (token: string) => {
      if (!token) return;
      requestAnimationFrame(() => {
        editor.chain().focus().insertContent(token).run();
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

      <ToolbarPopover anchorEl={anchor} onClose={handleClose} paperSx={PAPER_SX}>
        <MergeTagMenuPanel
          groups={groups}
          onSelect={(option) => insertTag(option.token)}
          maxHeight="13rem"
        />
      </ToolbarPopover>
    </>
  );
}
