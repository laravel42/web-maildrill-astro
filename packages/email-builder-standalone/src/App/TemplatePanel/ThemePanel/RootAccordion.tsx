import React from 'react';
import { useTranslation } from 'react-i18next';

import { ExpandMoreOutlined, TuneOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary, Box, Stack, Tooltip, Typography } from '@mui/material';

import { useBlock } from '../../../documents/editor/blockHooks';
import { atomicUpdateBlock } from '../../../documents/editor/blockUpdaters';
import { clearAppliedTheme } from '../../../documents/editor/EditorContext';
import { useCompactMode } from '../../InspectorDrawer/CompactModeContext';
import EmailLayoutSidebarFields from '../../InspectorDrawer/ConfigurationPanel/input-panels/EmailLayoutSidebarPanel';

type RootAccordionProps = {
  /** When true the accordion starts expanded. */
  defaultExpanded?: boolean;
  /** Render only the fields — the pill selector supplies the heading. */
  headless?: boolean;
};

/**
 * Root section of the unified theme inspector panel.
 *
 * Mirrors the visual chrome of `BlockTypeAccordion` (border-top divider,
 * compact summary) but does not show an override badge — the Root
 * accordion edits real document props on the `root` `EmailLayout` block,
 * not theme overrides.
 */
export default function RootAccordion({ defaultExpanded = true, headless = false }: RootAccordionProps) {
  const { t } = useTranslation('inspector');
  const block = useBlock('root');
  const compact = useCompactMode();

  if (!block || block.type !== 'EmailLayout') {
    return null;
  }

  const { data } = block;

  const fields = (
    <Stack spacing={2}>
      <EmailLayoutSidebarFields
        data={data}
        setData={(next) => {
          // Editing a global field diverges the document from any applied
          // preset / library theme — drop the mark.
          clearAppliedTheme();
          atomicUpdateBlock('root', () => ({ type: 'EmailLayout', data: next }));
        }}
      />
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
          <Tooltip title={t('theme.blocks.root.title')} placement="left">
            <Box sx={{ display: 'flex', p: 0.5, borderRadius: 2, color: 'text.secondary' }}>
              <TuneOutlined fontSize="small" />
            </Box>
          </Tooltip>
        ) : (
          <Typography sx={{ fontWeight: 600, color: 'text.primary' }}>{t('theme.blocks.root.title')}</Typography>
        )}
      </AccordionSummary>
      <AccordionDetails sx={{ px: 0, pt: 0, pb: 3 }}>
        {fields}
      </AccordionDetails>
    </Accordion>
  );
}
