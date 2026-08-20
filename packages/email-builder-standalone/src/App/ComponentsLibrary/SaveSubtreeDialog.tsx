/**
 * SaveSubtreeDialog — captures the currently selected subtree and
 * persists it on the backend as a Section (Templates have their own
 * dialog at the document level — see `SaveTemplateDialog`).
 *
 * Sections-only (library-first-block-insertion plan): Primitives and
 * Layouts no longer have a save path from this dialog. The trigger in
 * `TuneMenu` already gates on `classifyBlockSubtree(...) === 'section'`,
 * so this dialog should only ever be opened for a valid Section — the
 * classify call here is a safety net (e.g. the document changed
 * between the button render and the dialog open) that shows an error
 * instead of silently failing.
 *
 *   section → POST /dev/save-section (axis = user-chosen role)
 *
 * Identity is server-minted UUID v4 — the user only chooses a `name`
 * and an optional `description`. The backend renumbers child ids and
 * writes a metadata header on line 1 of the resulting NDJSON file.
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
  FormHelperText,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';

import { resolveBackendUrl } from '../../components/UnsplashImagePicker/unsplash-api';
import {
  classifyBlockSubtree,
  type SubtreeCategory,
} from '../../documents/editor/classifyBlockSubtree';
import { editorStateStore, getComponentsStorageMode } from '../../documents/editor/EditorContext';
import { INPUT_TEXTFIELD_SX } from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import CustomSelect from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/Select';
import LabelProperty from '../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

import { localSaveSavedComponent } from './localLibraryStore';
import { DIALOG_PAPER_PROPS } from './styles';
import TagsInput from './TagsInput';
import { buildSubtreeHtml } from './thumbnail/buildThumbnailHtml';
import { captureSubtreeThumbnail } from './thumbnail/captureThumbnail';

const MAX_NAME = 100;

/** Roles supported by the dev save-section endpoint — must match RecipeRole on the backend. */
const ROLES = [
  { value: 'hero', label: 'Hero' },
  { value: 'features', label: 'Features' },
  { value: 'social_proof', label: 'Social proof' },
  { value: 'cta', label: 'CTA' },
  { value: 'header', label: 'Header' },
  { value: 'footer', label: 'Footer' },
  { value: 'nav', label: 'Nav' },
  { value: 'logo', label: 'Logo' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'testimonial', label: 'Testimonial' },
  { value: 'stats', label: 'Stats' },
  { value: 'steps', label: 'Steps' },
  { value: 'faq', label: 'FAQ' },
  { value: 'team', label: 'Team' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'banner', label: 'Banner' },
] as const;

type Role = (typeof ROLES)[number]['value'];

export type SaveSubtreeDialogProps = {
  open: boolean;
  /** Block id that anchors the subtree to capture. */
  rootBlockId: string;
  onClose: () => void;
};

/**
 * Collect a block and every descendant id reachable through `childrenIds`
 * and `columns[].childrenIds`. Returns blocks in BFS order so the root
 * sits at index 0 — the backend renumbers in input order.
 */
