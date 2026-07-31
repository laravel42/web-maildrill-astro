import React from 'react';
import { useTranslation } from 'react-i18next';

import { type DraftBrief, MOOD_CHIPS, VERTICAL_CHIPS } from '../briefDefaults';
import PillMultiSelect from '../controls/PillMultiSelect';
import PillSelect from '../controls/PillSelect';
import WizardStep from '../controls/WizardStep';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

/** Step 3: vibe (moods) and industry vertical. */
export default function StepTone({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const ts = brief.tone_strategy;

  const moodOptions = MOOD_CHIPS.map((v) => ({ value: v, label: t(`steps.step02.mood.${v}`) }));
  const verticalOptions = VERTICAL_CHIPS.map((v) => ({ value: v, label: t(`steps.step02.vertical.${v}`) }));

  return (
    <WizardStep title={t('steps.step02.title')}>
      <PillMultiSelect
        label={t('steps.step02.moodQuestion')}
        values={ts.moods}
        options={moodOptions}
        max={4}
        onChange={(moods) => patch({ tone_strategy: { moods } })}
      />
      <PillSelect
        label={t('steps.step02.verticalQuestion')}
        value={ts.vertical}
        options={verticalOptions}
        onChange={(v) => patch({ tone_strategy: { vertical: v } })}
      />
    </WizardStep>
  );
}
