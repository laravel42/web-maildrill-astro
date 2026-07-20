import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BookmarkAddOutlined, FileDownloadOutlined } from '@mui/icons-material';
import { Box, Button, Container, Link, Stack, Tooltip, Typography } from '@mui/material';

import packageJson from '../../../../package.json';
import {
  useComponentsLibraryEnabled,
  useShowVersion,
  useTemplateSaving,
  useThemeSaving,
} from '../../../documents/editor/EditorContext';
import SaveTemplateDialog from '../../ComponentsLibrary/SaveTemplateDialog';
import { useCompactMode } from '../../InspectorDrawer/CompactModeContext';

import BlockTypeAccordion from './BlockTypeAccordion';
import { THEME_BLOCK_ORDER, THEME_BLOCK_REGISTRY } from './registry';
import RootAccordion from './RootAccordion';
import SaveThemeDialog from './SaveThemeDialog';

/**
 * Inspector "root" view.
 *
 * Renders a single uniform accordion list:
 *   1. Root accordion (global EmailLayout fields), expanded by default.
 *   2. Per-block-type theme accordions, collapsed by default.
 * Followed by an optional version + npm link footer (gated by
 * `useShowVersion()`).
 *
 * When dev mode is on, the panel header surfaces two extra actions:
 *   - "Save as theme"     → opens `SaveThemeDialog` (POST /dev/save-theme)
 *   - "Save as template"  → opens `SaveTemplateDialog` (POST /dev/save-template)
 *
 * The previous "Apply theme" button was removed in L42-309 — themes
 * now apply by clicking a card in the Components Library Themes tab,
 * which already opens `ApplyThemeConfirmDialog` directly.
 */
export default function ThemePanel() {
  const { t } = useTranslation('inspector');
  const showVersion = useShowVersion();
  const libraryEnabled = useComponentsLibraryEnabled();
  const templateSaving = useTemplateSaving();
  const themeSaving = useThemeSaving();
  const compact = useCompactMode();
  const [saveThemeOpen, setSaveThemeOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);

  return (
    <Container
      sx={{
        padding: '0!important',
        // Controls start just under the tab strip.
        paddingTop: '6px!important',
        display: 'flex',
        flexDirection: 'column',
        flex: '1 0 auto',
        minHeight: '100%',
      }}
    >
      {/* Only when it has something to show — an empty row still contributed
          its bottom margin, holding the controls away from the tab strip. */}
      {!compact && libraryEnabled && (themeSaving || templateSaving) && (
        <Stack
          direction="row"
          sx={{ mb: 2, flexWrap: 'wrap', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}
        >
          {libraryEnabled && (
            <Stack direction="row" spacing={0.5} sx={{ width: '100%', ml: '0!important' }}>
              {themeSaving && (
                <Tooltip title={t('theme.exportTooltip', 'Save current theme to the gallery')}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<BookmarkAddOutlined fontSize="small" />}
                    onClick={() => setSaveThemeOpen(true)}
                  >
                    {t('theme.exportButton', 'Theme')}
                  </Button>
                </Tooltip>
              )}
              {templateSaving && (
                <Tooltip
                  title={t(
                    'componentsLibrary.saveTemplate.tooltip',
                    'Save the current document as a reusable template'
                  )}
                >
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileDownloadOutlined fontSize="small" />}
                    onClick={() => setSaveTemplateOpen(true)}
                  >
                    {t('componentsLibrary.saveTemplate.button', 'Template')}
                  </Button>
                </Tooltip>
              )}
            </Stack>
          )}
        </Stack>
      )}

      <Box>
        <RootAccordion defaultExpanded />
        {THEME_BLOCK_ORDER.map((blockType) => (
          <BlockTypeAccordion
            key={blockType}
            blockType={blockType}
            spec={THEME_BLOCK_REGISTRY[blockType]}
            defaultExpanded={false}
          />
        ))}
      </Box>

      {showVersion && (
        <Box color="text.secondary" sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto', pt: 3, pb: 3 }}>
          {compact ? (
            <Link
              href={`https://www.npmjs.com/package/${packageJson.name}`}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ fontSize: '0.75rem' }}
            >
              v{packageJson.version}
            </Link>
          ) : (
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2">
                {t('inputs.panels.emailLayout.version')}: {packageJson.version}
              </Typography>
              <Link
                href={`https://www.npmjs.com/package/${packageJson.name}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ fontSize: '0.875rem', mt: 0.5, display: 'inline-block' }}
              >
                {packageJson.name}
              </Link>
            </Box>
          )}
        </Box>
      )}

      <SaveThemeDialog open={saveThemeOpen} onClose={() => setSaveThemeOpen(false)} />
      <SaveTemplateDialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} />
    </Container>
  );
}
