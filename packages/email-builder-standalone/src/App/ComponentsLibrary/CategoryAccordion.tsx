/**
 * CategoryAccordion — the outer accordion shell for one Components
 * Library category (Sections / Primitives / Layouts / Templates /
 * Themes). Renders a header with the category title and a count badge,
 * plus a collapsible body. Expanded state is controlled by the parent
 * drawer so multiple categories can stay open independently.
 */

import React from 'react';

import ExpandMoreOutlined from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary, Chip, Stack, Typography } from '@mui/material';

export default function CategoryAccordion({
  title,
  count,
  total,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  /** Items matching the current filters. */
  count: number;
  /** Total items in the category (before filters). */
  total: number;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  // Show "3/12" when a filter narrows the set, otherwise just the total.
  const badge = count === total ? `${total}` : `${count}/${total}`;

  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(isExpanded)}
      disableGutters
      square
      sx={{
        boxShadow: 'none',
        borderTop: (theme) => `1px solid ${theme.palette.divider}`,
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined />}
        sx={{ px: 0, minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.75, alignItems: 'center' } }}
      >
        <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
          <Typography variant="subtitle2">{title}</Typography>
          <Chip size="small" label={badge} sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }} />
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 1.5 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

/**
 * SubcategoryAccordion — lighter, indented accordion used for the axis
 * subdivisions (section roles / primitive types / layout shapes) nested
 * inside a `CategoryAccordion`. Uses an `overline` header so it reads as
 * a second-level group.
 */
export function SubcategoryAccordion({
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: (expanded: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(isExpanded)}
      disableGutters
      square
      sx={{
        boxShadow: 'none',
        backgroundColor: 'transparent',
        '&:before': { display: 'none' },
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreOutlined sx={{ fontSize: 18 }} />}
        sx={{ px: 0, minHeight: 32, '& .MuiAccordionSummary-content': { my: 0.25, alignItems: 'center', gap: 0.5 } }}
      >
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          ({count})
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0, pb: 1 }}>{children}</AccordionDetails>
    </Accordion>
  );
}
