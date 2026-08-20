import React from 'react';
import { useTranslation } from 'react-i18next';

import { type DraftBrief, PURPOSE_CHIPS } from '../briefDefaults';
import PillSelect from '../controls/PillSelect';
import WizardStep from '../controls/WizardStep';
import type { BriefPatch } from '../useVisualBrief';
import WizardField from '../WizardField';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

/** Step 1: the brand and what kind of email to create. */
export default function StepBrand({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const es = brief.email_strategy;

  const purposeOptions = PURPOSE_CHIPS.map((v) => ({
    value: v,
    label: t(`steps.step01.purpose.${v}`),
  }));

  return (
    <WizardStep title={t('steps.stepBrand.title')}>
      <WizardField
        label={t('steps.step01.brandNameLabel')}
        value={es.brandName}
        onChange={(e) => patch({ email_strategy: { brandName: e.target.value } })}
        placeholder={t('steps.step01.brandNamePlaceholder')}
      />
      <PillSelect
        label={t('steps.step01.purposeQuestion')}
        value={es.purpose}
        options={purposeOptions}
        onChange={(v) => patch({ email_strategy: { purpose: v } })}
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
    </WizardStep>
  );
}
