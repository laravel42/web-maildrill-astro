/**
 * RenameThemeDialog — edit a saved theme's `name` / `description`
 * without touching the bundle payload. Fires `PUT /dev/themes/:id`.
 *
 * Pre-fills with the current values so the user sees what they're
 * editing. The bundle id never changes, so existing references in
 * other UIs stay valid.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
} from '@mui/material';

import { type ThemeListing, updateTheme } from '../../ComponentsLibrary/fetchTheme';

const MAX_NAME = 100;
const MAX_DESCRIPTION = 280;

export type RenameThemeDialogProps = {
  /** Theme to edit; null hides the dialog. */
  target: ThemeListing | null;
  onClose: () => void;
  onRenamed?: (id: string) => void;
};

export default function RenameThemeDialog({ target, onClose, onRenamed }: RenameThemeDialogProps) {
  const { t } = useTranslation('inspector');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate fields whenever the target switches.
  useEffect(() => {
    if (target) {
      setName(target.name);
      setDescription(target.description ?? '');
      setError(null);
    }
  }, [target]);

  const trimmedName = name.trim();
  const isValid =
    trimmedName.length > 0 &&
    trimmedName.length <= MAX_NAME &&
    description.length <= MAX_DESCRIPTION;
  const isDirty =
    target !== null && (trimmedName !== target.name || description !== (target.description ?? ''));

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!target || !isValid || !isDirty || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateTheme(target.id, {
        name: trimmedName,
        description: description.length === 0 ? '' : description,
      });
      onRenamed?.(target.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [target, isValid, isDirty, submitting, trimmedName, description, onClose, onRenamed]);

  return (
    <Dialog open={target !== null} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('theme.rename.title', 'Rename theme')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label={t('theme.save.nameLabel', 'Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid || !isDirty || submitting}
        >
          {submitting
            ? t('theme.save.submitting', 'Saving…')
            : t('theme.rename.submit', 'Save changes')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
