import React from 'react';
import { useTranslation } from 'react-i18next';

import { type DraftBrief, SECTION_CHIPS } from '../briefDefaults';
import PillMultiSelect from '../controls/PillMultiSelect';
import WizardStep from '../controls/WizardStep';
import type { BriefPatch } from '../useVisualBrief';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

/** Step 5: which sections the email should contain. */
export default function StepSections({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const sectionOptions = SECTION_CHIPS.map((v) => ({ value: v, label: t(`steps.step05.section.${v}`) }));

  return (
    <WizardStep title={t('steps.step05.title')}>
      <PillMultiSelect
        label={t('steps.step05.sectionsQuestion')}
        values={brief.layout_strategy.sections}
        options={sectionOptions}
        max={7}
        onChange={(sections) => patch({ layout_strategy: { sections } })}
      />
    </WizardStep>
  );
}
