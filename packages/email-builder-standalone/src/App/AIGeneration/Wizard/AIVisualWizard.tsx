import React from 'react';

import { Box } from '@mui/material';

import type { DraftBrief } from './briefDefaults';
import WizardNav from './controls/WizardNav';
import StepAudience from './steps/StepAudience';
import StepBrand from './steps/StepBrand';
import StepSections from './steps/StepSections';
import StepTone from './steps/StepTone';
import StepVisual from './steps/StepVisual';
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

type StepId = 'brand' | 'audience' | 'tone' | 'visual' | 'sections';

/**
 * Step-by-step template composer. Collects brand, audience/colours, tone,
 * visual direction, and section structure, then compiles a craft-aware
 * prompt via `/visual-brief/compile` before handing off to `/generate`.
 */
const STEP_SEQUENCE: StepId[] = ['brand', 'audience', 'tone', 'visual', 'sections'];

export default function AIVisualWizard({
  initialRawIntent = '',
  backendUrl,
  brandColors,
  onGenerate,
  generating,
}: Props) {
  const { brief, patch } = useVisualBrief(initialRawIntent);
  const [step, setStep] = React.useState(0);

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
      <SummaryStep
        brief={brief}
        backendUrl={backendUrl}
        onGenerate={onGenerate}
        onBack={handleBack}
        generating={generating}
      />
    );
  }

  function renderStep() {
    switch (activeStep) {
      case 'brand':
        return <StepBrand brief={brief} patch={patch} />;
      case 'audience':
        return <StepAudience brief={brief} patch={patch} />;
      case 'tone':
        return <StepTone brief={brief} patch={patch} />;
      case 'visual':
        return <StepVisual brief={brief} patch={patch} />;
      case 'sections':
        return <StepSections brief={brief} patch={patch} />;
      default:
        return null;
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minHeight: 320 }}>
      <Box sx={{ flex: 1 }}>{renderStep()}</Box>
      <WizardNav
        stepIndex={step}
        totalSteps={totalSteps}
        onBack={handleBack}
        onNext={handleNext}
        backDisabled={step === 0}
        isLastStep={step === totalSteps - 1}
      />
    </Box>
  );
}