function collectSubtree(rootId: string): Array<{ id: string; block: unknown }> {
  const document = editorStateStore.getState().document;
  const visited = new Set<string>();
  const ordered: Array<{ id: string; block: unknown }> = [];
  const queue: string[] = [rootId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    const block = document[id];
    if (!block) continue;
    visited.add(id);
    ordered.push({ id, block });

    const props = (block.data as { props?: Record<string, unknown> } | undefined)?.props;
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

/** Endpoint URL + body shape for the Section save request. */
function buildSaveRequest(payload: {
  name: string;
  role: Role;
  tags: string[];
  blocks: Array<{ id: string; block: unknown }>;
}): { url: string; body: Record<string, unknown> } {
  const base = resolveBackendUrl();
  return {
    url: `${base}/dev/save-section`,
    body: {
      name: payload.name,
      role: payload.role,
      tags: payload.tags,
      blocks: payload.blocks,
    },
  };
}

export default function SaveSubtreeDialog({ open, rootBlockId, onClose }: SaveSubtreeDialogProps) {
  const { t } = useTranslation('inspector');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('hero');
  const [tags, setTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const trimmedName = name.trim();
  const isValid = trimmedName.length > 0 && trimmedName.length <= MAX_NAME;

  const blocks = useMemo(() => (open ? collectSubtree(rootBlockId) : []), [open, rootBlockId]);

  // Resolve category and the on-disk axis (when fixed). Errors thrown
  // by classifyBlockSubtree (e.g. block id was deleted between the
  // TuneMenu render and the dialog open) bubble up via state.
  const { category, classifyError } = useMemo(() => {
    if (!open) {
      return { category: null as SubtreeCategory | null, classifyError: null };
    }
    try {
      const document = editorStateStore.getState().document;
      const cat = classifyBlockSubtree(rootBlockId, document);
      return { category: cat, classifyError: null as string | null };
    } catch (err) {
      return {
        category: null,
        classifyError: err instanceof Error ? err.message : String(err),
      };
    }
  }, [open, rootBlockId]);

  // Sections-only: any other classification is a stale-state guard —
  // `TuneMenu` already disables the trigger unless the subtree
  // classifies as 'section', so this only fires if the document
  // changed between that check and the dialog opening.
  const isSection = category === 'section';

  const dialogTitle = t('componentsLibrary.save.title', 'Save block as section');

  const handleSubmit = useCallback(async () => {
    if (!isValid || submitting || !isSection) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload = {
      name: trimmedName,
      role,
      tags,
      blocks,
    };

    // Local storage mode: persist the captured subtree to localStorage.
    // No backend POST and no thumbnail capture (local cards use a
    // placeholder / inline render). Axis = user-chosen role.
    if (getComponentsStorageMode() === 'local') {
      try {
        const result = localSaveSavedComponent('section', {
          name: trimmedName,
          tags,
          axis: role,
          blocks,
        });
        setSuccess(
          t('componentsLibrary.save.successDetailed', 'Saved → {{path}} ({{count}} blocks)', {
            path: result.saved,
            count: result.blockCount,
          }),
        );
        setName('');
        setTags([]);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const request = buildSaveRequest(payload);

    // Sections always benefit from a static thumbnail.
    const captureForCategory = true;

    try {
      let thumbnailBlob: Blob | null = null;
      if (captureForCategory) {
        try {
          // Build a TReaderDocument-shaped map from the BFS-collected
          // entries plus the current EmailLayout backdrop/canvas
          // colours so the captured PNG visually matches what the
          // user is editing.
          const docMap: Record<string, unknown> = {};
          for (const entry of blocks) {
            docMap[entry.id] = entry.block;
          }
          const currentRoot = editorStateStore.getState().document['root'];
          const rootData = (currentRoot?.data ?? {}) as {
            backdropColor?: string;
            canvasColor?: string;
          };
          const html = buildSubtreeHtml(
            // Type cast: collectSubtree returns block objects shaped
            // identically to TReaderDocument entries; the type we
            // import from @eb/email-builder is structurally compatible.
            docMap as Parameters<typeof buildSubtreeHtml>[0],
            rootBlockId,
            {
              backdropColor: rootData.backdropColor,
              canvasColor: rootData.canvasColor,
            },
          );
          thumbnailBlob = await captureSubtreeThumbnail(html, { variant: 'subtree' });
          if (thumbnailBlob) {
            console.info(
              '[SaveSubtreeDialog] captured thumbnail',
              `${(thumbnailBlob.size / 1024).toFixed(1)} KB`,
              thumbnailBlob.type || '(unknown type)',
            );
          }
        } catch (captureErr) {
          // Capture failures are non-fatal — proceed with save without thumbnail.

          console.warn('[SaveSubtreeDialog] thumbnail capture failed:', captureErr);
        }
      }

      /**
       * Build the multipart form. Filename extension reflects the
       * actual blob mime type so the backend logs / disk artifacts
       * stay consistent — although the backend re-detects format
       * from magic bytes regardless of the filename, so this is
       * cosmetic.
       */
      const buildMultipartForm = (blob: Blob): FormData => {
        const form = new FormData();
        form.set('payload', JSON.stringify(request.body));
        const ext = blob.type === 'image/webp' ? 'webp' : 'png';
        form.set('thumbnail', blob, `thumbnail.${ext}`);
        return form;
      };

      const postJson = (): Promise<Response> =>
        fetch(request.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request.body),
        });

      let response: Response;
      if (thumbnailBlob) {
        response = await fetch(request.url, {
          method: 'POST',
          body: buildMultipartForm(thumbnailBlob),
        });
        // 413 with a thumbnail means the captured image exceeded the
        // backend's storage cap. Retry as plain JSON so the save
        // succeeds without the preview — the user can re-trigger a
        // capture later via the manual "Generate preview" menu (Task 12).
        if (response.status === 413) {
          console.warn(
            '[SaveSubtreeDialog] thumbnail rejected as too large; retrying save without it',
            `${(thumbnailBlob.size / 1024).toFixed(1)} KB`,
          );
          response = await postJson();
        }
      } else {
        // Plain JSON path (capture-failed).
        response = await postJson();
      }

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as {
          error?: string;
          issues?: unknown;
        } | null;
        throw new Error(body?.error ?? `HTTP ${response.status}`);
      }
      const result = (await response.json()) as { id: string; saved: string; blockCount: number };
      setSuccess(
        t('componentsLibrary.save.successDetailed', 'Saved → {{path}} ({{count}} blocks)', {
          path: result.saved,
          count: result.blockCount,
        }),
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
  }, [isValid, submitting, isSection, trimmedName, role, tags, blocks, rootBlockId, t]);

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{ paper: DIALOG_PAPER_PROPS }}
    >
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={0} sx={{ mt: 1 }}>
          {classifyError && <Alert severity="error">{classifyError}</Alert>}

          <div>
            <LabelProperty label={t('componentsLibrary.save.nameLabel', 'Name')} />
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('componentsLibrary.save.namePlaceholder', 'e.g. Hero bold purple')}
              autoFocus
              fullWidth
              disabled={submitting}
              slotProps={{ htmlInput: { maxLength: MAX_NAME } }}
              helperText={`${trimmedName.length}/${MAX_NAME}`}
              sx={INPUT_TEXTFIELD_SX}
            />
          </div>

          {isSection && (
            <div>
              <LabelProperty label={t('componentsLibrary.save.roleLabel', 'Role')} />
              <CustomSelect
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                disabled={submitting}
                size="small"
              >
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </CustomSelect>
              <FormHelperText>
                {t(
                  'componentsLibrary.save.roleHelp',
                  'hero / features / social_proof / cta participate in the AI rotation pool.',
                )}
              </FormHelperText>
            </div>
          )}

          <TagsInput value={tags} onChange={setTags} disabled={submitting} />

          {category !== null && !isSection && (
            <Alert severity="info">
              {t(
                'componentsLibrary.save.unsupportedCategory',
                'Only sections (a container or columns block with content) can be saved to the library.',
              )}
            </Alert>
          )}

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>
          {t('componentsLibrary.save.close', 'Close')}
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isValid || submitting || blocks.length === 0 || !isSection}
        >
          {submitting
            ? t('componentsLibrary.save.submitting', 'Saving…')
            : t('componentsLibrary.save.submit', 'Save component')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
