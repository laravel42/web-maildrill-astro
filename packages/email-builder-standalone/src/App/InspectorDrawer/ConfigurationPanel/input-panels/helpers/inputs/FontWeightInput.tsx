import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatBold, TextFields } from '@mui/icons-material';
import { Box, ToggleButton } from '@mui/material';

import RadioGroupInput from './RadioGroupInput';

type Props = {
  label: string;
  labelAction?: React.ReactNode;
  defaultValue: string;
  onChange: (value: string) => void;
};
export default function FontWeightInput({ label, labelAction, defaultValue, onChange }: Props) {
  const { t } = useTranslation('inspector');
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    if (value !== defaultValue) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);
  return (
    <RadioGroupInput
      label={label}
      labelAction={labelAction}
      defaultValue={value}
      onChange={(fontWeight) => {
        setValue(fontWeight);
        onChange(fontWeight);
      }}
    >
      <ToggleButton value="normal">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <TextFields fontSize="small" />
          <span>{t('inputs.fontWeightToggle.regular')}</span>
        </Box>
      </ToggleButton>
      <ToggleButton value="bold">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <FormatBold fontSize="small" />
          <span>{t('inputs.fontWeightToggle.bold')}</span>
        </Box>
      </ToggleButton>
    </RadioGroupInput>
  );
}
