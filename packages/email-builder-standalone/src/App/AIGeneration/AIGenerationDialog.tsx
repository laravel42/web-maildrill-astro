import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

import type { AIGenerateTemplateRequest, AIGenerateTemplateResponse } from '../..';
import type { TEditorConfiguration } from '../../documents/editor/core';
import { editorStateStore, resetDocument } from '../../documents/editor/EditorContext';

import AIPreviewPanel from './AIPreviewPanel';
import AiSparkleIcon from './AiSparkleIcon';
import { trackUnsplashFromDocument } from './trackUnsplashFromDocument';
import { isValidationFailure, validateGeneratedTemplate } from './validateGeneratedTemplate';
import AIVisualWizard from './Wizard/AIVisualWizard';
import type { DraftBrief } from './Wizard/briefDefaults';
import PillButton from './Wizard/controls/PillButton';
import EntryPicker from './Wizard/EntryPicker';
import WizardHeader from './Wizard/WizardHeader';

type OnAIGenerateTemplate = (
  request: AIGenerateTemplateRequest,
  options: { signal: AbortSignal }
) => Promise<AIGenerateTemplateResponse>;

/**
 * Lifecycle of a single generation attempt.
 *
 * - `idle`      → dialog open, prompt editable, no request in flight.
 * - `thinking`  → callback invoked, Promise pending (network / pre-stream).
 * - `streaming` → callback resolved with a stream or a full configuration.
 *                 `AIPreviewPanel` consumes the response and drives completion.
 * - `complete`  → stream terminator received (or sync response returned).
 *                 L42-187 wires the Apply button here.
 * - `error`     → callback rejected, stream errored, or the parser surfaced
 *                 a fatal `event: error` frame. Prompt stays editable; user
 *                 can Retry without losing it.
 *
 * `cancelled` is not a distinct state — Cancel aborts the controller and
 * resets to `idle` keeping the prompt so the user can edit and retry.
 */
type Status = 'idle' | 'thinking' | 'streaming' | 'complete' | 'error';

/**
 * Two entry flows exposed by the dialog:
 *
 * - `new`    → the default. The prompt is interpreted as the full description
 *              of an email to generate from scratch. No `currentDocument`
 *              is sent, giving the LLM a blank canvas.
 * - `refine` → the prompt is interpreted as instructions applied on top of
 *              the document currently loaded in the editor. `currentDocument`
 *              is read at generate-time from `editorStateStore.getState()`
 *              and sent in the request so the LLM iterates on the existing
 *              template rather than discarding it.
 *
 * Both modes use the same NDJSON-per-block streaming contract; the backend
 * always re-emits the full template, so Apply still calls `resetDocument`.
 */
type GenerationMode = 'new' | 'refine';

/**
 * Detect whether a NotionText HTML payload is trivially empty — i.e. the
 * default pristine state (`<p></p>`) that the empty-email-message template
 * ships with. Treated as "empty" so we don't force Refine mode on users who
 * never actually edited the starter block.
 */
function isTrivialNotionHtml(html: unknown): boolean {
  if (typeof html !== 'string') return true;
  // Strip empty <p> / <p><br></p> wrappers and any remaining whitespace.
  const stripped = html.replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '').replace(/\s/g, '');
  return stripped.length === 0;
}

/**
 * Pick the initial {@link GenerationMode} for the dialog based on the shape
 * of the document currently loaded in the editor.
 *
 * Heuristic, in priority order:
 *
 *  1. The document has more than `root` + one child ⇒ the user clearly built
 *     something on top of the default template ⇒ `refine`.
 *  2. Exactly `root` + one child, where the child is a *trivial* default
 *     (pristine NotionText or a plain Spacer) ⇒ nothing meaningful to
 *     refine ⇒ `new`.
 *  3. Exactly `root` + one child of any other type, or a child with
 *     non-trivial content ⇒ user deliberately placed or edited something
 *     ⇒ `refine`.
 *  4. Only `root` (or empty doc) ⇒ `new`.
 *
 * We intentionally avoid looking at the undo/redo stack here: `resetDocument`
 * clears undo history, which would incorrectly collapse any existing
 * template back to "new" on the first open after an Apply.
 */
