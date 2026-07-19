import React from 'react';

import { Stack } from '@mui/material';

import { type DraftBrief, SUBJECT_CHIPS } from '../briefDefaults';
import ChipQuestion from '../ChipQuestion';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

const SUBJECT_OPTIONS = SUBJECT_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step04.subject.${v}`,
}));

export default function Step04Imagery({ brief, patch }: Props) {
  const iq = brief.image_queries;

  return (
    <Stack spacing={2}>
      <ChipQuestion
        questionKey="steps.step04.subjectQuestion"
        hintKey="steps.common.onlyAnswerThisPoint"
        options={SUBJECT_OPTIONS}
        selected={iq.subjects}
        multi
        onChange={(subjects) => patch({ image_queries: { subjects } })}
        textValue={iq.specificScene}
        onTextChange={(specificScene) => patch({ image_queries: { specificScene } })}
        textPlaceholderKey="steps.step04.scenePlaceholder"
      />
    </Stack>
  );
}
