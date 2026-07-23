import React from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Stack, Typography } from '@mui/material';

interface Props {
  /** Zero-based index of the current step. */
  stepIndex: number;
  /** Total number of field steps (excluding the summary). */
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  /** When true, the primary button reads "Review" instead of "Next". */
  isLastStep?: boolean;
}

/**
 * Bottom navigation for the wizard: textual progress ("Step 1 of 2") + Back /
 * Next(Review). Replaces `MobileStepper` (dots + Skip) — with only high-signal
 * steps left there is nothing worth skipping.
 */
export default function WizardNav({
  stepIndex,
  totalSteps,
  onBack,
  onNext,
  backDisabled,
  nextDisabled,
  isLastStep,
}: Props) {
  const { t } = useTranslation('aiWizard');
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', pt: 0 }}>
      <Button onClick={onBack} disabled={backDisabled} color="inherit" size="small">
        {t('steps.common.back')}
      </Button>
      <Typography variant="caption" color="text.secondary">
        {t('steps.common.stepOf', { current: stepIndex + 1, total: totalSteps })}
      </Typography>
      <Button onClick={onNext} disabled={nextDisabled} variant="contained" size="small">
        {isLastStep ? t('steps.common.review') : t('steps.common.next')}
      </Button>
    </Stack>
  );
}
