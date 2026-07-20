import React from 'react';
import { useTranslation } from 'react-i18next';

import { ExpandMoreOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Stack, Tooltip, Typography } from '@mui/material';

import { useThemeBlockOverride } from '../../../documents/editor/EditorContext';
import { useCompactMode } from '../../InspectorDrawer/CompactModeContext';

import type { ThemeBlockSpec, ThemeBlockType } from './registry';
import ThemeFieldRow from './ThemeFieldRow';

type BlockTypeAccordionProps = {
  blockType: ThemeBlockType;
  spec: ThemeBlockSpec;
  /**
   * When true, the accordion starts expanded. The panel uses this for
   * the first block type so the user lands on a populated section
   * instead of having to expand it manually.
   */
  defaultExpanded?: boolean;
  /** Render only the fields — the pill selector supplies the heading. */
  headless?: boolean;
};

/**
 * Phase 2c — Inspector Theme panel.
 *
 * Accordion grouping all theme overrides for a single block type.
 * Renders a small badge in the summary when the user has at least one
 * active override, so the per-block status is visible without
 * expanding everything.
 */
export default function BlockTypeAccordion({
  blockType,
  spec,
  defaultExpanded = false,
  headless = false,
}: BlockTypeAccordionProps) {
  const { t } = useTranslation('inspector');
  const override = useThemeBlockOverride(blockType);
  const compact = useCompactMode();
  const isModified = countOverrides(override) > 0;
  const Icon = spec.icon;

  const fields = (
    <Stack spacing={2}>
      {spec.fields.map((field) => (
        <ThemeFieldRow key={`${field.section}.${field.key}`} blockType={blockType} field={field} />
      ))}
    </Stack>
  );

  if (headless) {
    return <Box sx={{ pt: 1, pb: 3 }}>{fields}</Box>;
  }

  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      square
      sx={{
        boxShadow: 'none',
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={compact ? undefined : <ExpandMoreOutlined />}
        sx={{
          px: 0,
          minHeight: compact ? 40 : 48,
          justifyContent: compact ? 'center' : undefined,
          '& .MuiAccordionSummary-content': { my: compact ? 0.5 : 1, justifyContent: compact ? 'center' : undefined },
        }}
      >
        {compact ? (
          <Tooltip title={t(spec.titleKey)} placement="left">
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderRadius: 2,
                color: 'text.secondary',
              }}
            >
              <Icon fontSize="small" />
              {isModified && (
                <Box
                  component="span"
                  aria-label={t('theme.modified', 'Modified')}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                  }}
                />
              )}
            </Box>
          </Tooltip>
        ) : (
          <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t(spec.titleKey)}</Typography>
              {isModified && (
                <Box
                  component="span"
                  aria-label={t('theme.modified', 'Modified')}
                  sx={{
                    position: 'absolute',
                    top: -1,
                    right: -8,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    bgcolor: 'primary.main',
                  }}
                />
              )}
            </Box>
          </Stack>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 3 }}>{fields}</AccordionDetails>
    </Accordion>
  );
}

function countOverrides(
  override: { style?: Record<string, unknown>; props?: Record<string, unknown> } | undefined
): number {
  if (!override) return 0;
  const styleKeys = override.style ? Object.keys(override.style).length : 0;
  const propsKeys = override.props ? Object.keys(override.props).length : 0;
  return styleKeys + propsKeys;
}
