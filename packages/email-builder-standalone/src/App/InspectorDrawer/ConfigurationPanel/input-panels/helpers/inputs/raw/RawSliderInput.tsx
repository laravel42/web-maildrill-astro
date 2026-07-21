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
      {/* spacing 1.5: enough gap between icon, slider and value so they
          don't feel cramped, while the slider keeps flex:1 to absorb the
          panel's width squeeze. */}
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', minWidth: 0 }}>
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
        <NumberDisplay>{safeValue}</NumberDisplay>

        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '12px', flexShrink: 0 }}>
          {units}
        </Typography>
      </Stack>
    </FieldContainer>
  );
}
