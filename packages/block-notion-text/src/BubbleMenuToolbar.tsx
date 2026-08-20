import React, { useCallback, useState } from 'react';

import { BubbleMenu } from '@tiptap/react/menus';

// React 19 JSX: ComponentType<BubbleMenuProps> omits ref; cast keeps declaration emit valid.
const BubbleMenuComponent = BubbleMenu as unknown as React.ComponentType<any>;
import { useTranslation } from 'react-i18next';

import { FormatClear } from '@mui/icons-material';
import { Divider, Paper, useTheme } from '@mui/material';
import type { ResolvedPos } from '@tiptap/pm/model';
import { type Editor, useEditorState } from '@tiptap/react';

import {
  AiFeaturesDropdown,
  AlignDropdown,
  BackgroundPickerButton,
  ColorPickerButton,
  EmojiPickerButton,
  FormatButtons,
  HeadingDropdown,
  LinkButton,
  ListDropdown,
  MergeTagsDropdown,
  ToolbarIconButton,
} from './bubble-menu';

type Props = {
  editor: Editor;
  hidden?: boolean;
};

export default function BubbleMenuToolbar({ editor, hidden = false }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // shouldRerenderOnTransaction: false prevents re-renders on editor state changes.
  // This hook re-subscribes to the specific formatting states the toolbar needs,
  // so children re-render and reflect the active formatting of the current selection.
  useEditorState({
    editor,
    selector: ({ editor: e }: { editor: Editor }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      heading: e.isActive('heading'),
      h1: e.isActive('heading', { level: 1 }),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      link: e.isActive('link'),
      textStyle: e.isActive('textStyle'),
      textColor: e.getAttributes('textStyle').color as string | undefined,
      bgColor: e.getAttributes('textStyle').backgroundColor as string | undefined,
      alignCenter: e.isActive({ textAlign: 'center' }),
      alignRight: e.isActive({ textAlign: 'right' }),
      alignJustify: e.isActive({ textAlign: 'justify' }),
    }),
  });

  const bubbleMenuRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      el.style.zIndex = '100';
      el.style.paddingLeft = '8px';
      el.style.paddingRight = '8px';
    }
  }, []);

  const dividerSx = { backgroundColor: theme.palette.divider, mx: 0.5 } as const;

  /**
   * Anchor the bar to the block that owns the selection rather than to the
   * selection itself. The default rect tracks the caret's own line, which would
   * drag the bar between the lines of a wrapped paragraph as the caret moves.
   */
  const getReferencedVirtualElement = useCallback(() => {
    const { state, view } = editor;
    const blockRect = (pos: ResolvedPos) => {
      if (pos.depth === 0) return null;
      const dom = view.nodeDOM(pos.before(pos.depth));
      return dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
    };

    const { $from, $to } = state.selection;
    const first = blockRect($from);
    const last = blockRect($to) ?? first;
    // Falsy hands positioning back to the plugin's own selection rect.
    if (!first || !last) return null;

    const left = Math.min(first.left, last.left);
    const top = Math.min(first.top, last.top);
    const rect = new DOMRect(
      left,
      top,
      Math.max(first.right, last.right) - left,
      Math.max(first.bottom, last.bottom) - top,
    );
    return { getBoundingClientRect: () => rect, getClientRects: () => [rect] };
  }, [editor]);

  return (
    <BubbleMenuComponent
      ref={bubbleMenuRef}
      editor={editor}
      getReferencedVirtualElement={getReferencedVirtualElement}
      options={{
        // Under the block by preference: anchored to the whole block (see
        // getReferencedVirtualElement) that clears the text being edited and
        // leaves room below for the toolbar's own dropdowns. Flip only kicks
        // in for the last block on screen, where there is no room under it —
        // above the block still clears the text, unlike the caret-following
        // default this component replaces.
        placement: 'bottom',
        offset: 12,
        flip: { padding: 8 },
        // crossAxis lets the bar slide vertically too, so a block taller than
        // the viewport keeps its bar on screen instead of parking it off the
        // edge with the block's far end.
        shift: { padding: 8, crossAxis: true },
      }}
      shouldShow={({ editor }: { editor: Editor }) => {
        if (hidden) return false;
        if (emojiPickerOpen) return true;
        return editor.isFocused;
      }}
    >
      <Paper
        data-notion-text-toolbar="true"
        elevation={3}
        sx={{
          display: 'flex',
          gap: '1px',
          p: '2px 1px',
          alignItems: 'center',
          borderRadius: '10px',
          backgroundColor: theme.palette.mode === 'dark' ? '#1a1a1a' : '#ffffff',
          border: theme.palette.mode === 'dark' ? 'none' : '1px solid rgba(0,0,0,0.12)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 2px 10px rgba(0,0,0,0.5)'
              : '0 2px 10px rgba(0,0,0,0.15)',
          height: '37px',
          whiteSpace: 'nowrap',
        }}
      >
        <HeadingDropdown editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <FormatButtons editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <ListDropdown editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <AlignDropdown editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <ColorPickerButton editor={editor} />
        <BackgroundPickerButton editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <LinkButton editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <MergeTagsDropdown editor={editor} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <EmojiPickerButton editor={editor} onOpenChange={setEmojiPickerOpen} />
        <Divider orientation="vertical" flexItem sx={dividerSx} />

        <AiFeaturesDropdown editor={editor} />

        <ToolbarIconButton
          tooltip={t('bubbleMenu.clearFormatting')}
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
        >
          <FormatClear fontSize="small" />
        </ToolbarIconButton>
      </Paper>
    </BubbleMenuComponent>
  );
}
