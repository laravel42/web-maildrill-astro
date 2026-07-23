import React from 'react';
import { useTranslation } from 'react-i18next';

import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import LaunchOutlined from '@mui/icons-material/LaunchOutlined';
import PhoneOutlined from '@mui/icons-material/PhoneOutlined';
import ReplyOutlined from '@mui/icons-material/ReplyOutlined';
import UnfoldMoreOutlined from '@mui/icons-material/UnfoldMoreOutlined';
import { Box, Typography } from '@mui/material';

import type { ButtonsProps, WaButton } from '../documents/schemas';

/**
 * WhatsApp renders template buttons as divider-separated rows attached
 * to the bubble bottom, in the accent blue; with more than three, the
 * client collapses the overflow behind "See all options". Mirrored here
 * for a faithful preview.
 */

const VISIBLE_BUTTONS = 3;

function buttonIcon(type: WaButton['type']) {
  const sx = { fontSize: 16 } as const;
  switch (type) {
    case 'URL':
      return <LaunchOutlined sx={sx} />;
    case 'PHONE_NUMBER':
      return <PhoneOutlined sx={sx} />;
    case 'COPY_CODE':
      return <ContentCopyOutlined sx={sx} />;
    case 'QUICK_REPLY':
      return <ReplyOutlined sx={sx} />;
  }
}

function ButtonRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.75,
        py: 1,
        borderTop: '1px solid var(--wa-divider)',
        color: 'var(--wa-action)',
      }}
    >
      {icon}
      <Typography sx={{ fontSize: 13.5, fontWeight: 500, color: 'inherit' }}>{label}</Typography>
    </Box>
  );
}

export default function ButtonsBlock({ props }: ButtonsProps & { blockId?: string; isNotClient?: boolean }) {
  const { t } = useTranslation('waInspector');
  const buttons = props?.buttons ?? [];

  if (buttons.length === 0) {
    return (
      <Typography sx={{ px: 0.75, py: 0.75, fontSize: 12.5, color: 'var(--wa-muted)', fontStyle: 'italic' }}>
        {t('canvas.buttonsPlaceholder')}
      </Typography>
    );
  }

  const visible = buttons.length > VISIBLE_BUTTONS ? buttons.slice(0, VISIBLE_BUTTONS - 1) : buttons;
  const overflow = buttons.length - visible.length;

  return (
    <Box sx={{ mt: 0.5 }}>
      {visible.map((b, i) => (
        <ButtonRow
          key={i}
          icon={buttonIcon(b.type)}
          label={
            b.type === 'COPY_CODE'
              ? t('canvas.copyCodeLabel')
              : b.text || t('canvas.untitledButton')
          }
        />
      ))}
      {overflow > 0 && <ButtonRow icon={<UnfoldMoreOutlined sx={{ fontSize: 16 }} />} label={t('canvas.seeAllOptions')} />}
    </Box>
  );
}
