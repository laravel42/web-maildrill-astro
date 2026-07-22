/**
 * SaveTemplateDialog — captures the FULL current document (root
 * EmailLayout + every descendant) and persists it on the backend as a
 * reusable template.
 *
 * Lives in the inspector "root" view next to "Save as theme". Templates
 * apply by REPLACING the current document — see
 * `ApplyTemplateConfirmDialog` for the confirmation modal shown on
 * apply.
 *
 * Identity is server-minted UUID v4 (L42-309). The user only chooses a
 * `name` and an optional `description`; the backend renumbers all ids
 * with `component-{shortId}-{n}` and writes a metadata header on
 * line 1 of the resulting NDJSON file.
 */

import React, { useCallback, useMemo, useState } from 'react';
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

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import { editorStateStore, getComponentsStorageMode } from '../../documents/editor/EditorContext';
import { INPUT_TEXTFIELD_SX } from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import LabelProperty from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

import { localSaveTemplate } from './localLibraryStore';
import { DIALOG_PAPER_PROPS } from './styles';
import TagsInput from './TagsInput';
import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

const MAX_NAME = 100;

export type SaveTemplateDialogProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Collect the full document anchored at `root`, BFS order. The first
 * entry is always the EmailLayout root — the backend rejects payloads
 * whose first block is not an EmailLayout.
 *
 * EmailLayout's children live at `data.childrenIds` (not
 * `data.props.childrenIds`); Container/ColumnsContainer use
 * `data.props.childrenIds` and `data.props.columns[].childrenIds`.
 * This helper handles both shapes.
 */
function collectDocument(): Array<{ id: string; block: unknown }> {
  const document = editorStateStore.getState().document;
  const visited = new Set<string>();
  const ordered: Array<{ id: string; block: unknown }> = [];
  const queue: string[] = ['root'];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const block = document[id];
    if (!block) continue;
    visited.add(id);
    ordered.push({ id, block });

    const data = (block.data as Record<string, unknown> | undefined) ?? {};
    // EmailLayout children are at data.childrenIds.
    if (Array.isArray((data as { childrenIds?: unknown }).childrenIds)) {
      for (const childId of (data as { childrenIds: string[] }).childrenIds) {
        if (typeof childId === 'string' && !visited.has(childId)) queue.push(childId);
      }
    }
    // Container / ColumnsContainer children live under data.props.
    const props = (data as { props?: Record<string, unknown> }).props;
    if (props && Array.isArray((props as { childrenIds?: unknown }).childrenIds)) {
      for (const childId of (props as { childrenIds: string[] }).childrenIds) {
        if (typeof childId === 'string' && !visited.has(childId)) queue.push(childId);
      }
    }
    if (props && Array.isArray((props as { columns?: unknown }).columns)) {
      for (const col of (props as { columns: Array<{ childrenIds?: string[] }> }).columns) {
        if (Array.isArray(col.childrenIds)) {
          for (const childId of col.childrenIds) {
            if (typeof childId === 'string' && !visited.has(childId)) queue.push(childId);
          }
        }
      }
    }
  }

  return ordered;
}

export default function SaveTemplateDialog({ open, onClose }: SaveTemplateDialogProps) {
  const { t } = useTranslation('inspector');
  const [name, setName] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= MAX_NAME;

  const blocks = useMemo(() => (open ? collectDocument() : []), [open]);

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      // Local storage mode: persist to localStorage (no thumbnail capture).
      if (getComponentsStorageMode() === 'local') {
        const result = localSaveTemplate({ name: trimmedName, tags, blocks });
        setSuccess(
          t('componentsLibrary.save.successDetailed', 'Saved → {{path}} ({{count}} blocks)', {
            path: result.saved,
            count: result.blockCount,
          })
        );
        setName('');
        setTags([]);
        onClose();
        return;
      }

      // Capture a thumbnail for the full document. Templates always
      // root at EmailLayout, so buildSubtreeHtml passes through the
      // document unchanged.
      let thumbnailBlob: Blob | null = null;
      try {
        const docMap: Record<string, unknown> = {};
        for (const entry of blocks) {
          docMap[entry.id] = entry.block;
        }
        const html = buildSubtreeHtml(docMap as Parameters<typeof buildSubtreeHtml>[0], 'root');
        thumbnailBlob = await captureSubtreeThumbnail(html, { variant: 'template' });
        if (thumbnailBlob) {
          console.info(
            '[SaveTemplateDialog] captured thumbnail',
            `${(thumbnailBlob.size / 1024).toFixed(1)} KB`,
            thumbnailBlob.type || '(unknown type)'
          );
        }
      } catch (captureErr) {
        // Capture failures are non-fatal — proceed with save without thumbnail.

        console.warn('[SaveTemplateDialog] thumbnail capture failed:', captureErr);
      }

      const url = `${resolveBackendUrl()}/dev/save-template`;
      const payload = {
        name: trimmedName,
        tags,
        blocks,
      };

      const buildMultipartForm = (blob: Blob): FormData => {
        const form = new FormData();
        form.set('payload', JSON.stringify(payload));
        const ext = blob.type === 'image/webp' ? 'webp' : 'png';
        form.set('thumbnail', blob, `thumbnail.${ext}`);
        return form;
      };

      const postJson = (): Promise<Response> =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

      let response: Response;
      if (thumbnailBlob) {
        response = await fetch(url, { method: 'POST', body: buildMultipartForm(thumbnailBlob) });
        // 413 with a thumbnail means the captured image exceeded the
        // backend's storage cap. Retry as plain JSON so the save
        // succeeds without the preview.
        if (response.status === 413) {
          console.warn(
            '[SaveTemplateDialog] thumbnail rejected as too large; retrying save without it',
            `${(thumbnailBlob.size / 1024).toFixed(1)} KB`
          );
          response = await postJson();
        }
      } else {
        response = await postJson();
      }
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string; issues?: unknown } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const result = (await response.json()) as { id: string; saved: string; blockCount: number };
      setSuccess(
        t('componentsLibrary.save.successDetailed', 'Saved → {{path}} ({{count}} blocks)', {
          path: result.saved,
          count: result.blockCount,
        })
      );
      setName('');
      setTags([]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onClose is a stable parent prop; adding it would rebuild the submit handler on every parent render
  }, [isValid, submitting, trimmedName, tags, blocks, t]);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: DIALOG_PAPER_PROPS }}
    >
      <DialogTitle>{t('componentsLibrary.save.titleTemplate', 'Save document as template')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {t(
              'componentsLibrary.saveTemplate.body',
              'Captures the full document ({{count}} blocks) as a reusable template. Apply it later from the Components Library Templates tab; applying replaces the current document.',
              { count: blocks.length }
            )}
          </Typography>

          <div>
            <LabelProperty label={t('componentsLibrary.save.nameLabel', 'Name')} />
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('componentsLibrary.saveTemplate.namePlaceholder', 'e.g. Welcome newsletter')}
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
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('componentsLibrary.save.close', 'Close')}
        </Button>
        <Button onClick={handleSubmit} variant="contained" disabled={!isValid || submitting || blocks.length === 0}>
          {submitting
            ? t('componentsLibrary.save.submitting', 'Saving…')
            : t('componentsLibrary.saveTemplate.submit', 'Save template')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
