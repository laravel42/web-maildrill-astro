import React from 'react';

import { Box } from '@mui/material';

import { type DraftBrief, SECTION_CHIPS } from '../briefDefaults';
import ChipQuestion from '../ChipQuestion';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

const SECTION_OPTIONS = SECTION_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step05.section.${v}`,
}));

export default function Step05Layout({ brief, patch }: Props) {
  return (
    <Box>
      <ChipQuestion
        questionKey="steps.step05.sectionsQuestion"
        hintKey="steps.common.onlyAnswerThisPoint"
        options={SECTION_OPTIONS}
        selected={brief.layout_strategy.sections}
        multi
        onChange={(sections) => patch({ layout_strategy: { sections } })}
      />
    </Box>
  );
}