function pickDefaultMode(document: TEditorConfiguration): GenerationMode {
  const ids = Object.keys(document);
  if (ids.length > 2) return 'refine';
  if (ids.length <= 1) return 'new';
  const childId = ids.find((id) => id !== 'root');
  if (!childId) return 'new';
  const child = document[childId];
  if (!child) return 'new';
  if (child.type === 'NotionText') {
    const html = (child.data as { props?: { html?: unknown } } | undefined)?.props?.html;
    return isTrivialNotionHtml(html) ? 'new' : 'refine';
  }
  if (child.type === 'Spacer') {
    // The production empty template uses a single Spacer — treat as blank.
    return 'new';
  }
  // Any other single block type means the user intentionally placed it.
  return 'refine';
}

export type AIGenerationDialogProps = {
  open: boolean;
  onClose: () => void;
  onAIGenerateTemplate: OnAIGenerateTemplate;
  locale?: string;
  /** Backend base URL — forwarded to the Wizard for compileBrief calls. */
  backendUrl?: string;
  /** Brand colours forwarded from EmailBuilder props — pre-fill Step 3. */
  primaryColor?: string;
  secondaryColor?: string;
};

const ENTRY_MODE_KEY = 'emailbuilder.aiEntryMode';

type EntryMode = 'picker' | 'direct' | 'wizard';

