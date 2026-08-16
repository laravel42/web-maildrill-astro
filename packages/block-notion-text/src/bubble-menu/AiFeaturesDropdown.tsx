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

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={{ ...MENU_LIST_SX, maxHeight: MAX_LIST_HEIGHT, overflow: 'auto' }}>
          {featuresList.map((feature, idx) => {
            if (feature.type === 'section-header') {
              return (
                <Box key={idx} sx={{ ...MENU_SECTION_SX, mt: idx > 0 ? 1 : 0 }}>
                  {feature.label}
                </Box>
              );
            }

            return (
              <ListItemButton
                key={idx}
                onClick={() => !feature.disabled && processFeature(feature.value)}
                disabled={feature.disabled}
                sx={{ ...MENU_ITEM_SX, opacity: feature.disabled ? 0.5 : 1 }}
              >
                {feature.emoji ? (
                  <Box sx={{ mr: 0.75, fontSize: '15px', display: 'flex', alignItems: 'center' }}>
                    {feature.emoji}
                  </Box>
                ) : (
                  <ListItemIcon sx={MENU_ICON_SX}>
                    {feature.loading ? (
                      <CircularProgress size={16} sx={{ color: MENU_MUTED }} />
                    ) : (
                      feature.icon
                    )}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={feature.label}
                  sx={MENU_ITEM_TEXT_SX}
                  slotProps={{ primary: { sx: MENU_LABEL_SX } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </ToolbarPopover>
    </>
  );
}
