import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AutoAwesome as AIIcon } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  useTheme,
} from '@mui/material';
import type { Editor } from '@tiptap/react';

import { type AIAction, aiFeatures, requestAIFeature } from '../ai-features-config';

import {
  MENU_ICON_SX,
  MENU_ITEM_SX,
  MENU_ITEM_TEXT_SX,
  MENU_LABEL_SX,
  MENU_LIST_SX,
  MENU_MUTED,
  MENU_SECTION_SX,
} from './menu-skin';
import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

/** Tallest the list may get; ToolbarPopover trims further when the room is tighter. */
const MAX_LIST_HEIGHT = 400;

/*
 * Metrics mirror the WhatsApp studio's AI menu (`.wts-ai-menu` in studio.css)
 * so both editors offer the same dropdown: roomier rows, a fixed glyph column
 * and tighter section captions. Colours stay on the shared bubble-menu skin,
 * which the sibling panels in this toolbar also use.
 */
const AI_PAPER_SX = { minWidth: 200 } as const;

const AI_ITEM_SX = { ...MENU_ITEM_SX, px: '10px', py: '8px', gap: '8px' } as const;

/** Icon and emoji share one column so labels line up across both row kinds. */
const AI_GLYPH_SX = {
  width: 18,
  flex: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '14px',
} as const;

const AI_ICON_SX = {
  ...MENU_ICON_SX,
  ...AI_GLYPH_SX,
  mr: 0,
  // `fontSize="small"` renders at 20px, which would outgrow the glyph column.
  '& .MuiSvgIcon-root': { fontSize: 16 },
} as const;

/* The WhatsApp rows are plain buttons inheriting 400 at the host line-height,
 * where the shared menu label token is a heavier 500/1.3. */
const AI_LABEL_SX = {
  ...MENU_LABEL_SX,
  fontSize: '13px',
  fontWeight: 400,
  lineHeight: 1.5,
} as const;

const AI_SECTION_SX = {
  px: '10px',
  pt: '8px',
  pb: '4px',
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.5px',
  lineHeight: 1.2,
  color: MENU_MUTED,
} as const;

export default function AiFeaturesDropdown({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [featuresList, setFeaturesList] = useState(aiFeatures.children);
  const [enableAI, setEnableAI] = useState<boolean>(false);

  useEffect(() => {
    const aiEnabled = (window as any).__emailBuilderEnableAI;
    setEnableAI(Boolean(aiEnabled));

    const handleToggle = (event: Event) => {
      const { detail } = event as CustomEvent<boolean>;
      setEnableAI(Boolean(detail));
    };

    window.addEventListener('email-builder-ai-generation', handleToggle);
    return () => {
      window.removeEventListener('email-builder-ai-generation', handleToggle);
    };
  }, []);

  const handleClick = useCallback((event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  }, []);

  const handleClose = useCallback(() => {
    setAnchor(null);
  }, []);

  const processFeature = useCallback(
    (action: AIAction) => {
      const { from, to } = editor.state.selection;
      const selectedText = editor.state.doc.textBetween(from, to, ' ');

      if (!selectedText.trim()) {
        console.warn('\u26a0\ufe0f [BubbleMenu] No hay texto seleccionado');
        return;
      }

      const content = editor.getHTML();

      setFeaturesList((prev) =>
        prev.map((feature) =>
          feature.value === action
            ? { ...feature, loading: true, disabled: true }
            : { ...feature, disabled: true },
        ),
      );

      requestAIFeature({
        text: selectedText,
        content,
        action,
        replaceSelection: true,
        selectionFrom: from,
        selectionTo: to,
      });
    },
    [editor],
  );

  useEffect(() => {
    const handleProcessed = () => {
      setFeaturesList((prev) =>
        prev.map((feature) => ({
          ...feature,
          loading: false,
          disabled: false,
        })),
      );
      handleClose();
    };

    window.addEventListener('text-ai-processed', handleProcessed);
    return () => {
      window.removeEventListener('text-ai-processed', handleProcessed);
    };
  }, [handleClose]);

  if (!enableAI) return null;

  return (
    <>
      <ToolbarIconButton tooltip={t('bubbleMenu.aiFeatures')} onClick={handleClick}>
        <AIIcon fontSize="small" />
      </ToolbarIconButton>

      <Divider
        orientation="vertical"
        flexItem
        sx={{ backgroundColor: theme.palette.divider, mx: 0.5 }}
      />

      <ToolbarPopover anchorEl={anchor} onClose={handleClose} paperSx={AI_PAPER_SX}>
        <List sx={{ ...MENU_LIST_SX, maxHeight: MAX_LIST_HEIGHT, overflow: 'auto' }}>
          {featuresList.map((feature, idx) => {
            if (feature.type === 'section-header') {
              return (
                <Box key={idx} sx={AI_SECTION_SX}>
                  {feature.label}
                </Box>
              );
            }

            return (
              <ListItemButton
                key={idx}
                onClick={() => !feature.disabled && processFeature(feature.value)}
                disabled={feature.disabled}
                sx={{ ...AI_ITEM_SX, opacity: feature.disabled ? 0.5 : 1 }}
              >
                {feature.emoji ? (
                  <Box sx={AI_GLYPH_SX}>{feature.emoji}</Box>
                ) : (
                  <ListItemIcon sx={AI_ICON_SX}>
                    {feature.loading ? (
                      <CircularProgress size={14} sx={{ color: MENU_MUTED }} />
                    ) : (
                      feature.icon
                    )}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={feature.label}
                  sx={MENU_ITEM_TEXT_SX}
                  slotProps={{ primary: { sx: AI_LABEL_SX } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </ToolbarPopover>
    </>
  );
}
