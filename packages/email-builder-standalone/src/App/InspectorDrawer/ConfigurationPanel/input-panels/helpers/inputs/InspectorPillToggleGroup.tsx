import React from 'react';

import { Box, ToggleButton, ToggleButtonGroup } from '@mui/material';

export type PillToggleOption = {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: PillToggleOption[];
};

export default function InspectorPillToggleGroup({ value, onChange, options }: Props) {
  return (
    <ToggleButtonGroup
      exclusive
      value={value}
      size="small"
      onChange={(_, v) => {
        if (typeof v === 'string') {
          onChange(v);
        }
      }}
      sx={{
        display: 'flex',
        width: '100%',
      }}
    >
      {options.map((opt) => (
        <ToggleButton key={opt.value} value={opt.value}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            {opt.icon}
            <span>{opt.label}</span>
          </Box>
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
