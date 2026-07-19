/**
 * ApplyThemeConfirmDialog — confirms the user wants to overwrite the
 * current root globals + per-block-type overrides with a saved bundle.
 *
 * On confirm: fetches the full bundle by id, validates with
 * `themeBundleSchema`, then dispatches `applyThemeBundle()` so the
 * change lands as a single undo step.
 *
 * Used both from the inspector "Apply theme" header button (deep-link
 * flow) and from each card click in the drawer Themes tab.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { themeBundleSchema } from '@eb/document-core';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';

import { applyThemePreset } from '../../../documents/editor/EditorContext';
import { fetchTheme } from '../../ComponentsLibrary/fetchTheme';

export type ApplyThemeConfirmDialogProps = {
  /** Theme id to apply, or null when the dialog is hidden. */
  themeId: string | null;
  /** Display name, used in the confirm copy. */
  themeName: string;
  onClose: () => void;
  onApplied?: (id: string) => void;
};

export default function ApplyThemeConfirmDialog({
  themeId,
  themeName,
  onClose,
  onApplied,
}: ApplyThemeConfirmDialogProps) {
  const { t } = useTranslation('inspector');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (applying) return;
    setError(null);
    onClose();
  }, [applying, onClose]);

  const handleApply = useCallback(async () => {
    if (!themeId || applying) return;
    setApplying(true);
    setError(null);
    try {
      const raw = await fetchTheme(themeId);
      const parsed = themeBundleSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(t('theme.apply.errorMalformed', 'Saved theme failed schema validation.'));
      }
      applyThemePreset(parsed.data, themeId);
      onApplied?.(themeId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }, [themeId, applying, onApplied, onClose, t]);

  return (
    <Dialog open={themeId !== null} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('theme.apply.title', 'Apply theme "{{name}}"?', { name: themeName })}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'theme.apply.body',
              'This will overwrite your current root globals and per-block-type theme overrides. You can undo this action.'
            )}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={applying}>
          {t('theme.apply.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleApply} variant="contained" disabled={applying}>
          {applying ? t('theme.apply.applying', 'Applying…') : t('theme.apply.submit', 'Apply')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
