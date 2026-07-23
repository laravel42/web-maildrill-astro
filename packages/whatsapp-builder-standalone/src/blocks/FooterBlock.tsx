import React from 'react';
import { useTranslation } from 'react-i18next';

import { Typography } from '@mui/material';

import type { FooterProps } from '../documents/schemas';

export default function FooterBlock({ props }: FooterProps & { blockId?: string; isNotClient?: boolean }) {
  const { t } = useTranslation('waInspector');
  const text = props?.text ?? '';

  return (
    <Typography sx={{ px: 0.75, pt: 0.25, fontSize: 12.5, color: 'var(--wa-muted)' }}>
      {text || <span style={{ opacity: 0.6 }}>{t('canvas.footerPlaceholder')}</span>}
    </Typography>
  );
}
