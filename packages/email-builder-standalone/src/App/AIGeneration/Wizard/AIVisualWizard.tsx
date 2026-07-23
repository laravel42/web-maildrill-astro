import React from 'react';

import { Box } from '@mui/material';

import type { DraftBrief } from './briefDefaults';
import WizardNav from './controls/WizardNav';
import StepAudience from './steps/StepAudience';
import StepBrand from './steps/StepBrand';
import SummaryStep from './SummaryStep';
import { useVisualBrief } from './useVisualBrief';

interface Props {
  initialRawIntent?: string;
  backendUrl: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  locale?: string;
  onGenerate: (prompt: string, brief: DraftBrief) => void;
  generating: boolean;
}

type StepId = 'brand' | 'audience';

/**
 * Guided template wizard. Only "Full Template" generation exists, so there is
 * no target picker and no theme/component flows: the wizard goes straight to
 * two high-signal steps (brand + type, then audience + brand colours) and then
 * the summary. Tone, vertical, palette, imagery and structure are derived by
 * the model.
 */
const STEP_SEQUENCE: StepId[] = ['brand', 'audience'];

export default function AIVisualWizard({
  initialRawIntent = '',
  backendUrl,
  brandColors,
  onGenerate,
  generating,
}: Props) {
  const { brief, patch } = useVisualBrief(initialRawIntent);
  const [step, setStep] = React.useState(0);

  // Initialise brand colors from props once on mount
  React.useEffect(() => {
    if (brandColors?.primary || brandColors?.secondary) {
      patch({ visual_strategy: { brandColors } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const totalSteps = STEP_SEQUENCE.length;
  const isSummary = step === totalSteps;
  const activeStep = STEP_SEQUENCE[step] ?? STEP_SEQUENCE[totalSteps - 1];

  function handleNext() {
    setStep((s) => s + 1);
  }
  function handleBack() {
    setStep((s) => Math.max(0, s - 1));
  }

  if (isSummary) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
        <SummaryStep
          brief={brief}
          backendUrl={backendUrl}
          onGenerate={onGenerate}
          onBack={handleBack}
          generating={generating}
        />
      </Box>
    );
  }

  function renderStep() {
    switch (activeStep) {
      case 'brand':
        return <StepBrand brief={brief} patch={patch} />;
      case 'audience':
        return <StepAudience brief={brief} patch={patch} />;
      default:
        return null;
    }
  }

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{renderStep()}</Box>
      <Box sx={{ flexShrink: 0 }}>
        <WizardNav
          stepIndex={step}
          totalSteps={totalSteps}
          onBack={handleBack}
          onNext={handleNext}
          backDisabled={step === 0}
          isLastStep={step === totalSteps - 1}
        />
      </Box>
    </Box>
  );
}
