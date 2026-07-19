import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CheckCircle, WarningAmber } from '@mui/icons-material';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, TextField, Typography } from '@mui/material';

import { FONT_FAMILIES } from '../../../documents/blocks/helpers/fontFamily';
import { applyThemePreset, setAppliedThemeId } from '../../../documents/editor/EditorContext';
import { saveTheme } from '../../ComponentsLibrary/fetchTheme';

import type { DraftBrief } from './briefDefaults';
import { type GeneratedThemeResult, generateThemeClient, toThemeBundlePayload } from './compileThemeClient';

interface Props {
  brief: DraftBrief;
  backendUrl: string;
  locale?: string;
  /** Whether the Components Library (save-to-gallery) is available. */
  libraryEnabled: boolean;
  onBack: () => void;
  /** Called after the theme is applied so the dialog can close. */
  onApplied?: () => void;
}

/** Resolve a font-family CSS value from the editor's font key. */
function fontCss(key: string | undefined): string {
  return FONT_FAMILIES.find((f) => f.key === key)?.value ?? 'inherit';
}

/** Map the generated button shape to a CSS border-radius for the preview. */
function shapeRadius(shape: unknown, fallback: number): number {
  if (typeof shape === 'string') {
    if (shape === 'pill') return 999;
    if (shape === 'rectangle') return 0;
    if (shape === 'rounded') return 8;
  }
  if (shape && typeof shape === 'object' && 'topLeft' in shape) {
    return (shape as { topLeft: number }).topLeft;
  }
  return fallback;
}

/**
 * ThemeSummaryStep — the final step of the wizard's "Theme" target.
 *
 * Calls `POST /api/generate-theme`, renders a live mini-preview of the
 * generated palette (heading + body + divider + button), surfaces an
 * accessibility badge, and offers two actions:
 *
 *   - Apply        → `applyThemePreset()` writes the theme to the live
 *                    document as a single undo step.
 *   - Save to library → `saveTheme()` persists the bundle to the gallery.
 */
