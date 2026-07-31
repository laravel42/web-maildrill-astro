import React, { useCallback, useEffect, useState } from 'react';
import { HexColorInput, HexColorPicker } from 'react-colorful';

import { FormatColorReset } from '@mui/icons-material';
import { Box, Button, Stack, SxProps } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { RADIUS_INPUT } from '../../../../../../../constants';
import {
  setColorPickerState,
  useColorPickerState,
} from '../../../../../../../documents/editor/EditorContext';

import EyeDropperButton from './EyeDropperButton';
import Swatch from './Swatch';

const SX: SxProps = {
  p: 1,
  '.react-colorful__pointer ': {
    width: 16,
    height: 16,
  },
  '.react-colorful__saturation': {
    mb: 1,
    borderRadius: '8px',
  },
  '.react-colorful__last-control': {
    borderRadius: '8px',
  },
  '.react-colorful__hue-pointer': {
    width: '4px',
    borderRadius: '8px',
    height: 24,
    cursor: 'col-resize',
  },
  '.react-colorful__saturation-pointer': {
    cursor: 'all-scroll',
  },
  input: {
    padding: 1,
    border: '1px solid',
    borderColor: 'grey.300',
    borderRadius: `${RADIUS_INPUT}px`,
    width: '100%',
  },
};

type Props = {
  value: string;
  nullable?: boolean;
  onChange: (v: string | null) => void;
  showHexColor?: boolean;
};

export const updateRecentColors = (newColor: string, currentColors: string[]) => {
  const sizeArrayRecents = 5;

  if (!newColor || newColor.trim() === '') {
    return currentColors;
  }

  const recentColors = currentColors.slice(-sizeArrayRecents);
  const staticColors = currentColors.slice(0, 30);

  const filteredRecents = recentColors.filter((color) => color !== newColor && color !== '');

  const updatedRecents = [newColor, ...filteredRecents].slice(0, sizeArrayRecents);

  while (updatedRecents.length < sizeArrayRecents) {
    updatedRecents.push('');
  }

  return [...staticColors, ...updatedRecents];
};

export default function Picker({ value, nullable, onChange }: Props) {
  const [tempColor, setTempColor] = useState(value || '#000000');
  const [debounceTimer, setDebounceTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { paletteColors, isLocked } = useColorPickerState();
  const [colorChange, setColorChange] = useState(false);
  const theme = useTheme();

  const updatePaletteWithDebounce = useCallback(
    (newColor: string) => {
      if (isLocked) return;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      const newTimer = setTimeout(() => {
        const updatedColors = updateRecentColors(newColor, paletteColors);
        setColorPickerState({ paletteColors: updatedColors });
      }, 300);

      setDebounceTimer(newTimer);
    },
    [debounceTimer, isLocked, paletteColors],
  );

  const toggleLock = () => {
    const newLockState = !isLocked;
    setColorPickerState({ isLocked: newLockState });

    if (!newLockState && tempColor) {
      const updatedColors = updateRecentColors(tempColor, paletteColors);
      setColorPickerState({
        isLocked: newLockState,
        paletteColors: updatedColors,
      });
    }
  };

  const handleTempColorChange = (newColor: string) => {
    setColorChange(true);
    setTempColor(newColor);
  };

  const handleApplyColor = () => {
    onChange(tempColor);
    updatePaletteWithDebounce(tempColor);
  };

  const handleInputChange = (newColor: string) => {
    setTempColor(newColor);
    onChange(newColor);
    updatePaletteWithDebounce(newColor);
  };

  useEffect(() => {
    if (value !== tempColor) {
      setTempColor(value || '#000000');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs prop value into tempColor one-way; tempColor is local draft state
  }, [value]);

  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    };
  }, [debounceTimer]);

  return (
    <Stack spacing={1} sx={SX}>
      <HexColorPicker
        color={tempColor}
        onChange={handleTempColorChange}
        onMouseUp={handleApplyColor}
        onTouchEnd={handleApplyColor}
        onMouseLeave={() => {
          if (colorChange) {
            handleApplyColor();
            setColorChange(false);
          }
        }}
      />

      <Swatch
        isLocked={isLocked}
        onToggleLock={toggleLock}
        paletteColors={paletteColors}
        value={value}
        nullable={nullable}
        onChange={(color) => {
          if (color) {
            setTempColor(color);
            onChange(color);
            updatePaletteWithDebounce(color);
          } else {
            onChange(null);
          }
        }}
      />

      <Box sx={{ pt: 1, display: 'flex', gap: 1, alignItems: 'center' }}>
        <HexColorInput
          prefixed
          color={tempColor}
          onChange={handleInputChange}
          style={{
            flex: 1,
            backgroundColor: theme.palette.background.paper,
            color: theme.palette.text.primary,
            padding: '1px 4px',
            fontSize: '12px',
          }}
        />
        <EyeDropperButton onColorPicked={handleInputChange} />
        {nullable && (
          <Button
            onClick={() => onChange && onChange(null)}
            sx={{
              backgroundColor: 'transparent',
              width: 24,
              height: 24,
              minWidth: 24,
              // MuiButton's default padding (6px 8px, from theme.ts) barely
              // leaves room for the icon inside a fixed 24px box, squeezing
              // it against the edge. 1-2px keeps the icon visible without
              // crowding the border.
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
            <FormatColorReset color={'primary'} fontSize={'small'} />
          </Button>
        )}
      </Box>
    </Stack>
  );
}
