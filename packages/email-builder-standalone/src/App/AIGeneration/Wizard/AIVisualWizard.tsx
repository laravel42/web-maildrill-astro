import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Button, MobileStepper, Stack, Typography } from '@mui/material';

import { useComponentsLibraryEnabled } from '../../../documents/editor/EditorContext';

import type { DraftBrief } from './briefDefaults';
import GenerationTargetPicker, { type GenerationTarget } from './GenerationTargetPicker';
import Step01Strategy from './steps/Step01Strategy';
import Step02Tone from './steps/Step02Tone';
import Step03Visual from './steps/Step03Visual';
import Step04Imagery from './steps/Step04Imagery';
import Step05Layout from './steps/Step05Layout';
import StepThemeColors from './steps/StepThemeColors';
import StepThemeTypography from './steps/StepThemeTypography';
import SummaryStep from './SummaryStep';
import ThemeSummaryStep from './ThemeSummaryStep';
import { useVisualBrief } from './useVisualBrief';

interface Props {
  initialRawIntent?: string;
  backendUrl: string;
  brandColors?: { primary?: string; secondary?: string; accent?: string };
  locale?: string;
  onGenerate: (prompt: string, brief: DraftBrief) => void;
  /** Called after a theme is applied to the document (theme target). */
  onThemeApplied?: () => void;
  generating: boolean;
}

const STEP_TITLE_KEYS: Record<number, string> = {
  0: 'steps.step01.title',
  1: 'steps.step02.title',
  2: 'steps.step03.title',
  3: 'steps.step04.title',
  4: 'steps.step05.title',
  99: 'steps.theme.title',
  100: 'steps.themeTypography.title',
};

/**
 * Build step indices based on target and brief state:
 * - template: all 5 steps (skip imagery if photoStyle=none)
 * - component: Strategy + Tone + Visual (3 steps, no layout/imagery)
 * - theme: dedicated color step (placeholder — full Theme Builder is a separate feature)
 */
function buildStepSequence(target: GenerationTarget, photoStyle: string | undefined): number[] {
  switch (target) {
    case 'component':
      return [0, 1, 2]; // Strategy, Tone, Visual
    case 'theme':
      return [99, 100]; // StepThemeColors + StepThemeTypography
    case 'template':
    default:
      return photoStyle !== 'none' ? [0, 1, 2, 3, 4] : [0, 1, 2, 4];
  }
}

export default function AIVisualWizard({
  initialRawIntent = '',
  backendUrl,
  brandColors,
  locale,
  onGenerate,
  onThemeApplied,
  generating,
}: Props) {
  const { t } = useTranslation('aiWizard');
  const { brief, patch } = useVisualBrief(initialRawIntent);
  const libraryEnabled = useComponentsLibraryEnabled();
  const [target, setTarget] = React.useState<GenerationTarget | null>(null);
  const [step, setStep] = React.useState(0);

  // Initialise brand colors from props once on mount
  React.useEffect(() => {
    if (brandColors?.primary || brandColors?.secondary) {
      patch({ visual_strategy: { brandColors } });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If no target selected yet, show the target picker
  if (!target) {
    return <GenerationTargetPicker onSelect={setTarget} />;
  }

  const stepSequence = buildStepSequence(target, brief.visual_strategy.photoStyle);
  const totalSteps = stepSequence.length;
  const isSummary = step === totalSteps;
  const activeDataStep = stepSequence[step] ?? stepSequence[totalSteps - 1];

  function handleNext() {
    setStep((s) => s + 1);
  }
  function handleBack() {
    if (step === 0) {
      setTarget(null); // go back to target picker
    } else {
      setStep((s) => s - 1);
    }
  }

  function renderStep() {
    if (isSummary) {
      if (target === 'theme') {
        return (
          <ThemeSummaryStep
            brief={brief}
            backendUrl={backendUrl}
            locale={locale}
            libraryEnabled={libraryEnabled}
            onBack={handleBack}
            onApplied={onThemeApplied}
          />
        );
      }
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
    switch (activeDataStep) {
      case 0:
        return <Step01Strategy brief={brief} patch={patch} />;
      case 1:
        return <Step02Tone brief={brief} patch={patch} />;
      case 2:
        return <Step03Visual brief={brief} patch={patch} />;
      case 3:
        return <Step04Imagery brief={brief} patch={patch} />;
      case 4:
        return <Step05Layout brief={brief} patch={patch} />;
      case 99:
        return <StepThemeColors brief={brief} patch={patch} />;
      case 100:
        return <StepThemeTypography brief={brief} patch={patch} />;
      default:
        return null;
    }
  }

  return (
    <Stack spacing={2} sx={{ minHeight: 320 }}>
      {!isSummary && (
        <Typography variant="subtitle2" color="text.secondary">
          {t(STEP_TITLE_KEYS[activeDataStep])}
        </Typography>
      )}

      <Box sx={{ flex: 1 }}>{renderStep()}</Box>

      {!isSummary && (
        <MobileStepper
          variant="dots"
          steps={totalSteps + 1}
          position="static"
          activeStep={step}
          backButton={
            <Button size="small" onClick={handleBack} disabled={step === 0}>
              {t('steps.common.back')}
            </Button>
          }
          nextButton={
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={handleNext} color="inherit">
                {t('steps.common.skip')}
              </Button>
              <Button size="small" variant="contained" onClick={handleNext}>
                {step === totalSteps - 1 ? t('steps.common.review') : t('steps.common.next')}
              </Button>
            </Stack>
          }
          sx={{ bgcolor: 'transparent', px: 0 }}
        />
      )}
    </Stack>
  );
}
