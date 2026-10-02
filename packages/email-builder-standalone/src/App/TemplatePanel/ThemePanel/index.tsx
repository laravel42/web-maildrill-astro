import React, { useMemo, useState } from 'react';
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
  // Which theme section the pill selector is showing.
  const [section, setSection] = useState<'root' | (typeof THEME_BLOCK_ORDER)[number]>('root');
  const THEME_SECTIONS = useMemo(
    () => [
      { id: 'root' as const, label: t('theme.blocks.root.title') },
      ...THEME_BLOCK_ORDER.map((b) => ({ id: b, label: t(THEME_BLOCK_REGISTRY[b].titleKey) })),
    ],
    [t],
  );
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
          sx={{
            mb: 2,
            flexWrap: 'wrap',
            gap: 1,
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
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
                    'Save the current document as a reusable template',
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

      {/* Pill selector rather than stacked accordions: one section is visible
          at a time, so the controls you want are never buried under six
          collapsed headers, and the panel stops scrolling for its own chrome.
          Compact mode keeps the accordion list, which suits a 56px rail. */}
      {compact ? (
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
      ) : (
        <Box>
          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 0.75,
              pb: 1.5,
              borderBottom: (th) => `1px solid ${th.palette.divider}`,
            }}
          >
            {THEME_SECTIONS.map(({ id, label }) => {
              const active = section === id;
              return (
                <Box
                  key={id}
                  component="button"
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSection(id)}
                  sx={{
                    // Homologado con Builder42 (`.pbx-breadcrumb__btn` /
                    // `.pbx-badge--override`, packages/builder42/src/styles/
                    // chrome/{inspector.css,inspector-controls.css}): el
                    // estado activo ahí nunca es un pill sólido con texto
                    // blanco — es un fondo tenue con texto del MISMO tono
                    // pero intenso, y un radio sobrio (--pb-chrome-radius-xs,
                    // 8px) en vez de un pill de 999px.
                    border: (th) =>
                      `1px solid ${active ? 'transparent' : th.palette.grey[300]}`,
                    borderRadius: '8px',
                    px: 1.25,
                    py: 0.5,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '12px',
                    fontWeight: 600,
                    lineHeight: 1.6,
                    color: active ? '#4f46e5' : 'text.secondary',
                    backgroundColor: active ? '#eef0ff' : 'transparent',
                    transition: 'background-color .15s, color .15s, border-color .15s',
                    '&:hover': {
                      backgroundColor: active ? '#eef0ff' : (th) => th.palette.action.hover,
                      borderColor: (th) => (active ? 'transparent' : th.palette.grey[400]),
                    },
                  }}
                >
                  {label}
                </Box>
              );
            })}
          </Stack>

          {section === 'root' ? (
            <RootAccordion headless />
          ) : (
            <BlockTypeAccordion blockType={section} spec={THEME_BLOCK_REGISTRY[section]} headless />
          )}
        </Box>
      )}

      {showVersion && (
        <Box
          color="text.secondary"
          sx={{ display: 'flex', justifyContent: 'flex-end', mt: 'auto', pt: 3, pb: 3 }}
        >
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
