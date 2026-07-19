import React, { useEffect, useState } from 'react';

import { TextFieldsOutlined } from '@mui/icons-material';
import { Box } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';
import RawSliderInput from './raw/RawSliderInput';

type Props = {
  label: string;
  labelAction?: React.ReactNode;
  defaultValue?: number;
  maxValue?: number;
  minValue?: number;
  onChange: (v: number) => void;
  step?: number;
  /**
   * Phase 2c — signals that the value comes from the document theme
   * (`'theme'`) or the block schema default (`'default'`). The input
   * applies a muted visual treatment so the inheritance is obvious;
   * editing always promotes the value to explicit on the block.
   */
  inheritedFrom?: 'theme' | 'default';
};
export default function FontSizeInput({
  label,
  labelAction,
  defaultValue = 16,
  onChange,
  maxValue,
  minValue,
  step,
  inheritedFrom,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (value !== defaultValue) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);

  const handleChange = (value: number) => {
    setValue(value);
    onChange(value);
  };
  return (
    <FieldContainer>
      <LabelProperty label={label} action={labelAction} />
      <Box sx={{ opacity: inheritedFrom ? 0.55 : 1, transition: 'opacity 120ms ease-out' }}>
        <RawSliderInput
          iconLabel={<TextFieldsOutlined sx={{ fontSize: 16, color: 'text.primary' }} />}
          value={value}
          setValue={handleChange}
          units="px"
          step={step ?? 2}
          min={minValue || 8}
          max={maxValue || 48}
        />
      </Box>
    </FieldContainer>
  );
}
