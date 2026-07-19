import React, { useEffect, useState } from 'react';

import { Box, ToggleButtonGroup } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import { INPUT_CONTAINER_SX } from './components/inputStyles';
import LabelProperty from './LabelProperty';

type Props = {
  label: React.ReactNode;
  labelAction?: React.ReactNode;
  children: React.ReactElement | React.ReactElement[];
  defaultValue: string;
  onChange: (v: string) => void;
};
export default function RadioGroupInput({ label, labelAction, children, defaultValue, onChange }: Props) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    if (defaultValue !== value) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);
  return (
    <FieldContainer>
      <LabelProperty label={label} action={labelAction} />
      <Box sx={{ ...INPUT_CONTAINER_SX, paddingLeft: '0px', paddingRight: '0px' }}>
        <ToggleButtonGroup
          exclusive
          fullWidth
          value={value}
          size="small"
          sx={{ width: '100%' }}
          onChange={(_, v: unknown) => {
            if (typeof v !== 'string') {
              throw new Error('RadioGroupInput can only receive string values');
            }
            setValue(v);
            onChange(v);
          }}
        >
          {children}
        </ToggleButtonGroup>
      </Box>
    </FieldContainer>
  );
}
