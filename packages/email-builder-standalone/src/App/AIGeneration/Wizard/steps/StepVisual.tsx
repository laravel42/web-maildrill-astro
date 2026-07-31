import React from 'react';
import { useTranslation } from 'react-i18next';

import { type DraftBrief, PALETTE_CHIPS, PHOTO_STYLE_CHIPS, SUBJECT_CHIPS } from '../briefDefaults';
import PillMultiSelect from '../controls/PillMultiSelect';
import PillSelect from '../controls/PillSelect';
import WizardStep from '../controls/WizardStep';
import type { BriefPatch } from '../useVisualBrief';
import WizardField from '../WizardField';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

/** Step 4: palette, photo style, and image subjects. */
export default function StepVisual({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const vs = brief.visual_strategy;
  const iq = brief.image_queries;

  const paletteOptions = PALETTE_CHIPS.map((v) => ({ value: v, label: t(`steps.step03.palette.${v}`) }));
  const photoOptions = PHOTO_STYLE_CHIPS.map((v) => ({ value: v, label: t(`steps.step03.photoStyle.${v}`) }));
  const subjectOptions = SUBJECT_CHIPS.map((v) => ({ value: v, label: t(`steps.step04.subject.${v}`) }));

  const noImages = vs.photoStyle === 'none';

  return (
    <WizardStep title={t('steps.step03.title')}>
      <PillSelect
        label={t('steps.step03.paletteQuestion')}
        value={vs.palette}
        options={paletteOptions}
        onChange={(v) => patch({ visual_strategy: { palette: v } })}
      />
      <PillSelect
        label={t('steps.step03.photoStyleQuestion')}
        value={vs.photoStyle}
        options={photoOptions}
        onChange={(v) => patch({ visual_strategy: { photoStyle: v } })}
      />
      {!noImages && (
        <>
          <PillMultiSelect
            label={t('steps.step04.subjectQuestion')}
            values={iq.subjects}
            options={subjectOptions}
            max={4}
            onChange={(subjects) => patch({ image_queries: { subjects } })}
          />
          <WizardField
            label={t('steps.step03.sceneLabel')}
            value={iq.specificScene}
            onChange={(e) => patch({ image_queries: { specificScene: e.target.value } })}
            placeholder={t('steps.step04.scenePlaceholder')}
          />
        </>
      )}
    </WizardStep>
  );
}
