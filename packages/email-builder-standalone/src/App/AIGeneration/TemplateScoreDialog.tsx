import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

import type { TEditorConfiguration } from '../../documents/editor/core';
import { editorStateStore } from '../../documents/editor/EditorContext';

import QualityPanel from './QualityPanel';

interface Props {
  open: boolean;
  onClose: () => void;
  /** AI backend base — same same-origin BFF proxy the generation flow uses. */
  backendUrl?: string;
}

/**
 * Standalone "Template score" modal: the score analysis (deterministic audit
 * + optional LLM design critique) extracted from the generation flow, run
 * against the document currently loaded in the editor. Read-only — no
 * generation or corrections are triggered from here.
 */
export default function TemplateScoreDialog({ open, onClose, backendUrl = '/api/eb' }: Props) {
  const { t } = useTranslation('inspector');
  // Snapshot the document when the dialog opens so the score reflects the
  // canvas at that moment (and re-runs on every open), without subscribing
  // the dialog to every keystroke in the editor.
  const [document, setDocument] = useState<TEditorConfiguration | null>(null);

  useEffect(() => {
    if (open) setDocument(editorStateStore.getState().document);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: { sx: { bgcolor: 'background.paper', color: 'text.primary', borderRadius: '10px' } },
      }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: '24px' }}>
        {t('aiGeneration.score.title')}
      </DialogTitle>
      <DialogContent>
        {open && document && <QualityPanel document={document} backendUrl={backendUrl} />}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          {t('aiGeneration.dialog.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
