import React, { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { Colorize } from '@mui/icons-material';
import { Button, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { useEyeDropper } from './useEyeDropper';

type Props = {
  onColorPicked: (hex: string) => void;
};

export default function EyeDropperButton({ onColorPicked }: Props) {
  const { supported, pick } = useEyeDropper();
  const { t } = useTranslation('inspector');
  const theme = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = useCallback(async () => {
    if (supported) {
      const hex = await pick();
      if (hex) onColorPicked(hex);
    } else {
      // Fallback: open native system color picker via hidden input
      inputRef.current?.click();
    }
  }, [supported, pick, onColorPicked]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onColorPicked(e.target.value);
    },
    [onColorPicked],
  );

  return (
    <>
      <Tooltip title={t('inputs.color.eyedropper.tooltip')}>
        <Button
          onClick={handleClick}
          sx={{
            backgroundColor: 'transparent',
            width: 24,
            height: 24,
            minWidth: 24,
            // Same fix as Picker.tsx's reset button: MuiButton's default
            // 6px/8px padding leaves almost no room for the icon in a
            // fixed 24px box. 1-2px keeps it visible without crowding
            // the border.
            padding: '2px',
            margin: '0!important',
            borderColor: theme.palette.divider,
            display: 'inline-flex',
            '&:hover': {
              backgroundColor: 'action.hover',
              borderColor: theme.palette.text.secondary,
            },
          }}
        >
          <Colorize color="primary" fontSize="small" />
        </Button>
      </Tooltip>
      <input
        ref={inputRef}
        type="color"
        onChange={handleInputChange}
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
      />
    </>
  );
}