export default function ThemeSummaryStep({ brief, backendUrl, locale, libraryEnabled, onBack, onApplied }: Props) {
  const { t } = useTranslation('aiWizard');
  const [theme, setTheme] = useState<GeneratedThemeResult | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateThemeClient(brief, backendUrl, locale);
      setTheme(result);
      setName(result.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [brief, backendUrl, locale]);

  useEffect(() => {
    void generate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleApply = useCallback(() => {
    if (!theme) return;
    applyThemePreset(toThemeBundlePayload(theme));
    // The applied theme isn't a saved library entry yet, so clear any
    // previous selection mark rather than pointing at a stale id.
    setAppliedThemeId(savedId);
    onApplied?.();
  }, [theme, savedId, onApplied]);

  const handleSave = useCallback(async () => {
    if (!theme || saving) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveTheme({
        name: (name.trim() || theme.name).slice(0, 100),
        description: brief.email_strategy.brandName?.trim() || undefined,
        bundle: toThemeBundlePayload(theme),
      });
      setSavedId(result.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [theme, saving, name, brief.email_strategy.brandName]);

  const previewStyles = useMemo(() => {
    if (!theme) return null;
    const g = theme.globals;
    const btn = theme.blocks?.Button?.style as Record<string, unknown> | undefined;
    const divider = theme.blocks?.Divider?.style as Record<string, unknown> | undefined;
    const container = theme.blocks?.Container?.style as Record<string, unknown> | undefined;
    const columns = theme.blocks?.ColumnsContainer?.style as Record<string, unknown> | undefined;
    const image = theme.blocks?.Image?.style as Record<string, unknown> | undefined;
    return {
      backdrop: g.backdropColor ?? '#f1f5f9',
      canvas: g.canvasColor ?? '#ffffff',
      text: g.textColor ?? '#0f172a',
      link: g.linkGlobal?.linkColor ?? '#2563eb',
      font: fontCss(g.fontFamily ?? undefined),
      headingFont: fontCss(
        ((g as Record<string, unknown>).fontHeadings as string | undefined) ?? g.fontFamily ?? undefined
      ),
      radius: g.borderRadius ?? 8,
      buttonBg: (btn?.buttonBackgroundColor as string) ?? '#2563eb',
      buttonText: (btn?.buttonTextColor as string) ?? '#ffffff',
      buttonRadius: shapeRadius(btn?.shape, g.borderRadius ?? 8),
      buttonFontSize: (btn?.fontSize as number) ?? 14,
      dividerColor: (divider?.color as string) ?? '#e2e8f0',
      containerBorder: container?.borderTop
        ? `${container.borderTop}px solid ${(container.borderColor as string) ?? '#e2e8f0'}`
        : undefined,
      containerRadius: (container?.borderRadius as number) ?? g.borderRadius ?? 0,
      containerPadding: container?.padding as
        { top?: number; bottom?: number; left?: number; right?: number } | undefined,
      columnsPadding: columns?.padding as { top?: number; bottom?: number; left?: number; right?: number } | undefined,
      imageRadius: (image?.borderRadius as number) ?? 0,
    };
  }, [theme]);

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('themeSummary.title')}
      </Typography>

      {loading && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <CircularProgress size={16} />
          <Typography variant="caption">{t('themeSummary.generating')}</Typography>
        </Stack>
      )}

      {error && (
        <Alert
          severity="warning"
          action={
            <Button size="small" onClick={generate}>
              {t('themeSummary.retry')}
            </Button>
          }
        >
          {t('themeSummary.error')}
        </Alert>
      )}

      {theme && previewStyles && !loading && (
        <>
          {/* Live preview card — simulates a full email layout */}
          <Box
            sx={{
              bgcolor: previewStyles.backdrop,
              p: 2,
              borderRadius: 1.5,
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Box
              sx={{
                bgcolor: previewStyles.canvas,
                color: previewStyles.text,
                fontFamily: previewStyles.font,
                borderRadius: `${previewStyles.radius}px`,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Hero image placeholder */}
              <Box
                sx={{
                  height: 80,
                  bgcolor: previewStyles.buttonBg,
                  opacity: 0.15,
                  borderRadius: previewStyles.imageRadius ? `${previewStyles.imageRadius}px` : undefined,
                  m: previewStyles.containerPadding
                    ? `${previewStyles.containerPadding.top ?? 16}px ${previewStyles.containerPadding.left ?? 24}px 0`
                    : '16px 24px 0',
                }}
              />

              {/* Heading + body */}
              <Box sx={{ p: '16px 24px' }}>
                <Box
                  sx={{
                    fontSize: 18,
                    fontWeight: 700,
                    fontFamily: previewStyles.headingFont,
                    lineHeight: 1.3,
                    mb: 0.5,
                  }}
                >
                  {brief.email_strategy.brandName?.trim() || t('themeSummary.sampleHeading')}
                </Box>
                <Box sx={{ fontSize: 12, lineHeight: 1.5, color: previewStyles.text, opacity: 0.8 }}>
                  {t('themeSummary.sampleBody')}{' '}
                  <Box component="span" sx={{ color: previewStyles.link, textDecoration: 'underline' }}>
                    {t('themeSummary.sampleLink')}
                  </Box>
                </Box>
              </Box>

              {/* Two-column section */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  mx: '24px',
                  p: previewStyles.columnsPadding
                    ? `${previewStyles.columnsPadding.top ?? 12}px ${previewStyles.columnsPadding.left ?? 12}px`
                    : '12px',
                }}
              >
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: previewStyles.backdrop,
                    borderRadius: `${previewStyles.containerRadius}px`,
                    border: previewStyles.containerBorder,
                    p: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: '60%',
                      height: 6,
                      bgcolor: previewStyles.text,
                      opacity: 0.2,
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  />
                  <Box sx={{ width: '90%', height: 4, bgcolor: previewStyles.text, opacity: 0.1, borderRadius: 1 }} />
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: previewStyles.backdrop,
                    borderRadius: `${previewStyles.containerRadius}px`,
                    border: previewStyles.containerBorder,
                    p: 1.5,
                  }}
                >
                  <Box
                    sx={{
                      width: '70%',
                      height: 6,
                      bgcolor: previewStyles.text,
                      opacity: 0.2,
                      borderRadius: 1,
                      mb: 0.5,
                    }}
                  />
                  <Box sx={{ width: '80%', height: 4, bgcolor: previewStyles.text, opacity: 0.1, borderRadius: 1 }} />
                </Box>
              </Box>

              {/* Divider */}
              <Box sx={{ height: '1px', bgcolor: previewStyles.dividerColor, mx: '24px', my: 1.5 }} />

              {/* CTA button */}
              <Box sx={{ textAlign: 'center', pb: 2.5 }}>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    bgcolor: previewStyles.buttonBg,
                    color: previewStyles.buttonText,
                    fontFamily: previewStyles.font,
                    fontWeight: 700,
                    fontSize: previewStyles.buttonFontSize,
                    px: 3,
                    py: 1,
                    borderRadius: `${previewStyles.buttonRadius}px`,
                  }}
                >
                  {t('themeSummary.sampleButton')}
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Accessibility badge */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              size="small"
              icon={theme.accessibility.passesAA ? <CheckCircle /> : <WarningAmber />}
              color={theme.accessibility.passesAA ? 'success' : 'warning'}
              variant="outlined"
              label={
                theme.accessibility.passesAA
                  ? t('themeSummary.a11yPass', { ratio: theme.accessibility.minContrastRatio })
                  : t('themeSummary.a11yWarn', { ratio: theme.accessibility.minContrastRatio })
              }
            />
          </Stack>

          {/* Theme name (editable, used for Save) */}
          <TextField
            label={t('themeSummary.nameLabel')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            fullWidth
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />

          {savedId && (
            <Alert severity="success" sx={{ py: 0 }}>
              {t('themeSummary.saved')}
            </Alert>
          )}
        </>
      )}

      <Divider />

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Button onClick={onBack} disabled={saving}>
          {t('steps.common.back')}
        </Button>
        <Stack direction="row" spacing={1}>
          {libraryEnabled && (
            <Button
              variant="outlined"
              onClick={handleSave}
              disabled={!theme || loading || saving || savedId !== null}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : undefined}
            >
              {savedId ? t('themeSummary.savedButton') : t('themeSummary.saveButton')}
            </Button>
          )}
          <Button variant="contained" onClick={handleApply} disabled={!theme || loading}>
            {t('themeSummary.applyButton')}
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
