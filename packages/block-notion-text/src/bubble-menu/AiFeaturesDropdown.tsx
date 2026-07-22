import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AiSparkleIcon from '../AiSparkleIcon';
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

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

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
          feature.value === action ? { ...feature, loading: true, disabled: true } : { ...feature, disabled: true }
        )
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
    [editor]
  );

  useEffect(() => {
    const handleProcessed = () => {
      setFeaturesList((prev) =>
        prev.map((feature) => ({
          ...feature,
          loading: false,
          disabled: false,
        }))
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
        <AiSparkleIcon fontSize="small" />
      </ToolbarIconButton>

      <Divider orientation="vertical" flexItem sx={{ backgroundColor: theme.palette.divider, mx: 0.5 }} />

      <ToolbarPopover anchorEl={anchor} onClose={handleClose}>
        <List sx={{ maxHeight: 400, overflow: 'auto', p: '8px 4px' }}>
          {featuresList.map((feature, idx) => {
            if (feature.type === 'section-header') {
              return (
                <Box
                  key={idx}
                  sx={{
                    px: '10px',
                    py: '8px',
                    mt: idx > 0 ? 1 : 0,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      fontSize: '11px',
                      color: theme.palette.text.disabled,
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                    }}
                  >
                    {feature.label}
                  </Box>
                </Box>
              );
            }

            return (
              <ListItemButton
                key={idx}
                onClick={() => !feature.disabled && processFeature(feature.value)}
                disabled={feature.disabled}
                sx={{
                  p: '8px 10px',
                  borderRadius: '6px',
                  '&:hover': { backgroundColor: theme.palette.action.hover },
                  transition: 'all 150ms ease',
                  opacity: feature.disabled ? 0.5 : 1,
                }}
              >
                {feature.emoji ? (
                  <Box sx={{ mr: 1, fontSize: '18px', display: 'flex', alignItems: 'center' }}>{feature.emoji}</Box>
                ) : (
                  <ListItemIcon sx={{ minWidth: 'auto', mr: 1, color: theme.palette.text.secondary }}>
                    {feature.loading ? (
                      <CircularProgress size={20} sx={{ color: theme.palette.text.secondary }} />
                    ) : (
                      feature.icon
                    )}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={feature.label}
                  slotProps={{ primary: { sx: { fontSize: '14px', color: theme.palette.text.primary } } }}
                />
              </ListItemButton>
            );
          })}
        </List>
      </ToolbarPopover>
    </>
  );
}
