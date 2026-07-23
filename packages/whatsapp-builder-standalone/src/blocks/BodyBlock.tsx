import React from 'react';
import { useTranslation } from 'react-i18next';

import { Typography } from '@mui/material';

import type { BodyProps } from '../documents/schemas';
import { renderWaMarkdown } from './renderWaMarkdown';

export default function BodyBlock({ props }: BodyProps & { blockId?: string; isNotClient?: boolean }) {
  const { t } = useTranslation('waInspector');
  const text = props?.text ?? '';

  return (
    <Typography
      component="div"
      sx={{
        px: 0.75,
        py: 0.5,
        fontSize: 14.2,
        lineHeight: 1.35,
        color: 'var(--wa-text)',
        wordBreak: 'break-word',
        '& code': {
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.92em',
        },
        '& .wa-variable': {
          display: 'inline-block',
          px: 0.5,
          borderRadius: '4px',
          bgcolor: 'var(--wa-variable-bg)',
          color: 'var(--wa-variable-fg)',
          fontSize: '0.85em',
          fontWeight: 600,
          lineHeight: 1.5,
        },
      }}
    >
      {text ? renderWaMarkdown(text) : <span style={{ opacity: 0.45 }}>{t('canvas.bodyPlaceholder')}</span>}
    </Typography>
  );
}
