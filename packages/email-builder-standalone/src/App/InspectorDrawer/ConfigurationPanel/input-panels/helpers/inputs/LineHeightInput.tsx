import React, { useEffect, useState } from 'react';

import { MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import FieldContainer from './components/FieldContainer';
import Select from './components/Select';
import LabelProperty from './LabelProperty';

const LINE_HEIGHT_OPTIONS = [
  { key: '1', value: '1', label: 'Simple (1.0)' },
  { key: '1.15', value: '1.15', label: 'Compact (1.15)' },
  { key: '1.5', value: '1.5', label: 'Normal (1.5)' },
  { key: '2', value: '2', label: 'Relaxed (2.0)' },
  { key: '2.5', value: '2.5', label: 'Wide (2.5)' },
  { key: '3', value: '3', label: 'Loose (3.0)' },
  { key: '4', value: '4', label: 'Very Loose (4.0)' },
];

const OPTIONS = LINE_HEIGHT_OPTIONS.map((option) => (
  <MenuItem key={option.key} value={option.key}>
    {option.label}
  </MenuItem>
));

type NullableProps = {
  label: string;
  onChange: (value: null | number) => void;
  defaultValue: null | number;
};

export function LineHeightInput({ label, onChange, defaultValue }: NullableProps) {
  const inherit = 'INHERIT';
  const [value, setValue] = useState(defaultValue?.toString() ?? inherit);

  useEffect(() => {
    if (value !== defaultValue?.toString()) {
      setValue(defaultValue?.toString() ?? inherit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);

  const onValueChange = (event: SelectChangeEvent) => {
    const v = event.target.value;
    setValue(v);
    onChange(v === inherit ? null : parseFloat(v));
  };

  return (
    <FieldContainer>
      <LabelProperty label={label} />
      <Select style={{ width: '100%' }} value={value} size="small" onChange={onValueChange}>
        <MenuItem value={inherit}>Default value</MenuItem>
        {OPTIONS}
      </Select>
    </FieldContainer>
  );
}

export default LineHeightInput;
