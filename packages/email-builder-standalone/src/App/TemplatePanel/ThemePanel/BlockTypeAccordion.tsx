import React from 'react';
import { useTranslation } from 'react-i18next';

import { ExpandMoreOutlined } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

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
 */
export default function BlockTypeAccordion({
  blockType,
  spec,
  defaultExpanded = false,
  headless = false,
}: BlockTypeAccordionProps) {
  const { t } = useTranslation('inspector');
  const compact = useCompactMode();
  const Icon = spec.icon;

  // Box, not Stack — theme.ts's MuiStack styleOverrides forces
  // `margin: 0 !important` on every Stack's children workspace-wide (see
  // BaseSidebarPanel.tsx / RootAccordion.tsx for the same fix).
  const fields = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {spec.fields.map((field) => (
        <ThemeFieldRow key={`${field.section}.${field.key}`} blockType={blockType} field={field} />
      ))}
    </Box>
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
          '& .MuiAccordionSummary-content': {
            my: compact ? 0.5 : 1,
            justifyContent: compact ? 'center' : undefined,
          },
        }}
      >
        {compact ? (
          <Tooltip title={t(spec.titleKey)} placement="left">
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 0.5,
                borderRadius: 2,
                color: 'text.secondary',
              }}
            >
              <Icon fontSize="small" />
            </Box>
          </Tooltip>
        ) : (
          <Stack direction="row" spacing={1} sx={{ width: '100%', alignItems: 'center' }}>
            <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>
              {t(spec.titleKey)}
            </Typography>
          </Stack>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 3 }}>{fields}</AccordionDetails>
    </Accordion>
  );
}
