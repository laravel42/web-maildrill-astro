import React from 'react';

import { Box, Slider, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

import FieldContainer from '../components/FieldContainer';
import LabelProperty from '../LabelProperty';

const CustomNumberInput = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: '10px',
  padding: '4px 8px',
  minWidth: 40,
  maxWidth: 'fit-content',
  // Never absorb the row's overflow — the slider does that.
  flexShrink: 0,
  backgroundColor: theme.palette.background.paper,
}));

const NumberDisplay = styled('span')(({ theme }) => ({
  textAlign: 'center',
  lineHeight: 'normal',
  fontSize: '0.9rem',
  color: theme.palette.text.primary,
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
      {/* spacing 1 (not 2) and a shrinkable slider: at the panel's width the
          old layout pushed the number box into the unit label. Everything
          except the slider is flexShrink: 0 so the slider absorbs the squeeze. */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', justifyContent: 'space-between', width: '100%', minWidth: 0 }}
      >
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
        <CustomNumberInput>
          <NumberDisplay>{safeValue}</NumberDisplay>
        </CustomNumberInput>

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '12px', flexShrink: 0, ml: '4px!important' }}
        >
          {units}
        </Typography>
      </Stack>
    </FieldContainer>
  );
}
