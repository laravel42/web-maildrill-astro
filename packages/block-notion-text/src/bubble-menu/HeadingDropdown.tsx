import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { List, ListItemButton, ListItemIcon, ListItemText, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

const HEADING_ICONS = {
  paragraph: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="currentColor" d="M11.385 19V6.25H6.019V5H18v1.25h-5.365V19z" />
    </svg>
  ),
  h1: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 4.5v15m9.5-15v15M3.75 12h9.5m3.25-.125l3-2.375v10"
      />
    </svg>
  ),
  h2: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M16 11.939c0-3.252 5-3.252 5 0c0 2.873-5 5.007-5 7.561h5M3.75 4.5v15m9.5-15v15M3.75 12h9.5"
      />
    </svg>
  ),
  h3: (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 4.5v15m9.5-15v15M3.75 12h9.5M16 9.5h5l-3.5 4.507c2 0 3.5 1.001 3.5 3.004c0 2.744-3.408 3.206-5 1.452"
      />
    </svg>
  ),
};

const POPOVER_ICONS = {
  paragraph: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path fill="currentColor" d="M11.385 19V6.25H6.019V5H18v1.25h-5.365V19z" />
    </svg>
  ),
  h1: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 4.5v15m9.5-15v15M3.75 12h9.5m3.25-.125l3-2.375v10"
      />
    </svg>
  ),
  h2: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M16 11.939c0-3.252 5-3.252 5 0c0 2.873-5 5.007-5 7.561h5M3.75 4.5v15m9.5-15v15M3.75 12h9.5"
      />
    </svg>
  ),
  h3: (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M3.75 4.5v15m9.5-15v15M3.75 12h9.5M16 9.5h5l-3.5 4.507c2 0 3.5 1.001 3.5 3.004c0 2.744-3.408 3.206-5 1.452"
      />
    </svg>
  ),
};

export default function HeadingDropdown({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const setLevel = useCallback(
    (level: 1 | 2 | 3 | null) => {
      requestAnimationFrame(() => {
        if (level === null) {
          editor.chain().focus().setParagraph().run();
        } else {
          editor.chain().focus().setHeading({ level }).run();
        }
      });
      handleClose();
    },
    [editor, handleClose]
  );

  const getCurrentIcon = () => {
    if (editor.isActive('heading', { level: 1 })) return HEADING_ICONS.h1;
    if (editor.isActive('heading', { level: 2 })) return HEADING_ICONS.h2;
    if (editor.isActive('heading', { level: 3 })) return HEADING_ICONS.h3;
    return HEADING_ICONS.paragraph;
  };

  const items = [
    {
      label: t('bubbleMenu.paragraph', 'Paragraph'),
      level: null as null,
      icon: POPOVER_ICONS.paragraph,
      active: !editor.isActive('heading'),
    },
    {
      label: t('bubbleMenu.heading1', 'Heading 1'),
      level: 1 as const,
      icon: POPOVER_ICONS.h1,
      active: editor.isActive('heading', { level: 1 }),
    },
    {
      label: t('bubbleMenu.heading2', 'Heading 2'),
      level: 2 as const,
      icon: POPOVER_ICONS.h2,
      active: editor.isActive('heading', { level: 2 }),
    },
    {
      label: t('bubbleMenu.heading3', 'Heading 3'),
      level: 3 as const,
      icon: POPOVER_ICONS.h3,
      active: editor.isActive('heading', { level: 3 }),
    },
  ] as const;

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.headingStyle', 'Heading style')}
        active={editor.isActive('heading')}
        onClick={handleClick}
        showArrow
      >
        {getCurrentIcon()}
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={{ p: '8px 4px' }}>
          {items.map((item) => (
            <ListItemButton
              key={item.label}
              onClick={() => setLevel(item.level)}
              selected={item.active}
              sx={{
                p: '8px 10px',
                borderRadius: '6px',
                backgroundColor: item.active ? theme.palette.action.selected : 'transparent',
                '&:hover': { backgroundColor: theme.palette.action.hover },
                transition: 'all 150ms ease',
              }}
            >
              <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                slotProps={{ primary: { sx: { fontSize: '14px', color: theme.palette.text.primary } } }}
              />
            </ListItemButton>
          ))}
        </List>
      </ToolbarPopover>
    </>
  );
}
