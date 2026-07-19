import React from 'react';

import { Stack } from '@mui/material';

import { type DraftBrief, MOOD_CHIPS, VERTICAL_CHIPS } from '../briefDefaults';
import ChipQuestion from '../ChipQuestion';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

const MOOD_OPTIONS = MOOD_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step02.mood.${v}`,
}));

const VERTICAL_OPTIONS = VERTICAL_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step02.vertical.${v}`,
}));

export default function Step02Tone({ brief, patch }: Props) {
  const ts = brief.tone_strategy;

  return (
    <Stack spacing={3}>
      <ChipQuestion
        questionKey="steps.step02.moodQuestion"
        hintKey="steps.common.onlyAnswerThisPoint"
        options={MOOD_OPTIONS}
        selected={ts.moods}
        multi
        onChange={(moods) => patch({ tone_strategy: { moods } })}
      />
      <ChipQuestion
        questionKey="steps.step02.verticalQuestion"
        options={VERTICAL_OPTIONS}
        selected={ts.vertical ? [ts.vertical] : []}
        onChange={([v]) => patch({ tone_strategy: { vertical: v } })}
      />
    </Stack>
  );
}
