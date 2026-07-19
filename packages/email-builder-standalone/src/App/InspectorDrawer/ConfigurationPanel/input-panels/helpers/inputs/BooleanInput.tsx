import React, { useState } from 'react';

import { Box, FormControlLabel, Switch } from '@mui/material';

import { INPUT_CONTAINER_SX } from './components/inputStyles';

type Props = {
  label: string;
  defaultValue: boolean;
  onChange: (value: boolean) => void;
};

export default function BooleanInput({ label, defaultValue, onChange }: Props) {
  const [value, setValue] = useState(defaultValue);
  return (
    <Box sx={INPUT_CONTAINER_SX}>
      <FormControlLabel
        sx={{ m: 0, width: '100%', display: 'flex', justifyContent: 'space-between' }}
        label={label}
        control={
          <Switch
            checked={value}
            onChange={(_, checked: boolean) => {
              setValue(checked);
              onChange(checked);
            }}
          />
        }
      />
    </Box>
  );
}
