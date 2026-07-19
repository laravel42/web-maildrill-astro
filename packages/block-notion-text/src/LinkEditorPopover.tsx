import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Delete as DeleteIcon } from '@mui/icons-material';
import { Box, Button, Popover, TextField, Typography, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

const INPUT_HEIGHT_PX = 36;
const PANEL_BORDER_RADIUS_PX = 12;
const FIELD_BORDER_RADIUS_PX = 8;

interface LinkEditorPopoverProps {
  editor: Editor;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  initialUrl?: string;
}

export function LinkEditorPopover({ editor, anchorEl, onClose, initialUrl = '' }: LinkEditorPopoverProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputSurface =
    (theme.palette.background as { input?: string }).input ??
    (theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[100]);

  const isEditing = Boolean(initialUrl);
  const isValidUrl = url.trim().length > 0;
  const urlInvalid = url.length > 0 && !isValidUrl;

  const focusUrlInput = () => {
    const el = inputRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    if (el.value.length > 0) {
      el.select();
    }
  };

  useEffect(() => {
    setUrl(initialUrl);
  }, [initialUrl]);

  const normalizeUrl = (url: string): string => {
    const trimmed = url.trim();
    if (!trimmed) return '';

    const specialProtocols = ['mailto:', 'tel:', 'sms:', 'whatsapp:'];
    if (specialProtocols.some((p) => trimmed.toLowerCase().startsWith(p))) {
      return trimmed;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      return `https://${trimmed}`;
    }

    return trimmed;
  };

  const handleSave = () => {
    if (!isValidUrl) return;

    const normalizedUrl = normalizeUrl(url);

    editor
      .chain()
      .focus()
      .setLink({
        href: normalizedUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
      })
      .run();

    onClose();
  };

  const handleRemove = () => {
    editor.chain().focus().unsetLink().run();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <Popover
      open={Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'left',
      }}
      transformOrigin={{
        vertical: 'top',
        horizontal: 'left',
      }}
      slotProps={{
        transition: { onEntered: focusUrlInput },
        paper: {
          sx: {
            mt: 1,
            minWidth: 320,
            maxWidth: 400,
            overflow: 'hidden',
            borderRadius: `${PANEL_BORDER_RADIUS_PX}px`,
            bgcolor: 'background.paper',
            backgroundImage: 'none',
            boxShadow: theme.shadows[2],
            border: `1px solid ${theme.palette.divider}`,
          },
        },
      }}
    >
      <Box
        sx={{
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
        onKeyDown={handleKeyDown}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography
            component="label"
            variant="body2"
            htmlFor="link-editor-url-field"
            sx={{ fontWeight: 700, color: 'text.primary' }}
          >
            {t('linkEditor.urlLabel')}
          </Typography>
          <TextField
            id="link-editor-url-field"
            inputRef={inputRef}
            hiddenLabel
            fullWidth
            size="small"
            variant="outlined"
            placeholder={t('linkEditor.urlPlaceholder')}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            error={urlInvalid}
            helperText={urlInvalid ? t('linkEditor.invalidUrl') : undefined}
            slotProps={{
              formHelperText: { sx: { mt: 0.5, mx: 0 } },
            }}
            sx={{
              width: '100%',
              '& .MuiOutlinedInput-root': {
                borderRadius: `${FIELD_BORDER_RADIUS_PX}px`,
                backgroundColor: inputSurface,
                minHeight: INPUT_HEIGHT_PX,
                '& fieldset': {
                  borderColor: theme.palette.divider,
                  borderWidth: 1,
                },
                '&:hover fieldset': {
                  borderColor: theme.palette.divider,
                },
                '&.Mui-focused fieldset': {
                  borderColor: theme.palette.primary.main,
                  borderWidth: 1,
                },
                '&.Mui-error fieldset': {
                  borderColor: theme.palette.error.main,
                },
              },
              '& .MuiOutlinedInput-input': {
                py: '8px',
                px: '12px',
              },
            }}
          />
        </Box>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 1,
            pt: 1,
            borderTop: `1px solid ${theme.palette.divider}`,
          }}
        >
          {isEditing && (
            <Button
              size="small"
              startIcon={<DeleteIcon fontSize="small" />}
              onClick={handleRemove}
              sx={{
                color: theme.palette.error.main,
                mr: 'auto',
                borderRadius: `${theme.shape.borderRadius}px`,
                '&:hover': {
                  backgroundColor: `${theme.palette.error.light}20`,
                },
              }}
            >
              {t('generic.delete')}
            </Button>
          )}
          <Button
            size="small"
            onClick={onClose}
            sx={{
              color: theme.palette.text.secondary,
              borderRadius: `${theme.shape.borderRadius}px`,
            }}
          >
            {t('generic.cancel')}
          </Button>
          <Button
            size="small"
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={!isValidUrl}
            sx={{
              borderRadius: `${theme.shape.borderRadius}px`,
              boxShadow: 'none',
              '&:hover': {
                boxShadow: 'none',
              },
            }}
          >
            {t('generic.save')}
          </Button>
        </Box>
      </Box>
    </Popover>
  );
}
