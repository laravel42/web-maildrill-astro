import React, { useEffect, useState } from 'react';

import { Box, IconButton, Slider, Stack, Typography } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';

import FieldContainer from '../components/FieldContainer';
import LabelProperty from '../LabelProperty';

const CustomNumberInput = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '8px',
  padding: '4px',
  minWidth: 58,
  maxWidth: 'fit-content',
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.primary.main,
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 1px ${theme.palette.primary.main}`,
  },
}));

const NumberDisplay = styled('input')(({ theme }) => ({
  border: 'none',
  outline: 'none',
  background: 'transparent',
  textAlign: 'center',
  width: '27px',
  minWidth: '27px',
  maxWidth: '27px',
  padding: '0!important',
  lineHeight: 'normal',
  fontSize: '0.9rem',
  color: theme.palette.text.primary,
  '&::-webkit-outer-spin-button, &::-webkit-inner-spin-button': {
    WebkitAppearance: 'none',
    margin: 0,
  },
  '&[type=number]': {
    MozAppearance: 'textfield',
  },
}));

const ArrowButton = styled(IconButton)(({ theme }) => ({
  padding: '0',
  color: theme.palette.primary.main,

  '&:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.04),
  },
  '& .MuiSvgIcon-root': {
    fontSize: 14,
  },
}));

export type SliderInputProps = {
  iconLabel: React.ReactNode;
  label?: string;
  step?: number;
  marks?: boolean;
  units: string;
  min?: number;
  max?: number;
  value: number | null; // 🔹 aceptar null
  setValue: (v: number) => void;
};

export default function RawSliderInput({
  iconLabel,
  label,
  value,
  setValue,
  units,
  min = 0,
  max,
  step = undefined,
  marks = true,
  ...props
}: SliderInputProps) {
  // 🔹 Usar 0 si value es null
  const safeValue = value ?? min;

  const [inputValue, setInputValue] = useState(safeValue.toString());

  const validateAndSetValue = (newValue: number) => {
    let validatedValue = newValue;

    if (validatedValue < min) validatedValue = min;
    if (max !== undefined && validatedValue > max) validatedValue = max;

    setValue(validatedValue);
    setInputValue(validatedValue.toString());
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newInputValue = event.target.value;
    setInputValue(newInputValue);

    if (newInputValue !== '') {
      const numericValue = Number(newInputValue);
      if (!isNaN(numericValue)) {
        if (numericValue >= min) {
          setValue(numericValue);
        }
      }
    }
  };

  const handleInputBlur = () => {
    if (inputValue === '' || isNaN(Number(inputValue))) {
      // 🔹 Restaurar al valor seguro
      setInputValue(safeValue.toString());
    } else {
      const numericValue = Number(inputValue);
      validateAndSetValue(numericValue);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleInputBlur();
    }
  };

  useEffect(() => {
    setInputValue((value ?? min).toString());
  }, [value, min]);

  const handleIncrement = () => {
    const newValue = safeValue + 1;
    validateAndSetValue(newValue);
  };

  const handleDecrement = () => {
    const newValue = safeValue - 1;
    validateAndSetValue(newValue);
  };

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    if (typeof newValue !== 'number') return;
    setValue(newValue);
  };

  return (
    <FieldContainer>
      <LabelProperty label={label} />
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <Box sx={{ minWidth: 24, lineHeight: 1, flexShrink: 0 }}>{iconLabel}</Box>

        <Slider
          {...props}
          value={safeValue}
          min={min}
          max={max || 1000}
          step={step}
          color="primary"
          marks={marks}
          onChange={handleSliderChange}
        />

        <CustomNumberInput>
          <NumberDisplay
            type="number"
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', ml: 0.5 }}>
            <ArrowButton onClick={handleIncrement} disabled={max !== undefined && safeValue >= max}>
              <svg width="15" height="10" viewBox="0 0 24 12">
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="m6 9l6-6l6 6"
                />
              </svg>
            </ArrowButton>
            <ArrowButton onClick={handleDecrement} disabled={safeValue <= min}>
              <svg width="15" height="10" viewBox="0 0 24 12" style={{ transform: 'rotate(180deg)' }}>
                <path
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  d="m6 9l6-6l6 6"
                />
              </svg>
            </ArrowButton>
          </Box>
        </CustomNumberInput>

        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '16px', ml: '4px!important' }}>
          {units}
        </Typography>
      </Stack>
    </FieldContainer>
  );
}
