import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import { AspectRatio, Close, Crop, FitScreen, PhotoOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';

import ImageSourceTabs from '../../../../../../components/ImageSourceTabs';
import UnsplashImagePicker from '../../../../../../components/UnsplashImagePicker';
import {
  setDisableEdition,
  setImageUploading,
  useBackgroundUploadInput,
  useBackgroundUrlInput,
  useSelectedBlockId,
} from '../../../../../../documents/editor/EditorContext';
import { clearUnsplashCredit } from '../../../../../../documents/editor/unsplashCreditsStore';

import FieldContainer from './components/FieldContainer';
import { INPUT_TEXTFIELD_SX } from './components/inputStyles';
import Select from './components/Select';
import SourceImagePreview from './components/SourceImagePreview';
import LabelProperty from './LabelProperty';
import { getPositionI18nKey, getPositionIcon } from './positionIcons';
import { WarningIcon } from './WarningIcon';

interface ImageInputProps {
  blockId?: string | null;
  defaultValue?: string | null;
  values: object;
}

// Tipos para los parámetros del background
type BackgroundSize = 'cover' | 'contain' | 'auto';
type BackgroundRepeat = 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
type BackgroundPosition =
  | 'center center'
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';

interface BackgroundParams {
  url: string;
  repeat: BackgroundRepeat;
  position: BackgroundPosition;
  size: BackgroundSize;
}

const ImageInput: React.FC<ImageInputProps & { onChange: (value: string | null, styles?: unknown) => void }> = ({
  defaultValue,
  onChange,
  values,
}) => {
  const blockId = useSelectedBlockId();
  const { t } = useTranslation('inspector');
  const _theme = useTheme();

  // Función para parsear el valor de background CSS
  const parseBackgroundValue = (backgroundValue: string | null): BackgroundParams => {
    if (!backgroundValue) {
      return {
        url: '',
        repeat: 'no-repeat',
        position: 'center center',
        size: 'cover',
      };
    }

    // Permissive URL extractor: accepts url("..."), url('...'), url(...) and bare
    // http(s):// / data: URLs. Mirrors the backend extractor in
    // `packages/backend/src/routes/expand-image-tokens.ts` so AI-generated and
    // hand-edited documents both render their preview thumbnails.
    const trimmed = backgroundValue.trim();
    let url = '';
    if (trimmed.startsWith('url(')) {
      const m = trimmed.match(/^url\(\s*['"]?([^'")]+)['"]?\s*\)/);
      url = m ? m[1] : '';
    } else if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('data:')) {
      url = trimmed;
    }

    // Extraer repeat
    let repeat: BackgroundRepeat = 'no-repeat';
    if (backgroundValue.includes('repeat-x')) repeat = 'repeat-x';
    else if (backgroundValue.includes('repeat-y')) repeat = 'repeat-y';
    else if (backgroundValue.includes('repeat') && !backgroundValue.includes('no-repeat')) repeat = 'repeat';

    // Extraer position
    let position: BackgroundPosition = 'center center';
    const positionOptions: BackgroundPosition[] = [
      'top left',
      'top center',
      'top right',
      'center left',
      'center center',
      'center right',
      'bottom left',
      'bottom center',
      'bottom right',
    ];

    for (const pos of positionOptions) {
      if (backgroundValue.includes(pos)) {
        position = pos;
        break;
      }
    }

    // Extraer size
    let size: BackgroundSize = 'cover';
    if (backgroundValue.includes('contain')) size = 'contain';
    else if (backgroundValue.includes('auto')) size = 'auto';

    return { url, repeat, position, size };
  };

  // Función para construir el valor de background CSS
  const buildBackgroundValue = (params: BackgroundParams): string => {
    if (!params.url) return '';
    return `url("${params.url}") ${params.repeat} ${params.position} / ${params.size}`;
  };

  // Estados
  const [value, setValue] = useState<string | null>(defaultValue || null);
  const [backgroundParams, setBackgroundParams] = useState<BackgroundParams>(parseBackgroundValue(defaultValue));
  const [isDragging, setIsDragging] = useState(false);
  const [, _setErrors] = useState<ZodError | null>(null);
  const [urlValue, setUrlValue] = useState<string>(parseBackgroundValue(defaultValue).url || '');
  const [isValidatingUrl, setIsValidatingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string>('');
  const [isSvgImage, setIsSvgImage] = useState<boolean>(false);
  const inputFile = useRef<HTMLInputElement>(null);

  const [customImageProvider, setCustomImageProvider] = useState<React.ReactNode>(null);
  const showUrlInput = useBackgroundUrlInput();
  const showUploadInput = useBackgroundUploadInput();
  const showUploadTab = showUrlInput || showUploadInput;
  const [unsplashEnabled, setUnsplashEnabled] = useState<boolean>(() => {
    return Boolean((window as any).__emailBuilderUnsplashEnabled);
  });

  // Keep the Gallery (Unsplash) tab visibility in sync with the window global
  // toggled by `EmailBuilder` when the host changes `unsplashEnabled`.
  useEffect(() => {
    const onUpdate = () => {
      setUnsplashEnabled(Boolean((window as any).__emailBuilderUnsplashEnabled));
    };
    onUpdate();
    window.addEventListener('email-builder-unsplash-updated', onUpdate);
    return () => window.removeEventListener('email-builder-unsplash-updated', onUpdate);
  }, []);

  // Check for custom image provider
  useEffect(() => {
    const provider = (window as any).__emailBuilderCustomImageProvider;
    if (provider) {
      setCustomImageProvider(provider);

      setTimeout(() => {
        if (blockId) {
          window.dispatchEvent(
            new CustomEvent('email-builder-image-panel-opened', {
              detail: {
                blockId: blockId,
                currentImageUrl: backgroundParams.url || null,
                alt: null,
                source: 'background',
              },
            })
          );
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: broadcasts the initial background state once; re-running on param/blockId changes would re-dispatch and loop
  }, []);

  const [hideBackgroundImageWarning, _setHideBackgroundImageWarning] = useState<boolean>(() => {
    // Check session storage on initial load
    const storedPreference = sessionStorage.getItem('hideBackgroundImageWarning');
    return storedPreference === 'true';
  });

  // Función para actualizar parámetros del background
  const updateBackgroundParams = (newParams: Partial<BackgroundParams>, styles?: unknown) => {
    const updatedParams = { ...backgroundParams, ...newParams };
    setBackgroundParams(updatedParams);

    if (updatedParams.url) {
      const newValue = buildBackgroundValue(updatedParams);
      setValue(newValue);
      onChange(newValue, styles);
    } else {
      console.error('Update params error: ', updatedParams);
    }
  };

  const checkIfSvg = (url: string, contentType?: string | null): boolean => {
    if (!url) return false;
    const urlLower = url?.toLowerCase();
    const isSvgUrl = urlLower.includes('.svg') || urlLower.includes('svg');
    const isSvgContentType = contentType && (contentType.includes('image/svg+xml') || contentType.includes('svg'));
    return isSvgUrl || Boolean(isSvgContentType);
  };

  const validateImageUrl = async (url: string): Promise<boolean> => {
    try {
      setIsValidatingUrl(true);
      setUrlError('');
      setIsSvgImage(false); // Reset SVG state

      // Validate URL format
      try {
        new URL(url);
      } catch {
        setUrlError('Invalid URL format');
        return false;
      }

      // First try with fetch to check accessibility and content-type
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          setUrlError(`HTTP ${response.status}: ${response.statusText}`);
          return false;
        }

        const contentType = response.headers.get('content-type');
        const validImageTypes = ['image/', 'image/svg+xml', 'text/xml', 'application/xml'];

        const isValidImageType = validImageTypes.some(
          (type) => contentType && contentType.toLowerCase().includes(type.toLowerCase())
        );

        if (!isValidImageType) {
          setUrlError('URL does not point to an image');
          return false;
        }

        if (checkIfSvg(url, contentType)) {
          setIsSvgImage(true);
        }

        setUrlError('');
        return true;
      } catch (fetchError) {
        clearTimeout(timeoutId);

        if (fetchError.name === 'AbortError') {
          setUrlError('Request timeout - URL took too long to respond');
          return false;
        }

        return new Promise<boolean>((resolve) => {
          const img = new Image();

          const timeout = setTimeout(() => {
            setUrlError('Request timeout - URL took too long to respond');
            resolve(false);
          }, 10000);

          img.onload = () => {
            clearTimeout(timeout);

            // Check if it's SVG based on URL since we don't have content-type
            if (checkIfSvg(url)) {
              setIsSvgImage(true);
            }

            setUrlError('');
            resolve(true);
          };

          img.onerror = () => {
            clearTimeout(timeout);
            setUrlError('Cannot access image - CORS policy, network error, or invalid URL');
            resolve(false);
          };

          // DON'T set crossOrigin for URLs that don't support CORS
          // img.crossOrigin = 'anonymous'; // <- Comentado
          img.src = url;
        });
      }
    } catch (_error) {
      setUrlError('Unexpected error occurred while validating URL');
      return false;
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (urlValue.trim()) {
      const isValid = await validateImageUrl(urlValue.trim());
      if (isValid) {
        updateBackgroundParams({ url: urlValue.trim() });
        if (blockId) clearUnsplashCredit(blockId);
      }
    }
  };

  const handleUrlKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleUrlSubmit();
    }
  };

  // Clear error when user starts typing
  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUrlValue(e.target.value);
    if (urlError) {
      setUrlError('');
    }
    if (isSvgImage) {
      setIsSvgImage(false);
    }
  };

  const handleFileUpload = (files: FileList | File[]) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif'];
    const maxSize = 5 * 1024 * 1024;

    const filesArray = Array.isArray(files) ? files : Array.from(files);

    const validFiles = filesArray.filter((file) => validTypes.includes(file.type) && file.size <= maxSize);

    if (validFiles.length !== filesArray.length) {
      alert(t('inputs.common.invalidFiles'));
    }

    if (validFiles.length === 0) return;

    const readerPromises = validFiles.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        })
    );

    Promise.all(readerPromises).then((results) => {
      const detail = {
        images: results, // array of base64 strings
        id: blockId || '',
        styles: values,
      };
      window.dispatchEvent(new CustomEvent('email-builder-upload-image', { detail }));
      setImageUploading(true, blockId || '');
      /*   setDisableEdition(true);
          setTimeout(() => {
              setDisableEdition(false);
          }, 60 * 10000); */
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    handleFileUpload(files);
  };

  const _toggleMedia = () => {
    const customEvent = new CustomEvent('toggle-media-library', {
      detail: true,
    });
    window.dispatchEvent(customEvent);
  };

  // Reset function to clear all settings
  const resetBackground = () => {
    setBackgroundParams({
      url: '',
      repeat: 'no-repeat',
      position: 'center center',
      size: 'cover',
    });
    setValue(null);
    onChange(null);
    setUrlValue('');
    setIsSvgImage(false);
  };

  useEffect(() => {
    const setImage = (event: Event) => {
      const { detail } = event as CustomEvent<{ id: string; url: string; data: any; styles: any }>;
      setImageUploading(false, detail.id || '');
      updateBackgroundParams({ url: detail.url }, detail.styles);
      if (blockId) clearUnsplashCredit(blockId);
      setDisableEdition(false);
      setUrlValue(detail.url);
    };

    const toggleUploading = (event: CustomEvent) => {
      setImageUploading(event?.detail?.uploading ?? false, event?.detail?.id ?? '');
    };

    const handleUpload = () => {
      inputFile?.current?.click();
    };

    const selectImage = (event: Event) => {
      const detail = (event as CustomEvent<string | { id: string; url: string; data?: unknown; styles?: unknown }>)
        .detail;
      if (typeof detail === 'string') {
        if (!detail.includes('url(')) {
          updateBackgroundParams({ url: detail });
          setUrlValue(detail);
        } else {
          const parsed = parseBackgroundValue(detail);
          setBackgroundParams(parsed);
          setValue(detail);
          onChange(detail);
          setUrlValue(parsed.url);
        }
        return;
      }
      if (detail?.url != null && typeof detail.url === 'string') {
        updateBackgroundParams({ url: detail.url }, detail.styles);
        setUrlValue(detail.url);
      }
    };

    window.addEventListener('email-builder-set-image', selectImage);
    window.addEventListener('email-builder-upload-image-receive', setImage);
    window.addEventListener('email-builder-upload-file', handleUpload);
    window.addEventListener('email-builder-toggle-upload-file', toggleUploading);

    return () => {
      window.removeEventListener('email-builder-upload-image-receive', setImage);
      window.removeEventListener('email-builder-set-image', selectImage);
      window.removeEventListener('email-builder-upload-file', handleUpload);
      window.removeEventListener('email-builder-toggle-upload-file', toggleUploading);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners intentionally re-bind only when backgroundParams changes; onChange/updateBackgroundParams are stable
  }, [backgroundParams]);

  // Check if current image is SVG when component mounts or defaultValue changes
  useEffect(() => {
    if (defaultValue) {
      setIsSvgImage(checkIfSvg(backgroundParams.url));
    }
  }, [defaultValue, backgroundParams.url]);

  // Sync value and urlValue with defaultValue
  useEffect(() => {
    if (defaultValue !== value) {
      const parsed = parseBackgroundValue(defaultValue);
      setBackgroundParams(parsed);
      setValue(defaultValue || null);
      setUrlValue(parsed.url || ''); // Set URL input to current value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checks SVG only when defaultValue changes; value is local state derived from it
  }, [defaultValue]);

  return (
    <FieldContainer>
      {/* Label with tooltip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <LabelProperty label={t('inputs.backgroundImage.label')} />
        {!hideBackgroundImageWarning && (
          <Tooltip title={t('inputs.backgroundImage.warningTooltip')} placement="top">
            <IconButton
              size="small"
              color="warning"
              disableRipple
              sx={{
                p: 0,
                cursor: 'help',
                lineHeight: 0,
                '&:hover': {
                  backgroundColor: 'transparent',
                },
              }}
            >
              <WarningIcon aria-hidden />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <SourceImagePreview imageUrl={backgroundParams.url || null} blockId={blockId} onRemove={resetBackground} />

      <ImageSourceTabs
        tabs={[
          {
            key: 'gallery',
            label: t('inputs.tabs.gallery'),
            visible: unsplashEnabled,
            render: () => <UnsplashImagePicker blockId={blockId} source="background" />,
          },
          {
            key: 'yourGallery',
            label: t('inputs.tabs.yourGallery'),
            visible: Boolean(customImageProvider),
            render: () => <Box sx={{ mb: 2 }}>{customImageProvider}</Box>,
          },
          {
            key: 'upload',
            label: t('inputs.tabs.upload'),
            visible: showUploadTab,
            render: () => (
              <Stack spacing={1}>
                <Box>
                  {showUrlInput && (
                    <>
                      <LabelProperty label={t('inputs.image.urlLabel')} />
                      <Stack direction="row" spacing={1}>
                        <TextField
                          fullWidth
                          placeholder={t('inputs.image.urlPlaceholder')}
                          value={urlValue}
                          onChange={handleUrlChange}
                          onKeyPress={handleUrlKeyPress}
                          disabled={isValidatingUrl}
                          sx={INPUT_TEXTFIELD_SX}
                        />
                        <Button
                          variant="contained"
                          onClick={handleUrlSubmit}
                          disabled={!urlValue.trim() || isValidatingUrl}
                          sx={{
                            minWidth: 'auto',
                            px: 2,
                            position: 'relative',
                          }}
                        >
                          {isValidatingUrl ? <CircularProgress size={20} color="inherit" /> : t('inputs.common.add')}
                        </Button>
                      </Stack>

                      {urlError && (
                        <Alert
                          severity="error"
                          sx={{
                            mt: 1,
                            fontSize: '0.875rem',
                            maxHeight: '70px',
                          }}
                        >
                          {urlError}
                        </Alert>
                      )}

                      {isSvgImage && (
                        <Alert
                          severity="warning"
                          sx={{
                            mt: 1,
                            fontSize: '0.875rem',
                          }}
                          action={
                            <IconButton
                              aria-label={t('inputs.common.close')}
                              color="inherit"
                              size="small"
                              onClick={() => {
                                setIsSvgImage(false);
                              }}
                            >
                              <Close fontSize="inherit" />
                            </IconButton>
                          }
                        >
                          {t('inputs.common.svgWarning')}
                        </Alert>
                      )}
                    </>
                  )}
                </Box>

                {showUrlInput && showUploadInput && (
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Divider sx={{ flexGrow: 1 }} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {t('inputs.backgroundImage.or')}
                    </Typography>
                    <Divider sx={{ flexGrow: 1 }} />
                  </Stack>
                )}

                {showUploadInput && (
                  <Box
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    sx={{
                      width: '100%',
                      border: '2px dashed',
                      borderColor: isDragging ? 'primary.main' : 'divider',
                      borderRadius: '8px',
                      padding: '24px 8px 36px 8px',
                      textAlign: 'center',
                      bgcolor: isDragging ? 'primary.50' : 'background.paper',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <PhotoOutlined sx={{ fontSize: 32, color: 'primary' }} />
                    </Box>
                    <label style={{ cursor: 'pointer' }}>
                      <input
                        ref={inputFile}
                        type="file"
                        style={{ display: 'none' }}
                        accept="image/png,image/jpeg,image/gif"
                        multiple
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleFileUpload(Array.from(files));
                          }
                        }}
                      />
                      <Typography
                        component="span"
                        sx={{
                          fontWeight: 'bold',
                          color: 'primary.main',
                          '&:hover': {
                            fontWeight: 'bold',
                            color: 'primary.secondary',
                          },
                        }}
                      >
                        {t('inputs.common.uploadFile')}
                      </Typography>
                      <Typography component="span" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                        {' '}
                        {t('inputs.common.dragAndDrop')}
                      </Typography>
                    </label>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                      {t('inputs.common.fileInfo')}
                    </Typography>
                  </Box>
                )}
              </Stack>
            ),
          },
        ]}
        defaultTab="upload"
      />

      {/* Background settings - only show when image is loaded */}
      {backgroundParams.url && (
        <Box sx={{ mt: 2 }}>
          {/* Background Fill Type */}
          <Box sx={{ mb: 2 }}>
            <LabelProperty label={t('inputs.backgroundImage.fillType')} />
            <ToggleButtonGroup
              value={backgroundParams.size}
              exclusive
              onChange={(_, newSize) => {
                if (newSize != null && typeof newSize === 'string') {
                  updateBackgroundParams({ size: newSize as BackgroundSize });
                }
              }}
              size="small"
              fullWidth
            >
              <ToggleButton value="cover">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <Crop fontSize="small" />
                  <span>{t('inputs.backgroundImage.fillOptions.cover')}</span>
                </Box>
              </ToggleButton>
              <ToggleButton value="contain">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <FitScreen fontSize="small" />
                  <span>{t('inputs.backgroundImage.fillOptions.contain')}</span>
                </Box>
              </ToggleButton>
              <ToggleButton value="auto">
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
                  <AspectRatio fontSize="small" />
                  <span>{t('inputs.backgroundImage.fillOptions.auto')}</span>
                </Box>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {/* Background Repeat and Position in same row */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <div style={{ flex: 1 }}>
              <LabelProperty label={t('inputs.backgroundImage.repeat')} />
              <Select
                style={{ width: '100%' }}
                value={backgroundParams.repeat}
                size="small"
                onChange={(e) => updateBackgroundParams({ repeat: e.target.value as BackgroundRepeat })}
              >
                <MenuItem value="no-repeat">{t('inputs.backgroundImage.repeatOptions.none')}</MenuItem>
                <MenuItem value="repeat">{t('inputs.backgroundImage.repeatOptions.repeat')}</MenuItem>
                <MenuItem value="repeat-x">{t('inputs.backgroundImage.repeatOptions.repeatX')}</MenuItem>
                <MenuItem value="repeat-y">{t('inputs.backgroundImage.repeatOptions.repeatY')}</MenuItem>
              </Select>
            </div>

            <div style={{ flex: 1 }}>
              <LabelProperty label={t('inputs.backgroundImage.position')} />
              <Select
                style={{ width: '100%' }}
                value={backgroundParams.position}
                size="small"
                onChange={(e) => updateBackgroundParams({ position: e.target.value as BackgroundPosition })}
                renderValue={(v) => {
                  const value = String(v ?? '');
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, paddingRight: '1rem' }}>
                      {getPositionIcon(value)}
                      {t(`inputs.backgroundImage.positions.${getPositionI18nKey(value)}`)}
                    </Box>
                  );
                }}
              >
                {[
                  'top left',
                  'top center',
                  'top right',
                  'center left',
                  'center center',
                  'center right',
                  'bottom left',
                  'bottom center',
                  'bottom right',
                ].map((position) => (
                  <MenuItem
                    sx={{
                      padding: '0.5rem 1rem 0.5rem 0.5rem!important ',
                    }}
                    key={position}
                    value={position}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {getPositionIcon(position)}
                      {t(`inputs.backgroundImage.positions.${getPositionI18nKey(position)}`)}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </div>
          </Stack>
        </Box>
      )}

      {/* SVG warning shown when no custom provider is mounted and the
          current background image is an SVG. Inline alerts inside the
          Upload tab cover the picker-driven flow; this is the catch-all
          for hosts that mount the picker without exposing the inline
          alert (e.g. read-only previews). */}
      {!customImageProvider && isSvgImage && (
        <Alert
          severity="warning"
          sx={{
            mt: 1,
            fontSize: '0.875rem',
          }}
        >
          {t('inputs.common.svgWarning')}
        </Alert>
      )}
    </FieldContainer>
  );
};

export default ImageInput;
