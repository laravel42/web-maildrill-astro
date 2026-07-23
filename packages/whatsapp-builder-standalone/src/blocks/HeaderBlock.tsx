import React from 'react';
import { useTranslation } from 'react-i18next';

import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import PlaceOutlined from '@mui/icons-material/PlaceOutlined';
import PlayCircleOutlined from '@mui/icons-material/PlayCircleOutlined';
import { Box, Typography } from '@mui/material';

import type { HeaderProps } from '../documents/schemas';
import { renderWaMarkdown } from './renderWaMarkdown';

/** Media placeholder shown when a media header has no sample URL yet. */
function MediaPlaceholder({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      sx={{
        height: 120,
        borderRadius: '6px',
        bgcolor: 'var(--wa-media-bg)',
        color: 'var(--wa-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 12 }}>{label}</Typography>
    </Box>
  );
}

export default function HeaderBlock({ props }: HeaderProps & { blockId?: string; isNotClient?: boolean }) {
  const { t } = useTranslation('waInspector');
  const format = props?.format ?? 'text';
  const text = props?.text ?? '';
  const mediaUrl = props?.mediaUrl ?? '';

  if (format === 'text') {
    return (
      <Typography sx={{ px: 0.75, pt: 0.5, fontSize: 14.5, fontWeight: 700, color: 'var(--wa-text)' }}>
        {text ? renderWaMarkdown(text) : <span style={{ opacity: 0.45 }}>{t('canvas.headerPlaceholder')}</span>}
      </Typography>
    );
  }

  if (format === 'image') {
    return mediaUrl ? (
      <Box
        component="img"
        src={mediaUrl}
        alt=""
        sx={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: '6px', display: 'block' }}
      />
    ) : (
      <MediaPlaceholder icon={<ImageOutlined />} label={t('canvas.mediaPlaceholder.image')} />
    );
  }

  if (format === 'video') {
    return (
      <Box sx={{ position: 'relative' }}>
        <MediaPlaceholder icon={<PlayCircleOutlined sx={{ fontSize: 36 }} />} label={t('canvas.mediaPlaceholder.video')} />
      </Box>
    );
  }

  if (format === 'document') {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          borderRadius: '6px',
          bgcolor: 'var(--wa-media-bg)',
          color: 'var(--wa-text)',
        }}
      >
        <DescriptionOutlined sx={{ color: 'var(--wa-muted)' }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {mediaUrl ? mediaUrl.split('/').pop() : t('canvas.mediaPlaceholder.document')}
          </Typography>
          <Typography sx={{ fontSize: 11, color: 'var(--wa-muted)' }}>PDF</Typography>
        </Box>
      </Box>
    );
  }

  // location
  return (
    <Box sx={{ borderRadius: '6px', overflow: 'hidden' }}>
      <Box
        sx={{
          height: 90,
          bgcolor: 'var(--wa-media-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--wa-muted)',
        }}
      >
        <PlaceOutlined sx={{ fontSize: 32 }} />
      </Box>
      {(props?.locationName || props?.locationAddress) && (
        <Box sx={{ px: 0.75, py: 0.5 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: 'var(--wa-text)' }}>{props?.locationName}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'var(--wa-muted)' }}>{props?.locationAddress}</Typography>
        </Box>
      )}
    </Box>
  );
}
