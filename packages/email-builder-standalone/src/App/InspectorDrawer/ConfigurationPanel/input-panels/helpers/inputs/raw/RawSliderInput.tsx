import React from 'react';

import { Box, Slider, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import FieldContainer from '../components/FieldContainer';
import LabelProperty from '../LabelProperty';

const NumberDisplay = styled('span')(({ theme }) => ({
  textAlign: 'center',
  lineHeight: 'normal',
  fontSize: '0.9rem',
  color: theme.palette.text.primary,
  flexShrink: 0,
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

  const handleSliderChange = (_: Event, newValue: number | number[]) => {
    if (typeof newValue !== 'number') return;
    setValue(newValue);
  };

  return (
    <FieldContainer>
      <LabelProperty label={label} />
      {/* gap: 1.5 on the row (not the Stack `spacing` prop) — keeps icon,
          slider and value from feeling cramped together. */}
      <Stack direction="row" sx={{ alignItems: 'center', width: '100%', minWidth: 0, gap: 1.5 }}>
        <Box sx={{ minWidth: 24, lineHeight: 1, flexShrink: 0 }}>{iconLabel}</Box>

        <Slider
          {...props}
          sx={{ flex: 1, minWidth: 0 }}
          value={safeValue}
          min={min}
          max={max || 1000}
          step={step}
          color="primary"
          marks={marks}
          onChange={handleSliderChange}
        />

        {/* Read-only value display — editing happens only via the slider now. */}
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '12px', flexShrink: 0 }}>
          <NumberDisplay>{safeValue}</NumberDisplay>
          {units}
        </Typography>
      </Stack>
    </FieldContainer>
  );
}
