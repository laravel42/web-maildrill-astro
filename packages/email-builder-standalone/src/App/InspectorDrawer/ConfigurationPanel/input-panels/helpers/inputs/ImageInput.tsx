import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';

import { ImagePropsSchema } from '@eb/block-image';
import { Close, ImageSearchOutlined, PhotoOutlined } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

import ImageSourceTabs from '../../../../../../components/ImageSourceTabs';
import UnsplashImagePicker from '../../../../../../components/UnsplashImagePicker';
import {
  getGalleryImages,
  setDisableEdition,
  setImageUploading,
  useImageUploadInput,
  useImageUrlInput,
} from '../../../../../../documents/editor/EditorContext';
import { atomicUpdateBlockProps } from '../../../../../../documents/editor/granular';
import { clearUnsplashCredit } from '../../../../../../documents/editor/unsplashCreditsStore';

import FieldContainer from './components/FieldContainer';
import { INPUT_TEXTFIELD_SX } from './components/inputStyles';
import SourceImagePreview from './components/SourceImagePreview';
import LabelProperty from './LabelProperty';

interface ImageInputProps {
  data: any;
  setData: (data: any) => void;
  blockId?: string | null;
}

const ImageInput: React.FC<ImageInputProps> = ({ data, setData, blockId }) => {
  const { t } = useTranslation('inspector');
  const [isDragging, setIsDragging] = useState(false);
  const [, setErrors] = useState<z.ZodError | null>(null);
  const [urlValue, setUrlValue] = useState<string>('');
  const [isValidatingUrl, setIsValidatingUrl] = useState<boolean>(false);
  const [urlError, setUrlError] = useState<string>('');
  const [isSvgImage, setIsSvgImage] = useState<boolean>(false);
  const inputFile = useRef<HTMLInputElement>(null);
  const [customImageProvider, setCustomImageProvider] = useState<React.ReactNode>(null);
  const showUrlInput = useImageUrlInput();
  const showUploadInput = useImageUploadInput();
  const showUploadTab = showUrlInput || showUploadInput;
  const [unsplashEnabled, setUnsplashEnabled] = useState<boolean>(() => {
    return Boolean((window as any).__emailBuilderUnsplashEnabled);
  });

  // Keep the Gallery (Unsplash) tab in sync with the window global set by
  // `EmailBuilder` when the host toggles `unsplashEnabled` at runtime.
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

      // Dispatch event after provider is mounted to ensure listener is ready
      setTimeout(() => {
        if (blockId) {
          window.dispatchEvent(
            new CustomEvent('email-builder-image-panel-opened', {
              detail: {
                blockId: blockId,
                currentImageUrl: data.props?.url || null,
                alt: data.props?.alt || null,
              },
            }),
          );
        }
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only initialization; re-running on data/blockId changes would clobber user edits
  }, []);

  const updateData = (d: unknown) => {
    const res = ImagePropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error as any);
    }
  };

  const checkIfSvg = (url: string, contentType?: string | null): boolean => {
    const urlLower = url.toLowerCase();
    const isSvgUrl = urlLower.includes('.svg') || urlLower.includes('svg');
    const isSvgContentType =
      contentType && (contentType.includes('image/svg+xml') || contentType.includes('svg'));
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
        setUrlError(t('inputs.image.invalidUrl'));
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
          setUrlError(
            t('inputs.image.httpError', {
              status: response.status,
              statusText: response.statusText,
            }),
          );
          return false;
        }

        const contentType = response.headers.get('content-type');
        const validImageTypes = ['image/', 'image/svg+xml', 'text/xml', 'application/xml'];

        const isValidImageType = validImageTypes.some(
          (type) => contentType && contentType.toLowerCase().includes(type.toLowerCase()),
        );

        if (!isValidImageType) {
          setUrlError(t('inputs.image.notImage'));
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
          setUrlError(t('inputs.image.timeout'));
          return false;
        }

        return new Promise<boolean>((resolve) => {
          const img = new Image();
          const timeout = setTimeout(() => {
            setUrlError(t('inputs.image.timeout'));
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
            setUrlError(t('inputs.image.loadError'));
            resolve(false);
          };

          // DON'T set crossOrigin for URLs that don't support CORS
          // img.crossOrigin = 'anonymous'; // <- Comentado
          img.src = url;
        });
      }
    } catch (_error) {
      setUrlError(t('inputs.image.unexpectedError'));
      return false;
    } finally {
      setIsValidatingUrl(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (urlValue.trim()) {
      const isValid = await validateImageUrl(urlValue.trim());
      if (isValid) {
        updateData({ ...data, props: { ...data.props, url: urlValue.trim() } });
        if (blockId) clearUnsplashCredit(blockId);
        setUrlValue(''); // Clear input after successful addition
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

  const handleFileUpload = (files: File[]) => {
    const validTypes = ['image/png', 'image/jpeg', 'image/gif'];
    const maxSize = 5 * 1024 * 1024;
    const validFiles = files.filter(
      (file) => validTypes.includes(file.type) && file.size <= maxSize,
    );

    if (validFiles.length !== files.length) {
      alert(t('inputs.common.invalidFiles'));
    }

    if (validFiles.length === 0) return;

    const readerPromises = validFiles.map(
      (file) =>
        new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        }),
    );

    Promise.all(readerPromises).then((results) => {
      const detail = {
        images: results, // array of base64 strings
        id: blockId || '',
      };
      window.dispatchEvent(new CustomEvent('email-builder-upload-image', { detail }));
      setImageUploading(true, blockId || '');
      /* 
            setDisableEdition(true);
            
            setTimeout(() => {
                setDisableEdition(false);
            }, 60 * 10000); */
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Solo cambiar isDragging si realmente salimos del área de drop
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const toggleMedia = () => {
    const customEvent = new CustomEvent('toggle-media-library', {
      detail: true,
    });
    window.dispatchEvent(customEvent);
  };

  useEffect(() => {
    const setImage = (event: Event) => {
      const { detail } = event as CustomEvent<{ id: string; url: string; data: any }>;
      setImageUploading(false, detail.id || '');
      if (blockId) {
        atomicUpdateBlockProps(blockId, { url: detail.url });
        clearUnsplashCredit(blockId);
      }
      setDisableEdition(false);
    };

    const toggleUploading = (event: CustomEvent) => {
      setImageUploading(event?.detail?.uploading ?? false, event?.detail?.id ?? '');
    };

    const handleUpload = () => {
      inputFile?.current?.click();
    };

    const selectImage = (event: Event) => {
      if (!blockId) return;
      const detail = (event as CustomEvent<string | { url: string; alt?: string }>).detail;
      if (typeof detail === 'string') {
        atomicUpdateBlockProps(blockId, { url: detail });
        clearUnsplashCredit(blockId);
        return;
      }
      if (detail && typeof detail === 'object' && typeof detail.url === 'string') {
        const updates: Record<string, unknown> = { url: detail.url };
        if (typeof detail.alt === 'string') updates.alt = detail.alt;
        atomicUpdateBlockProps(blockId, updates);
        // Don't clear credit here — the Unsplash picker also dispatches this
        // event for background source. The picker itself sets the credit.
      }
    };

    window.addEventListener('email-builder-set-image', selectImage);
    window.addEventListener('email-builder-upload-image-receive', setImage);
    window.addEventListener('email-builder-upload-file', handleUpload);
    window.addEventListener('email-builder-toggle-upload-file', toggleUploading);

    return () => {
      window.removeEventListener('email-builder-toggle-upload-file', toggleUploading);
      window.removeEventListener('email-builder-upload-image-receive', setImage);
      window.removeEventListener('email-builder-set-image', selectImage);
      window.removeEventListener('email-builder-upload-file', handleUpload);
    };
  }, [blockId]);

  // Check if current image is SVG when component mounts or data changes
  useEffect(() => {
    if (data.props?.url) {
      setIsSvgImage(checkIfSvg(data.props.url));
    }
  }, [data.props?.url]);

  // Tab content renderers. Kept as render functions so the currently-inactive
  // tabs don't instantiate state or effects until the user switches to them.

  const renderUploadTab = () => (
    <Stack spacing={1}>
      <FieldContainer>
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
                error={Boolean(urlError)}
                disabled={isValidatingUrl}
                sx={INPUT_TEXTFIELD_SX}
              />
              <Button
                variant="contained"
                onClick={handleUrlSubmit}
                disabled={!urlValue.trim() || isValidatingUrl}
                sx={{ minWidth: 'auto', px: 2 }}
              >
                {isValidatingUrl ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  t('inputs.common.add')
                )}
              </Button>
            </Stack>
            {urlError && (
              <Alert severity="error" sx={{ mt: 1, fontSize: '0.875rem' }}>
                {urlError}
              </Alert>
            )}
            {isSvgImage && (
              <Alert
                severity="warning"
                sx={{ mt: 1, fontSize: '0.875rem' }}
                action={
                  <IconButton
                    aria-label={t('inputs.common.close')}
                    color="inherit"
                    size="small"
                    onClick={() => setIsSvgImage(false)}
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
      </FieldContainer>

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
            padding: 3,
            textAlign: 'center',
            bgcolor: isDragging ? 'action.hover' : 'background.paper',
            transition: 'all 0.2s ease',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}>
            <PhotoOutlined sx={{ fontSize: 28, color: 'primary.main' }} />
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
            <Typography component="span" sx={{ fontWeight: 600, color: 'primary.main' }}>
              {t('inputs.common.uploadFile')}
            </Typography>
            <Typography component="span" sx={{ fontWeight: 500, color: 'text.secondary' }}>
              {' '}
              {t('inputs.common.dragAndDrop')}
            </Typography>
          </label>
          <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
            {t('inputs.common.fileInfo')}
          </Typography>
        </Box>
      )}

      {/* Optional secondary "Browse gallery" entry for hosts that opt in via
          the `galleryImages` prop and the `toggle-media-library` event. */}
      {!customImageProvider && getGalleryImages() && (
        <>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Divider sx={{ flexGrow: 1 }} />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {t('inputs.backgroundImage.or')}
            </Typography>
            <Divider sx={{ flexGrow: 1 }} />
          </Stack>
          <Button
            variant="outlined"
            onClick={toggleMedia}
            startIcon={<ImageSearchOutlined />}
            fullWidth
          >
            {t('inputs.backgroundImage.browseGallery')}
          </Button>
        </>
      )}
    </Stack>
  );

  return (
    <Stack spacing={1}>
      <SourceImagePreview
        imageUrl={data.props?.url ?? null}
        alt={data.props?.alt ?? ''}
        blockId={blockId}
        onRemove={() => {
          if (blockId) {
            atomicUpdateBlockProps(blockId, { url: null });
            clearUnsplashCredit(blockId);
          }
          updateData({ ...data, props: { ...(data.props ?? {}), url: null } });
        }}
      />
      <ImageSourceTabs
        tabs={[
          {
            key: 'gallery',
            label: t('inputs.tabs.gallery'),
            visible: unsplashEnabled,
            render: () => <UnsplashImagePicker blockId={blockId} source="image" />,
          },
          {
            key: 'yourGallery',
            label: t('inputs.tabs.yourGallery'),
            visible: Boolean(customImageProvider),
            render: () => <Box>{customImageProvider}</Box>,
          },
          {
            key: 'upload',
            label: t('inputs.tabs.upload'),
            visible: showUploadTab,
            render: renderUploadTab,
          },
        ]}
        defaultTab="upload"
      />
    </Stack>
  );
};

export default ImageInput;
