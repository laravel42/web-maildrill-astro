/**
 * CategoryAccordion — the outer accordion shell for one Components
 * Library category (Sections / Primitives / Layouts / Templates /
 * Themes). Header + count match builder42 `pbx-style-group` (`.eb-style-group`
 * in the host). Expanded state is controlled by the parent drawer.
 */

import React from 'react';

import ExpandMoreOutlined from '@mui/icons-material/ExpandMore';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';

function groupClass(expanded: boolean) {
  return `eb-style-group${expanded ? ' eb-style-group--open' : ''}`;
}

function groupLabel(title: string, countLabel: string) {
  // Roles arrive as "banner" / "BANNER"; match builder42 "Essentials (4)".
  return `${title.toLowerCase()} (${countLabel})`;
}

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
      className={groupClass(expanded)}
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(isExpanded)}
      disableGutters
      square
      elevation={0}
    >
      <AccordionSummary
        className="eb-style-group__trigger"
        expandIcon={<ExpandMoreOutlined className="eb-style-group__chevron" />}
        disableRipple
      >
        <span className="eb-style-group__name">{groupLabel(title, badge)}</span>
      </AccordionSummary>
      <AccordionDetails className="eb-style-group__body">{children}</AccordionDetails>
    </Accordion>
  );
}

/**
 * SubcategoryAccordion — axis subdivisions (section roles / primitive
 * types / layout shapes). Same chrome as the outer category group.
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
      className={groupClass(expanded)}
      expanded={expanded}
      onChange={(_, isExpanded) => onToggle(isExpanded)}
      disableGutters
      square
      elevation={0}
    >
      <AccordionSummary
        className="eb-style-group__trigger"
        expandIcon={<ExpandMoreOutlined className="eb-style-group__chevron" />}
        disableRipple
      >
        <span className="eb-style-group__name">{groupLabel(title, String(count))}</span>
      </AccordionSummary>
      <AccordionDetails className="eb-style-group__body">{children}</AccordionDetails>
    </Accordion>
  );
}
