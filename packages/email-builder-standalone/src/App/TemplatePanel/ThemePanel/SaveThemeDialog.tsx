/**
 * SaveThemeDialog — captures the current root globals + per-block-type
 * theme overrides as a named bundle and persists it through
 * `POST /dev/save-theme`.
 *
 * Two fields only: `name` (required, ≤100) and `description` (optional,
 * ≤280). Slug-style identifiers are deliberately gone — the bundle id
 * is a server-minted UUID v4 (L42-306 / L42-307 identity model).
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import { buildCurrentThemeBundlePayload } from '../../../documents/editor/EditorContext';
import { saveTheme } from '../../ComponentsLibrary/fetchTheme';

const MAX_NAME = 100;
const MAX_DESCRIPTION = 280;

export type SaveThemeDialogProps = {
  open: boolean;
  onClose: () => void;
  /** Optional callback fired after a successful save with the new bundle id. */
  onSaved?: (id: string) => void;
};

export default function SaveThemeDialog({ open, onClose, onSaved }: SaveThemeDialogProps) {
  const { t } = useTranslation('inspector');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= MAX_NAME && description.length <= MAX_DESCRIPTION;

  const handleClose = useCallback(() => {
    if (submitting) return;
    setName('');
    setDescription('');
    setError(null);
    onClose();
  }, [submitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const bundle = buildCurrentThemeBundlePayload();
      const result = await saveTheme({
        name: trimmedName,
        description: description.trim() || undefined,
        bundle,
      });
      onSaved?.(result.id);
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [isValid, submitting, trimmedName, description, onClose, onSaved]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('theme.save.title', 'Save current theme')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'theme.save.description',
              'Snapshots the current root globals and per-block-type theme overrides. Saved themes can be reapplied later from the Components Library.'
            )}
          </Typography>

          <TextField
            label={t('theme.save.nameLabel', 'Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('theme.save.namePlaceholder', 'e.g. Brand default')}
            autoFocus
            fullWidth
            disabled={submitting}
            slotProps={{ htmlInput: { maxLength: MAX_NAME } }}
            helperText={`${trimmedName.length}/${MAX_NAME}`}
          />

          <TextField
            label={t('theme.save.descriptionLabel', 'Description (optional)')}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            disabled={submitting}
            slotProps={{ htmlInput: { maxLength: MAX_DESCRIPTION } }}
            helperText={`${description.length}/${MAX_DESCRIPTION}`}
          />

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {t('theme.save.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid || submitting}>
          {submitting ? t('theme.save.submitting', 'Saving…') : t('theme.save.submit', 'Save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
