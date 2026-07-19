import React, { useState } from 'react';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';
import RawSliderInput from './raw/RawSliderInput';

type SliderInputProps = {
  label: string;
  iconLabel: React.ReactElement;

  step?: number;
  marks?: boolean;
  units: string;
  min?: number;
  max?: number;

  defaultValue: number;
  onChange: (v: number) => void;
};

export default function SliderInput({ label, defaultValue, onChange, ...props }: SliderInputProps) {
  const [value, setValue] = useState(defaultValue ?? 0);
  if (defaultValue != value) {
    setValue(defaultValue);
  }

  return (
    <FieldContainer>
      <LabelProperty label={label} />
      <RawSliderInput
        value={value ?? 0}
        setValue={(value: number) => {
          setValue(value);
          onChange(value);
        }}
        {...props}
      />
    </FieldContainer>
  );
}
