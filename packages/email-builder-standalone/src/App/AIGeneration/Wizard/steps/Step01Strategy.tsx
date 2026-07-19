import React from 'react';
import { useTranslation } from 'react-i18next';

import { Stack } from '@mui/material';

import { type DraftBrief, PURPOSE_CHIPS } from '../briefDefaults';
import ChipQuestion from '../ChipQuestion';
import type { BriefPatch } from '../useVisualBrief';
import WizardField from '../WizardField';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

const PURPOSE_OPTIONS = PURPOSE_CHIPS.map((v) => ({
  value: v,
  labelKey: `steps.step01.purpose.${v}`,
}));

export default function Step01Strategy({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const es = brief.email_strategy;

  return (
    <Stack spacing={2}>
      <ChipQuestion
        questionKey="steps.step01.purposeQuestion"
        hintKey="steps.common.onlyAnswerThisPoint"
        options={PURPOSE_OPTIONS}
        selected={es.purpose ? [es.purpose] : []}
        onChange={([v]) => patch({ email_strategy: { purpose: v } })}
      />
      <WizardField
        label={t('steps.step01.brandNameLabel')}
        value={es.brandName}
        onChange={(e) => patch({ email_strategy: { brandName: e.target.value } })}
        placeholder={t('steps.step01.brandNamePlaceholder')}
      />
      <WizardField
        label={t('steps.step01.audienceLabel')}
        value={es.audience}
        onChange={(e) => patch({ email_strategy: { audience: e.target.value } })}
        placeholder={t('steps.step01.audiencePlaceholder')}
      />
      {es.purpose === 'custom' && (
        <WizardField
          label={t('steps.step01.goalCaption')}
          multiline
          minRows={2}
          value={es.goal}
          onChange={(e) => patch({ email_strategy: { goal: e.target.value } })}
          placeholder={t('steps.step01.goalPlaceholder')}
        />
      )}
    </Stack>
  );
}
