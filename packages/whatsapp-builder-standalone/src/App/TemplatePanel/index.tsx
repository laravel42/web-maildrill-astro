import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import RedoOutlined from '@mui/icons-material/RedoOutlined';
import UndoOutlined from '@mui/icons-material/UndoOutlined';
import { Box, IconButton, Stack, Tab, Tabs, Tooltip } from '@mui/material';

import { buildComponents } from '../../documents/components';
import EditorBlockById from '../../documents/editor/EditorBlockById';
import {
  redoChange,
  setSelectedBlockId,
  setSelectedMainTab,
  undoChange,
  useCanRedo,
  useCanUndo,
  useDocument,
  useSelectedMainTab,
} from '../../documents/editor/EditorContext';
import PhoneFrame from './PhoneFrame';

/**
 * Canvas + top toolbar — mirrors the email builder's TemplatePanel:
 * main tabs on the left, contextual actions on the right, the canvas
 * below. The JSON tab shows the emitted Meta `components` payload
 * (what actually gets submitted for approval), not the internal doc.
 */
export default function TemplatePanel() {
  const { t } = useTranslation('waInspector');
  const mainTab = useSelectedMainTab();
  const document = useDocument();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();
  const [copied, setCopied] = useState(false);

  const componentsJson = useMemo(
    () => (mainTab === 'json' ? JSON.stringify(buildComponents(document), null, 2) : ''),
    [mainTab, document]
  );

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(componentsJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (permissions/insecure context) — ignore.
    }
  };

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      <Stack
        direction="row"
        sx={{
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          minHeight: 49,
        }}
      >
        <Tabs value={mainTab} onChange={(_, v) => setSelectedMainTab(v)} sx={{ minHeight: 48 }}>
          <Tab value="editor" label={t('tabs.editor')} sx={{ minHeight: 48, textTransform: 'none' }} />
          <Tab value="preview" label={t('tabs.preview')} sx={{ minHeight: 48, textTransform: 'none' }} />
          <Tab value="json" label={t('tabs.json')} sx={{ minHeight: 48, textTransform: 'none' }} />
        </Tabs>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          {mainTab === 'editor' && (
            <>
              <Tooltip title={t('toolbar.undo')}>
                <span>
                  <IconButton size="small" onClick={undoChange} disabled={!canUndo} aria-label={t('toolbar.undo')}>
                    <UndoOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('toolbar.redo')}>
                <span>
                  <IconButton size="small" onClick={redoChange} disabled={!canRedo} aria-label={t('toolbar.redo')}>
                    <RedoOutlined fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </>
          )}
          {mainTab === 'json' && (
            <Tooltip title={copied ? t('toolbar.copied') : t('toolbar.copyJson')}>
              <IconButton size="small" onClick={copyJson} aria-label={t('toolbar.copyJson')}>
                <ContentCopyOutlined fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>

      <Box
        onClick={() => setSelectedBlockId(null)}
        sx={{
          flex: 1,
          overflow: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          p: { xs: 2, md: 4 },
          bgcolor: 'background.canvas',
        }}
      >
        {mainTab === 'json' ? (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              width: '100%',
              maxWidth: 640,
              fontSize: 12.5,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
              overflow: 'auto',
            }}
          >
            {componentsJson}
          </Box>
        ) : (
          <PhoneFrame>
            <EditorBlockById id="root" />
          </PhoneFrame>
        )}
      </Box>
    </Box>
  );
}
