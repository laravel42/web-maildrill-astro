import React from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { CameraAltOutlined, Close } from '@mui/icons-material';
import { Box, IconButton, Link } from '@mui/material';

import { useUnsplashCredit } from '../../../../../../../documents/editor/unsplashCreditsStore';

interface SourceImagePreviewProps {
  /** The currently committed image URL. Component renders nothing when empty. */
  imageUrl: string | null | undefined;
  /** Alt text for the preview <img>. Defaults to ''. */
  alt?: string;
  /**
   * Block id used to look up the Unsplash credit (if any) from the
   * `unsplashCreditsStore`. When the block has a credit, the dark
   * "Photo by …" band is rendered below the image. Without credit, the
   * preview is just the image (and optional remove button).
   */
  blockId?: string | null;
  /**
   * Callback fired when the user clicks the floating "X" button. When
   * undefined, the button is not rendered. Hosts use this to clear the
   * URL on the document side (Image block: `props.url = null`,
   * Background picker: `style.background = null`).
   */
  onRemove?: () => void;
}

/**
 * Unified picker preview shared by `ImageInput`, `BackgroundImageInput` and
 * `UnsplashImagePicker`. Visual format mirrors the original Unsplash
 * preview (rounded box + cover image + optional dark credit band) so all
 * sources end up looking the same in the inspector.
 */
const SourceImagePreview: React.FC<SourceImagePreviewProps> = ({ imageUrl, alt = '', blockId, onRemove }) => {
  const { t } = useTranslation('inspector');
  const credit = useUnsplashCredit(blockId ?? null);

  if (!imageUrl) return null;

  return (
    <Box
      sx={{
        position: 'relative',
        mb: 1.5,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <img src={imageUrl} alt={alt} style={{ width: '100%', display: 'block', maxHeight: 140, objectFit: 'cover' }} />

      {onRemove && (
        <IconButton
          aria-label={t('inputs.common.close')}
          onClick={onRemove}
          size="small"
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            backgroundColor: 'background.paper',
            color: 'error.main',
            width: 28,
            height: 28,
            '&:hover': { backgroundColor: 'error.50' },
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      )}

      {credit && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.5,
            bgcolor: '#1a1a1a',
            color: '#ccc',
            fontSize: '0.65rem',
          }}
        >
          <CameraAltOutlined sx={{ fontSize: '0.8rem', flexShrink: 0, color: '#ccc' }} />
          <Trans
            t={t}
            i18nKey="inputs.unsplash.creditLine"
            values={{ author: credit.photographerName }}
            components={{
              authorLink: (
                <Link
                  href={credit.photographerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  underline="hover"
                  sx={{
                    color: '#fff',
                    fontSize: 'inherit',
                    fontWeight: 500,
                    '&:hover': { textShadow: '0 0 6px rgba(255,255,255,0.6)' },
                  }}
                />
              ),
              unsplashLink: (
                <Link
                  href={credit.unsplashUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  underline="hover"
                  sx={{
                    color: '#fff',
                    fontSize: 'inherit',
                    fontWeight: 500,
                    '&:hover': { textShadow: '0 0 6px rgba(255,255,255,0.6)' },
                  }}
                />
              ),
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default SourceImagePreview;
