/**
 * RenameSubtreeDialog — edit a saved item's `name` / `description`
 * across all four Components Library categories. Fires
 * `PUT /dev/{primitives|layouts|sections|templates}/...` so the bundle
 * payload (the captured blocks) stays untouched.
 *
 * Replaces the single-category `RenameComponentDialog` from the
 * pre-L42-309 era so the drawer can wire one rename UX for every
 * tab without per-category dialogs.
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

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { getComponentsStorageMode } from '../../documents/editor/EditorContext';
import { INPUT_TEXTFIELD_SX } from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import LabelProperty from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

import type { FetchableLibraryCategory } from './dnd';
import { localRenameSavedComponent, localRenameTemplate } from './localLibraryStore';
import { DIALOG_PAPER_PROPS } from './styles';
import TagsInput from './TagsInput';

const MAX_NAME = 100;

export type RenameSubtreeTarget = {
  category: FetchableLibraryCategory;
  /** Axis directory: role (sections), type (primitives), shape (layouts), '' (templates). */
  axis: string;
  id: string;
  name: string;
  description?: string;
  tags?: string[];
};

export type RenameSubtreeDialogProps = {
  /** Item to edit; null hides the dialog. */
  target: RenameSubtreeTarget | null;
  onClose: () => void;
  onRenamed?: (id: string) => void;
};

function buildPutUrl(target: RenameSubtreeTarget): string {
  const base = resolveBackendUrl();
  const id = encodeURIComponent(target.id);
  switch (target.category) {
    case 'section':
      return `${base}/dev/sections/${encodeURIComponent(target.axis)}/${id}`;
    case 'primitive':
      return `${base}/dev/primitives/${encodeURIComponent(target.axis)}/${id}`;
    case 'layout':
      return `${base}/dev/layouts/${encodeURIComponent(target.axis)}/${id}`;
    case 'template':
      return `${base}/dev/templates/${id}`;
  }
}

export default function RenameSubtreeDialog({
  target,
  onClose,
  onRenamed,
}: RenameSubtreeDialogProps) {
  const { t } = useTranslation('inspector');
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setName(target.name);
      setTags(target.tags ?? []);
      setError(null);
    }
  }, [target]);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= MAX_NAME;
  const isDirty =
    target !== null &&
    (trimmedName !== target.name || JSON.stringify(tags) !== JSON.stringify(target.tags ?? []));

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!target || !isValid || !isDirty || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      if (getComponentsStorageMode() === 'local') {
        // Local mode persists all savable categories in localStorage.
        if (target.category === 'template') {
          localRenameTemplate(target.id, { name: trimmedName, tags });
        } else {
          localRenameSavedComponent(target.category, target.id, { name: trimmedName, tags });
        }
        onRenamed?.(target.id);
        onClose();
        return;
      }
      const response = await fetch(buildPutUrl(target), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          tags,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      onRenamed?.(target.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }, [target, isValid, isDirty, submitting, trimmedName, tags, onClose, onRenamed]);

  return (
    <Dialog
      open={target !== null}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: DIALOG_PAPER_PROPS }}
    >
      <DialogTitle>{t('componentsLibrary.rename.title', 'Rename component')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <div>
            <LabelProperty label={t('componentsLibrary.save.nameLabel', 'Name')} />
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              fullWidth
              disabled={submitting}
              slotProps={{ htmlInput: { maxLength: MAX_NAME } }}
              helperText={`${trimmedName.length}/${MAX_NAME}`}
              sx={INPUT_TEXTFIELD_SX}
            />
          </div>
          <TagsInput value={tags} onChange={setTags} disabled={submitting} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {t('componentsLibrary.save.close', 'Cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid || !isDirty || submitting}
        >
          {submitting
            ? t('componentsLibrary.save.submitting', 'Saving…')
            : t('componentsLibrary.rename.submit', 'Save changes')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
