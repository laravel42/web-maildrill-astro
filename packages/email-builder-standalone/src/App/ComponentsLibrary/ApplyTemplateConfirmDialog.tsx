/**
 * ApplyTemplateConfirmDialog — confirms the user wants to REPLACE the
 * entire current document with a saved template.
 *
 * Templates are full documents (root EmailLayout + every descendant).
 * Applying one wipes the editor canvas and re-seeds it with the
 * template's blocks. The change lands as a single undo step (the
 * `applyTemplateDocument` atomic in `EditorContext` pushes one
 * snapshot before the swap), so the user can revert with Cmd/Ctrl+Z.
 */

import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';

import { applyTemplateDocument } from '../../documents/editor/EditorContext';

import { fetchSavedTemplate } from './fetchSavedSubtree';
import { DIALOG_PAPER_PROPS } from './styles';

export type ApplyTemplateConfirmDialogProps = {
  /** Template id to apply, or null when the dialog is hidden. */
  templateId: string | null;
  /** Display name, used in the confirm copy. */
  templateName: string;
  onClose: () => void;
  onApplied?: (id: string) => void;
};

export default function ApplyTemplateConfirmDialog({
  templateId,
  templateName,
  onClose,
  onApplied,
}: ApplyTemplateConfirmDialogProps) {
  const { t } = useTranslation('inspector');
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (applying) return;
    setError(null);
    onClose();
  }, [applying, onClose]);

  const handleApply = useCallback(async () => {
    if (!templateId || applying) return;
    setApplying(true);
    setError(null);
    try {
      const result = await fetchSavedTemplate(templateId);
      const ok = applyTemplateDocument(result.blocks);
      if (!ok) {
        throw new Error(
          t(
            'componentsLibrary.applyTemplate.errorMalformed',
            'Template payload was empty or did not start with an EmailLayout root.'
          )
        );
      }
      onApplied?.(templateId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setApplying(false);
    }
  }, [templateId, applying, onApplied, onClose, t]);

  return (
    <Dialog
      open={templateId !== null}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: DIALOG_PAPER_PROPS }}
    >
      <DialogTitle>
        {t('componentsLibrary.applyTemplate.title', 'Apply template "{{name}}"?', {
          name: templateName,
        })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'componentsLibrary.applyTemplate.body',
              'This will REPLACE your current document with the saved template. You can undo this action.'
            )}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={applying}>
          {t('componentsLibrary.applyTemplate.cancel', 'Cancel')}
        </Button>
        <Button onClick={handleApply} variant="contained" color="warning" disabled={applying}>
          {applying
            ? t('componentsLibrary.applyTemplate.applying', 'Applying…')
            : t('componentsLibrary.applyTemplate.submit', 'Replace document')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
