import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box } from '@mui/material';

import type { DraftBrief } from '../briefDefaults';
import ColorSwatchField from '../controls/ColorSwatchField';
import FieldShell from '../controls/FieldShell';
import WizardStep from '../controls/WizardStep';
import type { BriefPatch } from '../useVisualBrief';
import WizardField from '../WizardField';

interface Props {
  brief: DraftBrief;
  patch: (p: BriefPatch) => void;
}

/** Step 2: who the email is for + brand colours (full-width swatches). */
export default function StepAudience({ brief, patch }: Props) {
  const { t } = useTranslation('aiWizard');
  const es = brief.email_strategy;
  const colors = brief.visual_strategy.brandColors ?? { primary: '', secondary: '', accent: '' };

  function patchColor(key: 'primary' | 'secondary' | 'accent', hex: string) {
    patch({ visual_strategy: { brandColors: { ...colors, [key]: hex } } });
  }

  return (
    <WizardStep title={t('steps.stepAudience.title')}>
      <WizardField
        label={t('steps.step01.audienceLabel')}
        value={es.audience}
        onChange={(e) => patch({ email_strategy: { audience: e.target.value } })}
        placeholder={t('steps.step01.audiencePlaceholder')}
      />
      <FieldShell label={t('steps.step03.brandColorsTitle')} hint={t('steps.step03.brandColorsHint')}>
        <Box sx={{ display: 'flex', gap: 2, width: '100%' }}>
          <Box sx={{ flex: 1 }}>
            <ColorSwatchField
              label={t('steps.step03.colorPrimary')}
              value={colors.primary || ''}
              onChange={(hex) => patchColor('primary', hex)}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <ColorSwatchField
              label={t('steps.step03.colorSecondary')}
              value={colors.secondary || ''}
              onChange={(hex) => patchColor('secondary', hex)}
            />
          </Box>
          <Box sx={{ flex: 1 }}>
            <ColorSwatchField
              label={t('steps.step03.colorAccent')}
              value={colors.accent || ''}
              onChange={(hex) => patchColor('accent', hex)}
            />
          </Box>
        </Box>
      </FieldShell>
    </WizardStep>
  );
}
