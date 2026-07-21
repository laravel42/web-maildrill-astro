import React from 'react';
import { useTranslation } from 'react-i18next';

import { Lock, LockOpen } from '@mui/icons-material';
import { Box, Button, Stack, SxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';

type Props = {
  paletteColors: string[];
  nullable?: boolean;
  isLocked?: boolean;
  onToggleLock?: () => void;
  onChange: (value: string | null) => void;
  /** Current color (optional; reserved for parity with picker callers) */
  value?: string;
};

const TILE_BUTTON: SxProps = {
  width: 24,
  height: 24,
};

export default function Swatch({ paletteColors, isLocked, onToggleLock, onChange }: Props) {
  const theme = useTheme();
  const { t } = useTranslation('inspector');

  const dynamicColors = paletteColors.slice(30);

  return (
    <Stack spacing={1}>
      <div
        style={{
          height: 1,
          width: '100%',
          margin: '8px 0',
          backgroundColor: theme.palette.grey['400'],
        }}
      ></div>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
        {dynamicColors.map((color, idx) => (
          <Button
            sx={{
              ...TILE_BUTTON,
              backgroundColor: color,
              border: '1px solid',
              margin: '0!important',
              borderColor: theme.palette.grey['50'],
              minWidth: 24,
              display: 'inline-flex',
              '&:hover': {
                backgroundColor: color,
                borderColor: 'grey.500',
              },
            }}
            onClick={() => onChange && onChange(color)}
            key={idx + 29}
          ></Button>
        ))}

        {onToggleLock && (
          <Button
            onClick={onToggleLock}
            sx={{
              backgroundColor: 'transparent',
              border: '1px solid',
              ...TILE_BUTTON,
              minWidth: 24,
              // Same fix as the Picker's reset/eyedropper buttons: MuiButton's
              // default 6px/8px padding barely leaves room for the icon in a
              // fixed 24px box.
              padding: '2px',
              margin: '0!important',
              borderColor: isLocked ? theme.palette.error.main : theme.palette.divider,
              display: 'inline-flex',
              color: isLocked ? theme.palette.error.main : theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: isLocked ? theme.palette.error.light + '20' : 'action.hover',
                borderColor: isLocked ? theme.palette.error.main : theme.palette.text.secondary,
              },
            }}
            title={isLocked ? t('lockValues.unlockTooltip') : t('lockValues.lockTooltip')}
          >
            {isLocked ? <Lock fontSize={'small'} /> : <LockOpen fontSize={'small'} />}
          </Button>
        )}
      </Box>
    </Stack>
  );
}