export default function AIGenerationDialog({
  open,
  onClose,
  onAIGenerateTemplate,
  locale,
  // Route AI-generation calls (improve-prompt, wizard compile/theme) through
  // the host's same-origin BFF proxy — the SAME `/api/eb/*` path the template
  // generation and inline text AI already use — instead of a direct
  // cross-origin fetch to a raw backend (which failed with CORS / "Failed to
  // fetch"). The proxy prepends `/api/`, so callers use `${backendUrl}/<name>`.
  backendUrl = '/api/eb',
  primaryColor,
  secondaryColor,
}: AIGenerationDialogProps) {
  const { t } = useTranslation('inspector');
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<GenerationMode>('new');
  const [entryMode, setEntryMode] = useState<EntryMode>('picker');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isImprovingPrompt, setIsImprovingPrompt] = useState(false);
  // Zod / structural validation issues surfaced when the AI response is
  // schema-invalid. Mutually exclusive with runtime errors: when this is
  // non-null the error Alert renders the validation UI instead of the
  // generic runtime-error UI.
  const [validationIssues, setValidationIssues] = useState<string[] | null>(null);
  // Non-blocking stream diagnostics (backend duplicate-id remaps, malformed
  // line reports). Rendered in a yellow Alert below the blocking error
  // Alert when present. The dialog still enables Apply when only these are
  // present — the document is valid, the user is just being informed.
  const [streamWarnings, setStreamWarnings] = useState<string[] | null>(null);
  const [response, setResponse] = useState<AIGenerateTemplateResponse | null>(null);
  // Fully-accumulated document once the preview panel signals completion.
  // Read by the Apply button to hand off to `resetDocument`.
  const [completedDocument, setCompletedDocument] = useState<TEditorConfiguration | null>(null);
  // Whether the close-confirmation dialog is visible.
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  // Force the wizard subtree to remount on every dialog open so brief state
  // and SummaryStep compile are fresh.
  const [wizardKey, setWizardKey] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);

  // When the dialog opens, restore the last entry mode from localStorage.
  // We do NOT reset the prompt, wizard answers, or entry mode — they stay
  // in memory so reopening the dialog resumes exactly where the user left off.
  // Generation state (status, errors, response) is always reset so the user
  // starts a fresh attempt on every open.
  useEffect(() => {
    if (!open) return;
    setMode(pickDefaultMode(editorStateStore.getState().document));
    setStatus('idle');
    setErrorMessage(null);
    setValidationIssues(null);
    setStreamWarnings(null);
    setResponse(null);
    setCompletedDocument(null);
    // Force the wizard subtree to remount on every dialog open so brief state,
    // SummaryStep compile, and useVisualBrief are all re-initialised fresh.
    setWizardKey((k) => k + 1);
    // Restore entry mode only on the very first open (when entryMode is still
    // 'picker' and there is no prompt). Once the user has made a choice we
    // leave their state untouched.
    if (entryMode === 'picker' && !prompt) {
      try {
        const stored = localStorage.getItem(ENTRY_MODE_KEY) as EntryMode | null;
        setEntryMode(stored === 'direct' || stored === 'wizard' ? stored : 'picker');
      } catch {
        setEntryMode('picker');
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up any in-flight request if the dialog is unmounted.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    };
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    // Abort any stale in-flight controller before starting a new attempt.
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('thinking');
    setErrorMessage(null);
    setValidationIssues(null);
    setStreamWarnings(null);
    setResponse(null);
    setCompletedDocument(null);

    try {
      // Read the latest document snapshot at click-time to avoid stale
      // closures over React state and keep the dialog from subscribing to
      // the store (which would re-render on every block edit). Only sent
      // when the user explicitly chose the Refine flow.
      const currentDocument = mode === 'refine' ? editorStateStore.getState().document : undefined;
      const result = await onAIGenerateTemplate(
        { prompt: trimmed, currentDocument, locale },
        { signal: controller.signal }
      );
      if (controller.signal.aborted) return;
      setResponse(result);
      setStatus('streaming');
    } catch (err) {
      if (controller.signal.aborted) return;
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  }, [prompt, locale, mode, onAIGenerateTemplate]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setStatus('idle');
    setErrorMessage(null);
    setValidationIssues(null);
    setStreamWarnings(null);
    setResponse(null);
    setCompletedDocument(null);
  }, []);

  const handleDialogClose = useCallback(() => {
    const busy = status === 'thinking' || status === 'streaming';
    const hasProgress = busy || prompt.trim().length > 0 || entryMode === 'wizard';
    if (hasProgress) {
      setConfirmCloseOpen(true);
      return;
    }
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    onClose();
  }, [status, prompt, entryMode, onClose]);

  const handleConfirmedClose = useCallback(() => {
    setConfirmCloseOpen(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    // Reset prompt so reopening starts fresh.
    setPrompt('');
    setEntryMode('picker');
    try {
      localStorage.removeItem(ENTRY_MODE_KEY);
    } catch {
      /* ignore */
    }
    onClose();
  }, [onClose]);

  const handleApply = useCallback(() => {
    if (!completedDocument) return;
    // Fire the Unsplash §6 download-tracking pings before we hand the
    // document to the editor — this only counts a "use" against the
    // photographer's analytics when the user actually commits the
    // generated template (Apply), not when previewing or discarding.
    // The tracker is fire-and-forget so it never blocks the editor swap.
    trackUnsplashFromDocument(completedDocument);
    // Deep clone so subsequent dialog runs can't mutate the editor state by
    // reference. Mirrors the pattern EmailBuilder uses when loading `data`.
    resetDocument(JSON.parse(JSON.stringify(completedDocument)));
    // Clear the dialog-level prompt so the wizard's initialRawIntent is empty
    // on the next dialog open. Without this a stale compiled prompt leaks
    // into useVisualBrief.rawIntent and SummaryStep.buildFallback serves it
    // immediately, making every subsequent generation identical.
    setPrompt('');
    onClose();
  }, [completedDocument, onClose]);

  // Stable callbacks passed down to AIPreviewPanel. The panel captures these
  // once at mount (exhaustive-deps disabled on its effect by design), so
  // referential stability matters.
  const handlePreviewComplete = useCallback(
    (
      document: TEditorConfiguration,
      meta: { duplicateIds: string[]; streamErrors: string[]; streamWarnings: string[] }
    ) => {
      // Two severities of issue coming out of the stream:
      //
      //   - Blocking  → the document is structurally invalid or content was
      //     lost. Apply must stay disabled. Zod schema failures, broken
      //     childrenIds, and client-side duplicate detections fall here
      //     (the latter only fire if a backend other than @eb/backend
      //     forgot to dedup — our backend now remaps duplicates instead of
      //     dropping them, so content is preserved and no client-side
      //     duplicate arrives).
      //
      //   - Warnings → the stream reported something worth knowing but the
      //     document is still valid. Backend remaps (`duplicate_id`
      //     action: `remapped`) and malformed-line reports live here.
      //     Apply stays enabled; the user sees the info alongside the
      //     preview.
      const validation = validateGeneratedTemplate(document);
      const zodIssues = isValidationFailure(validation) ? validation.issues : [];
      const duplicateIssues = meta.duplicateIds.map(
        (id) => `Block id "${id}" was emitted more than once and got overwritten`
      );
      const blockingIssues = [...zodIssues, ...duplicateIssues];
      const warnings = [...meta.streamWarnings, ...meta.streamErrors];

      setStreamWarnings(warnings.length > 0 ? warnings : null);

      if (blockingIssues.length > 0) {
        setValidationIssues(blockingIssues);
        setStatus('error');
        return;
      }

      // Happy path — or warnings-only. Apply is unlocked either way.
      setValidationIssues(null);
      setCompletedDocument(isValidationFailure(validation) ? null : validation.data);
      setStatus('complete');
    },
    []
  );

  const handlePreviewError = useCallback((message: string) => {
    setErrorMessage(message);
    setValidationIssues(null);
    setStatus('error');
  }, []);

  const isBusy = status === 'thinking' || status === 'streaming';
  const canGenerate = prompt.trim().length > 0 && !isBusy;
  // Keep the preview panel mounted once a stream has been kicked off, even
  // when we transition to `error`. That way the user can still see the raw
  // NDJSON frames log and copy the full response for debugging — otherwise
  // the panel gets unmounted on the first error event and the frames are
  // lost.
  const showPreview = (status === 'streaming' || status === 'complete' || status === 'error') && response !== null;
  const stretchPrompt = entryMode === 'direct' && !showPreview;

  // Example prompts shown as clickable chips under the textarea. Hidden while
  // a generation is in flight, after completion, and cleared from noise by
  // restricting visibility to the `idle` and `error` states — the two states
  // where picking a direction actually makes sense.
  const showSuggestions = status === 'idle' || status === 'error';
  // i18next returns arrays / objects verbatim when `returnObjects` is set.
  // The default return type is `string`; casting here keeps the call sites
  // tidy and defensive (falls back to an empty array if the key is missing
  // in a custom locale the host app plugged in). Refine mode uses its own
  // suggestion set because refine prompts describe *changes* to the current
  // template (e.g. "make the CTA orange") — reusing the new-email suggestions
  // would produce confusing results.
  const suggestionsKey =
    mode === 'refine' ? 'aiGeneration.dialog.suggestionsRefine' : 'aiGeneration.dialog.suggestions';
  const suggestionsRaw = t(suggestionsKey, {
    returnObjects: true,
    defaultValue: [] as Array<{ label: string; prompt: string }>,
  }) as unknown;
  const suggestions: Array<{ label: string; prompt: string }> = Array.isArray(suggestionsRaw)
    ? (suggestionsRaw.filter(
        (s) =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as { label?: unknown }).label === 'string' &&
          typeof (s as { prompt?: unknown }).prompt === 'string'
      ) as Array<{ label: string; prompt: string }>)
    : [];

  const handleSuggestionClick = useCallback((nextPrompt: string) => {
    // Replace the textarea content unconditionally. Users can still edit
    // afterwards; preserving half-typed text would leave confusing mixed
    // prompts that harm the generation quality.
    setPrompt(nextPrompt);
  }, []);

  const handleImprovePrompt = useCallback(async () => {
    if (!prompt.trim() || isImprovingPrompt) return;

    setIsImprovingPrompt(true);
    try {
      const response = await fetch(`${backendUrl}/improve-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setPrompt(result.improved);
    } catch (error) {
      console.error('Failed to improve prompt:', error);
      // Silently fail - user can still use original prompt
    } finally {
      setIsImprovingPrompt(false);
    }
  }, [prompt, isImprovingPrompt, backendUrl]);

  // ---------------------------------------------------------------------------
  // Entry mode (picker / direct / wizard) handlers
  // ---------------------------------------------------------------------------

  const handleEntrySelect = useCallback((selected: 'direct' | 'wizard') => {
    setEntryMode(selected);
    try {
      localStorage.setItem(ENTRY_MODE_KEY, selected);
    } catch {
      /* ignore */
    }
  }, []);

  const handleModeSwitch = useCallback(() => {
    setEntryMode((prev) => {
      const next: EntryMode = prev === 'wizard' ? 'direct' : 'wizard';
      // If switching to wizard with existing prompt text, the wizard will
      // receive it as initialRawIntent via key-based remount.
      try {
        localStorage.setItem(ENTRY_MODE_KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  /** Called by AIVisualWizard Summary step's Generate button. */
  const handleWizardGenerate = useCallback(
    async (compiledPrompt: string, _brief: DraftBrief) => {
      setPrompt(compiledPrompt);
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      setStatus('thinking');
      setErrorMessage(null);
      setValidationIssues(null);
      setStreamWarnings(null);
      setResponse(null);
      setCompletedDocument(null);
      try {
        const currentDocument = mode === 'refine' ? editorStateStore.getState().document : undefined;
        const result = await onAIGenerateTemplate(
          { prompt: compiledPrompt, currentDocument, locale },
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        setResponse(result);
        setStatus('streaming');
      } catch (err) {
        if (controller.signal.aborted) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : String(err));
      }
    },
    [mode, locale, onAIGenerateTemplate]
  );

  const handleModeChange = useCallback((_event: React.MouseEvent<HTMLElement>, nextMode: GenerationMode | null) => {
    // MUI ToggleButtonGroup emits `null` when the user clicks the currently
    // selected button (deselect). Ignore that — one of the modes must
    // always be active.
    if (nextMode === null) return;
    setMode(nextMode);
    // Switching modes resets the prompt and any error state. A prompt for
    // "Generate new" reads like a full description of an email; a prompt
    // for "Refine" reads like an instruction delta. Keeping text across
    // modes produces nonsensical requests to the LLM.
    setPrompt('');
    setErrorMessage(null);
    setValidationIssues(null);
    setStreamWarnings(null);
  }, []);

  const renderWarningsAlert = () => {
    if (!streamWarnings || streamWarnings.length === 0) return null;
    return (
      <Alert severity="warning" variant="outlined" sx={{ mt: 1 }}>
        <Typography variant="subtitle2" component="div" sx={{ fontWeight: 600 }}>
          {t('aiGeneration.dialog.warnings.title')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t('aiGeneration.dialog.warnings.hint')}
        </Typography>
        <List dense disablePadding sx={{ mt: 0.5, listStyleType: 'disc', pl: 2.5 }}>
          {streamWarnings.map((msg, i) => (
            <ListItem key={i} disableGutters sx={{ display: 'list-item', py: 0 }}>
              <ListItemText
                primary={msg}
                slotProps={{
                  primary: {
                    variant: 'body2',
                    sx: {
                      wordBreak: 'break-word',
                      fontFamily:
                        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      fontSize: '12px',
                    },
                  },
                }}
              />
            </ListItem>
          ))}
        </List>
      </Alert>
    );
  };

  const renderStatusRow = () => {
    switch (status) {
      case 'thinking':
        return (
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', py: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {t('aiGeneration.dialog.status.thinking')}
            </Typography>
          </Stack>
        );
      case 'complete':
        return (
          <>
            <Alert severity="success" variant="outlined" sx={{ mt: 1 }}>
              {t('aiGeneration.dialog.status.complete')}
            </Alert>
            {renderWarningsAlert()}
          </>
        );
      case 'error':
        if (validationIssues && validationIssues.length > 0) {
          // Schema / structural validation failure on the accumulated doc.
          return (
            <>
              <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
                <Typography variant="subtitle2" component="div" sx={{ fontWeight: 600 }}>
                  {t('aiGeneration.dialog.error.validationTitle')}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {t('aiGeneration.dialog.error.validationHint')}
                </Typography>
                <List dense disablePadding sx={{ mt: 0.5, listStyleType: 'disc', pl: 2.5 }}>
                  {validationIssues.map((issue, i) => (
                    <ListItem key={i} disableGutters sx={{ display: 'list-item', py: 0 }}>
                      <ListItemText
                        primary={issue}
                        slotProps={{
                          primary: {
                            variant: 'body2',
                            sx: {
                              wordBreak: 'break-word',
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                              fontSize: '12px',
                            },
                          },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              </Alert>
              {renderWarningsAlert()}
            </>
          );
        }
        return (
          <>
            <Alert severity="error" variant="outlined" sx={{ mt: 1 }}>
              <Typography variant="subtitle2" component="div" sx={{ fontWeight: 600 }}>
                {t('aiGeneration.dialog.error.title')}
              </Typography>
              {errorMessage && (
                <Typography variant="body2" sx={{ mt: 0.5, wordBreak: 'break-word' }}>
                  {errorMessage}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t('aiGeneration.dialog.error.hint')}
              </Typography>
            </Alert>
            {renderWarningsAlert()}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog
      open={open}
      onClose={(_e, reason) => {
        // Block backdrop click and ESC — only the Close button can dismiss.
        if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
        handleDialogClose();
      }}
      maxWidth={showPreview ? 'lg' : 'sm'}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
            color: 'text.primary',
            borderRadius: '10px',
            minHeight: 500,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '24px' }}>
        {entryMode === 'picker' ? (
          <Stack direction="row" sx={{ gap: 1, alignItems: 'center' }}>
            <AiSparkleIcon fontSize="small" color="primary" />
            <Box component="span">{t('aiGeneration.dialog.title')}</Box>
          </Stack>
        ) : (
          <WizardHeader mode={entryMode as 'direct' | 'wizard'} onSwitch={handleModeSwitch} disabled={isBusy} />
        )}
      </DialogTitle>
      <DialogContent
        sx={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          pb: 0,
          
        }}
      >
        {/* ---------------------------------------------------------------- */}
        {/* ENTRY PICKER                                                      */}
        {/* ---------------------------------------------------------------- */}
        {entryMode === 'picker' && <EntryPicker onSelect={handleEntrySelect} />}

        {/* ---------------------------------------------------------------- */}
        {/* WIZARD MODE                                                       */}
        {/* ---------------------------------------------------------------- */}
        {entryMode === 'wizard' && !showPreview && (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <AIVisualWizard
              key={wizardKey}
              initialRawIntent={prompt}
              backendUrl={backendUrl}
              brandColors={
                primaryColor || secondaryColor ? { primary: primaryColor, secondary: secondaryColor } : undefined
              }
              locale={locale}
              onGenerate={handleWizardGenerate}
              generating={isBusy}
            />
          </Box>
        )}
        {entryMode === 'wizard' && status === 'thinking' && (
          <Stack direction="row" sx={{ gap: 2, alignItems: 'center', py: 1 }}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              {t('aiGeneration.dialog.status.thinking')}
            </Typography>
          </Stack>
        )}
        {entryMode === 'wizard' && status === 'complete' && (
          <Alert severity="success" variant="outlined" sx={{ mt: 1 }}>
            {t('aiGeneration.dialog.status.complete')}
          </Alert>
        )}
        {/* Fatal errors visible in wizard mode too (see direct-mode note). */}
        {entryMode === 'wizard' && status === 'error' && renderStatusRow()}
        {entryMode === 'wizard' && showPreview && response && (
          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AIPreviewPanel response={response} onComplete={handlePreviewComplete} onError={handlePreviewError} />
          </Box>
        )}

        {/* ---------------------------------------------------------------- */}
        {/* DIRECT MODE (unchanged)                                           */}
        {/* ---------------------------------------------------------------- */}
        {entryMode === 'direct' && (
          <Stack sx={{ gap: 1.5, flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <Box sx={{ flexShrink: 0 }}>
              <ToggleButtonGroup
                value={mode}
                exclusive
                onChange={handleModeChange}
                size="small"
                aria-label={t('aiGeneration.dialog.modeLabel')}
                disabled={isBusy}
                sx={{ mb: 1.5 }}
                fullWidth
              >
                <ToggleButton value="new" sx={{ textTransform: 'none', fontWeight: mode === 'new' ? 700 : 500 }}>
                  {t('aiGeneration.dialog.mode.new')}
                </ToggleButton>
                <ToggleButton value="refine" sx={{ textTransform: 'none', fontWeight: mode === 'refine' ? 700 : 500 }}>
                  {t('aiGeneration.dialog.mode.refine')}
                </ToggleButton>
              </ToggleButtonGroup>
              <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
                {mode === 'refine' ? t('aiGeneration.dialog.promptLabelRefine') : t('aiGeneration.dialog.promptLabel')}
              </Typography>
            </Box>
            {stretchPrompt ? (
              <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
                <TextField
                  autoFocus
                  margin="dense"
                  id="ai-generation-prompt"
                  type="text"
                  multiline
                  fullWidth
                  variant="outlined"
                  disabled={isBusy}
                  placeholder={
                    mode === 'refine'
                      ? t('aiGeneration.dialog.promptPlaceholderRefine')
                      : t('aiGeneration.dialog.promptPlaceholder')
                  }
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    '& .MuiInputBase-root': {
                      height: '100%',
                      alignItems: 'flex-start',
                      borderRadius: '6px',
                    },
                    '& textarea': {
                      height: '100% !important',
                      overflow: 'auto !important',
                      boxSizing: 'border-box',
                      resize: 'none',
                    },
                  }}
                />
              </Box>
            ) : (
              <TextField
                autoFocus
                margin="dense"
                id="ai-generation-prompt"
                type="text"
                multiline
                minRows={4}
                maxRows={8}
                fullWidth
                variant="outlined"
                disabled={isBusy}
                placeholder={
                  mode === 'refine'
                    ? t('aiGeneration.dialog.promptPlaceholderRefine')
                    : t('aiGeneration.dialog.promptPlaceholder')
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
              />
            )}
            {showSuggestions && prompt.trim().length > 0 && (
              <Box sx={{ flexShrink: 0 }}>
                <Button
                  size="small"
                  variant="outlined"
                  color="primary"
                  startIcon={isImprovingPrompt ? <CircularProgress size={14} /> : <AiSparkleIcon />}
                  onClick={handleImprovePrompt}
                  disabled={isImprovingPrompt || !prompt.trim()}
                  sx={{
                    textTransform: 'none',
                    fontSize: 13,
                    lineHeight: 1.4,
                    py: 0.625,
                    px: 1.25,
                    minHeight: 30,
                    '& .MuiButton-startIcon': {
                      marginRight: 0.5,
                      marginLeft: -0.25,
                      '& > *:nth-of-type(1)': {
                        fontSize: 14,
                      },
                    },
                  }}
                >
                  {isImprovingPrompt
                    ? t('aiGeneration.dialog.improvingPrompt')
                    : t('aiGeneration.dialog.improvePrompt')}
                </Button>
              </Box>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <Box sx={{ flexShrink: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {t('aiGeneration.dialog.suggestionsLabel')}
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                  {suggestions.map((s) => (
                    <PillButton key={s.label} label={s.label} onClick={() => handleSuggestionClick(s.prompt)} />
                  ))}
                </Stack>
              </Box>
            )}
            {status === 'thinking' && (
              <Stack direction="row" sx={{ gap: 2, alignItems: 'center', py: 1, flexShrink: 0 }}>
                <CircularProgress size={20} />
                <Typography variant="body2" color="text.secondary">
                  {t('aiGeneration.dialog.status.thinking')}
                </Typography>
              </Stack>
            )}
            {status === 'complete' && (
              <Alert severity="success" variant="outlined" sx={{ mt: 1, flexShrink: 0 }}>
                {t('aiGeneration.dialog.status.complete')}
              </Alert>
            )}
            {/* Fatal errors (provider/setup/stream failures or schema-invalid
                output) must be visible so the user sees WHY generation failed
                instead of the dialog silently reverting to a Retry button. */}
            {status === 'error' && renderStatusRow()}
            {showPreview && response && (
              <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <AIPreviewPanel response={response} onComplete={handlePreviewComplete} onError={handlePreviewError} />
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {/* Picker: no actions */}
        {entryMode === 'picker' && (
          <Button onClick={handleDialogClose} color="inherit">
            {t('aiGeneration.dialog.close')}
          </Button>
        )}
        {/* Wizard: actions are inside SummaryStep; only show Close/Cancel here */}
        {entryMode === 'wizard' && (
          <>
            {isBusy ? (
              <Button onClick={handleCancel} color="inherit">
                {t('aiGeneration.dialog.cancel')}
              </Button>
            ) : showPreview ? (
              <>
                <Button onClick={handleDialogClose} color="inherit">
                  {t('aiGeneration.dialog.close')}
                </Button>
                {status === 'complete' && (
                  <Button
                    onClick={handleApply}
                    variant="contained"
                    disabled={!completedDocument}
                    startIcon={undefined}
                  >
                    {t('aiGeneration.dialog.apply')}
                  </Button>
                )}
                {status === 'error' && (
                  <Button
                    onClick={() => handleWizardGenerate(prompt, {} as DraftBrief)}
                    variant="contained"
                    startIcon={undefined}
                  >
                    {t('aiGeneration.dialog.retry')}
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={handleDialogClose} color="inherit">
                {t('aiGeneration.dialog.close')}
              </Button>
            )}
          </>
        )}
        {/* Direct: original action buttons */}
        {entryMode === 'direct' && (
          <>
            {isBusy ? (
              <Button onClick={handleCancel} color="inherit">
                {t('aiGeneration.dialog.cancel')}
              </Button>
            ) : (
              <Button onClick={handleDialogClose} color="inherit">
                {t('aiGeneration.dialog.close')}
              </Button>
            )}
            {status === 'error' ? (
              <Button onClick={handleGenerate} variant="contained" disabled={!canGenerate} startIcon={undefined}>
                {t('aiGeneration.dialog.retry')}
              </Button>
            ) : status === 'complete' ? (
              <Button
                onClick={handleApply}
                variant="contained"
                disabled={!completedDocument}
                startIcon={undefined}
              >
                {t('aiGeneration.dialog.apply')}
              </Button>
            ) : (
              <Button
                onClick={handleGenerate}
                variant="contained"
                disabled={!canGenerate}
                startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : undefined}
              >
                {t('aiGeneration.dialog.generate')}
              </Button>
            )}
          </>
        )}
      </DialogActions>

      {/* Confirm-close dialog */}
      <Dialog
        open={confirmCloseOpen}
        onClose={() => setConfirmCloseOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', color: 'text.primary', borderRadius: '10px' } } }}
      >
        <DialogTitle>{t('aiGeneration.dialog.confirmClose.title')}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {t('aiGeneration.dialog.confirmClose.message')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmCloseOpen(false)}>{t('aiGeneration.dialog.confirmClose.stay')}</Button>
          <Button color="error" variant="contained" onClick={handleConfirmedClose}>
            {t('aiGeneration.dialog.confirmClose.leave')}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}
