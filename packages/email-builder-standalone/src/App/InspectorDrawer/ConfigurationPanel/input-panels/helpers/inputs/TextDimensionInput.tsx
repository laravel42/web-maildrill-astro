import React from 'react';

import { TextField, Typography } from '@mui/material';

import { MAX_WIDTH_DESKTOP } from '../../../../../../constants';

import { INPUT_TEXTFIELD_SX } from './components/inputStyles';

type TextDimensionInputProps = {
  label: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  max?: number;
  width?: boolean;
};

export default function TextDimensionInput({
  label,
  value,
  onChange,
  max = MAX_WIDTH_DESKTOP,
  width = false,
}: TextDimensionInputProps) {
  const validateValue = (valueValidate: number): number => {
    const validMax = max ?? MAX_WIDTH_DESKTOP;

    if (valueValidate < 0) return 0;

    if (width && valueValidate > validMax) {
      return validMax;
    }

    return valueValidate;
  };

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (ev) => {
    const value = parseInt(ev.target.value);
    if (isNaN(value)) {
      onChange(null);
    } else {
      const validatedValue = validateValue(value);
      onChange(validatedValue);

      if (value !== validatedValue) {
        ev.target.value = validatedValue.toString();
      }
    }
  };

  // Ensure value is never undefined or null
  const inputValue = value !== null && value !== undefined ? value : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>{label}</p>
      <TextField
        fullWidth
        onChange={handleChange}
        value={inputValue}
        variant="outlined"
        placeholder="auto"
        size="small"
        sx={INPUT_TEXTFIELD_SX}
        slotProps={{
          input: {
            endAdornment: (
              <Typography variant="body2" color="text.secondary">
                px
              </Typography>
            ),
          },
        }}
      />
    </div>
  );
}
