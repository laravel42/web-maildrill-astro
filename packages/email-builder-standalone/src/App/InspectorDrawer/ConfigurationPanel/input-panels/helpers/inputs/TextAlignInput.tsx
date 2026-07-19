import React, { useEffect, useState } from 'react';

import { FormatAlignCenterOutlined, FormatAlignLeftOutlined, FormatAlignRightOutlined } from '@mui/icons-material';
import { ToggleButton } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';
import RadioGroupInput from './RadioGroupInput';

type Props = {
  label: string;
  labelAction?: React.ReactNode;
  defaultValue: string | null;
  onChange: (value: string | null) => void;
};
export default function TextAlignInput({ label, labelAction, defaultValue, onChange }: Props) {
  const [value, setValue] = useState(defaultValue ?? 'left');
  useEffect(() => {
    if (defaultValue !== value) {
      setValue(defaultValue ?? 'left');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);
  return (
    <FieldContainer>
      <LabelProperty label={label} action={labelAction} />
      <RadioGroupInput
        label={''}
        defaultValue={value}
        onChange={(value) => {
          setValue(value);
          onChange(value);
        }}
      >
        <ToggleButton value="left">
          <FormatAlignLeftOutlined fontSize="small" />
        </ToggleButton>
        <ToggleButton value="center">
          <FormatAlignCenterOutlined fontSize="small" />
        </ToggleButton>
        <ToggleButton value="right">
          <FormatAlignRightOutlined fontSize="small" />
        </ToggleButton>
      </RadioGroupInput>
    </FieldContainer>
  );
}
