import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Attachment, Refresh } from '@mui/icons-material';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';

import AiSparkleIcon from '../../../../../AIGeneration/AiSparkleIcon';

import { CloseButton } from './components/CloseButton';
import { ImagePreview } from './components/ImagePreview';
import { PromptInput } from './components/PromptInput';
import { ImageGenerationError } from './types/errors';
import { getErrorDetails } from './utils/errorHandling';

interface ImageGeneration {
  url: string | null;
  success: boolean;
  error?: {
    code: number;
    message: string;
  };
}

interface AiImageGenerationProps {
  src?: string | null;
  style: React.CSSProperties;
}

export default function AiImageGeneration({ src, style }: AiImageGenerationProps) {
  const { t } = useTranslation('inspector');
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState<ImageGenerationError | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStep, setLoadingStep] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const LOADING_STEPS = [
    t('inputs.aiImageGeneration.loadingStep1'),
    t('inputs.aiImageGeneration.loadingStep2'),
    t('inputs.aiImageGeneration.loadingStep3'),
    t('inputs.aiImageGeneration.loadingStep4'),
  ];

  const startLoadingAnimation = useCallback(() => {
    setLoadingProgress(0);
    setLoadingStep(0);
    if (progressRef.current) clearInterval(progressRef.current);
    const totalMs = 60000;
    const intervalMs = 100;
    let elapsed = 0;
    progressRef.current = setInterval(() => {
      elapsed += intervalMs;
      setLoadingProgress(Math.min((elapsed / totalMs) * 95, 95));
      setLoadingStep(Math.min(Math.floor((elapsed / totalMs) * LOADING_STEPS.length), LOADING_STEPS.length - 1));
      if (elapsed >= totalMs && progressRef.current) clearInterval(progressRef.current);
    }, intervalMs);
  }, [LOADING_STEPS.length]);

  const stopLoadingAnimation = useCallback(() => {
    if (progressRef.current) {
      clearInterval(progressRef.current);
      progressRef.current = null;
    }
    setLoadingProgress(100);
  }, []);

  const handleClickOpen = () => {
    setOpen(true);
    setError(null);
  };

  const handleClose = () => {
    if (isLoading) return;
    setOpen(false);
    setIsLoading(false);
    setImagePreview(null);
    setPrompt('');
    setIsRegenerating(false);
    setError(null);
    setSaving(false);
    stopLoadingAnimation();
  };

  const handleGenerateImage = () => {
    const eventName = imagePreview && !isRegenerating ? 'store-ai-image' : 'request-ai-image';
    const detail = imagePreview && !isRegenerating ? imagePreview : prompt;

    setError(null);

    if (eventName === 'store-ai-image') {
      setSaving(true);
      setIsLoading(false);
      setTimeout(() => {
        setIsLoading(false);
        handleClose();
      }, 2000);
    } else {
      setIsLoading(true);
      startLoadingAnimation();
    }

    window.dispatchEvent(new CustomEvent(eventName, { detail }));
  };

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setImagePreview(null);
    setError(null);
    setSaving(false);
  };

  useEffect(() => {
    const receiveImage = (event: Event) => {
      const { detail } = event as CustomEvent<ImageGeneration>;
      stopLoadingAnimation();
      setIsLoading(false);

      if (detail.error) {
        setError(getErrorDetails(detail.error));
        return;
      }

      if (!detail.success || !detail.url) {
        setError({
          code: 0,
          title: 'Generation Failed',
          message: 'Failed to generate the image.',
          action: 'Please try again',
        });
        return;
      }

      setImagePreview(detail.url);
      setIsRegenerating(false);
    };

    window.addEventListener('generated-image', receiveImage);

    return () => {
      window.removeEventListener('generated-image', receiveImage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only window event listener registration; handlers are stable for the component lifetime
  }, []);

  useEffect(() => {
    handleClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- closes the dialog only when src changes; handleClose is stable
  }, [src]);

  const showPromptInput = !imagePreview || isRegenerating;

  return (
    <>
      <Button
        style={style}
        startIcon={<AiSparkleIcon className="w-4 h-4" />}
        variant="contained"
        onClick={handleClickOpen}
      >
        {t('inputs.aiImageGeneration.generate')}
      </Button>

      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { bgcolor: 'background.paper', color: 'text.primary', borderRadius: '10px' } } }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleGenerateImage();
          }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: '24px', color: error ? 'error.main' : 'inherit' }}>
            {error
              ? t('inputs.aiImageGeneration.titleError')
              : isLoading
                ? t('inputs.aiImageGeneration.titleLoading')
                : !imagePreview
                  ? t('inputs.aiImageGeneration.titleCreate')
                  : t('inputs.aiImageGeneration.titleReady')}
            <CloseButton onClick={handleClose} disabled={isLoading} primary={true} />
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ pb: 1, color: error ? 'error.dark' : 'inherit' }}>
              {error
                ? t('inputs.aiImageGeneration.descriptionError')
                : isLoading
                  ? t('inputs.aiImageGeneration.descriptionLoading')
                  : showPromptInput
                    ? t('inputs.aiImageGeneration.descriptionCreate')
                    : t('inputs.aiImageGeneration.descriptionReady')}
            </DialogContentText>

            {imagePreview && !isRegenerating ? (
              <Stack sx={{ position: 'relative' }}>
                <ImagePreview imageUrl={imagePreview} saving={saving} />
                <Alert variant="outlined" severity="warning" icon={false}>
                  {t('inputs.aiImageGeneration.warningRegenerate')}{' '}
                  <b>{t('inputs.aiImageGeneration.warningInsertFirst')}</b> {t('inputs.aiImageGeneration.warningFirst')}
                </Alert>
              </Stack>
            ) : isLoading && !imagePreview ? (
              <Stack
                spacing={2}
                sx={{
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: (theme: any) => theme.palette.mainColor?.[50] ?? theme.palette.action.hover,
                  height: '326px',
                  width: '100%',
                  borderRadius: '8px',
                }}
              >
                <AiSparkleIcon
                  sx={{
                    fontSize: 48,
                    color: 'primary.main',
                    animation: 'pulse 1.5s ease-in-out infinite',
                    '@keyframes pulse': {
                      '0%, 100%': { opacity: 0.4, transform: 'scale(1)' },
                      '50%': { opacity: 1, transform: 'scale(1.15)' },
                    },
                  }}
                />
                <Typography
                  variant="body2"
                  sx={{ color: 'text.secondary', fontWeight: 500, transition: 'opacity 0.3s' }}
                >
                  {LOADING_STEPS[loadingStep]}
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={loadingProgress}
                  sx={{ width: '60%', borderRadius: 4, height: 6 }}
                />
              </Stack>
            ) : (
              <PromptInput value={prompt} onChange={setPrompt} disabled={isLoading} />
            )}
          </DialogContent>
          {!isLoading && (
            <DialogActions className="p-6">
              {imagePreview && !isRegenerating && (
                <Button
                  startIcon={<Refresh className="w-4 h-4" />}
                  onClick={handleRegenerate}
                  variant="outlined"
                  disabled={isLoading}
                >
                  {t('inputs.aiImageGeneration.regenerate')}
                </Button>
              )}

              {!imagePreview && !isRegenerating && (
                <Button onClick={handleClose} variant="text" disabled={isRegenerating}>
                  {t('inputs.aiImageGeneration.cancel')}
                </Button>
              )}

              <Button
                startIcon={
                  imagePreview && !isRegenerating ? (
                    <Attachment className="w-4 h-4" />
                  ) : (
                    <AiSparkleIcon className="w-4 h-4" />
                  )
                }
                onClick={handleGenerateImage}
                variant="contained"
                disabled={!prompt || prompt?.length < 20}
              >
                {imagePreview && !isRegenerating
                  ? t('inputs.aiImageGeneration.insertImage')
                  : t('inputs.aiImageGeneration.generateImage')}
                {isLoading && <CircularProgress size={16} className="ml-2" />}
              </Button>
            </DialogActions>
          )}
        </form>
      </Dialog>
    </>
  );
}
