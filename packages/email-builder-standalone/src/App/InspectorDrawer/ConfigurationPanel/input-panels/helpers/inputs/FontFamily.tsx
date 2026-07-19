import React, { useEffect, useState } from 'react';

import { MenuItem } from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';

import { FONT_FAMILIES } from '../../../../../../documents/blocks/helpers/fontFamily';

import FieldContainer from './components/FieldContainer';
import Select from './components/Select';
import LabelProperty from './LabelProperty';

const OPTIONS = FONT_FAMILIES.map((option) => (
  <MenuItem key={option.key} value={option.key} sx={{ fontFamily: option.value }}>
    {option.label}
  </MenuItem>
));

type NullableProps = {
  label: string;
  labelAction?: React.ReactNode;
  onChange: (value: null | string) => void;
  defaultValue: null | string;
};

export function NullableFontFamily({ label, labelAction, onChange, defaultValue }: NullableProps) {
  const inherit = 'INHERIT';
  const [value, setValue] = useState(defaultValue ?? inherit);

  useEffect(() => {
    if (value !== defaultValue) {
      setValue(defaultValue ?? inherit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);

  const onValueChange = (event: SelectChangeEvent) => {
    const v = event.target.value;
    setValue(v);
    onChange(v === null ? null : v);
  };

  const selectedFont = FONT_FAMILIES.find((f) => f.key === value)?.value;

  return (
    <FieldContainer>
      <LabelProperty label={label} action={labelAction} />
      <Select style={{ width: '100%', fontFamily: selectedFont }} value={value} size="small" onChange={onValueChange}>
        {OPTIONS}
      </Select>
    </FieldContainer>
  );
}
