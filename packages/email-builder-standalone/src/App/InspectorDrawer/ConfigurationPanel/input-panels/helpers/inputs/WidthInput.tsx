import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { HeightOutlined } from '@mui/icons-material';

import RawSliderInput from './raw/RawSliderInput';

type WidthInputProps = {
  label?: string;
  defaultValue?: number;
  onChange: (v: number) => void;
  step?: number;
};
const WidthInput: FC<WidthInputProps> = ({ label, defaultValue, onChange, step, ...props }) => {
  const { t } = useTranslation('inspector');
  const resolvedLabel = label ?? t('inputs.common.width');

  return (
    <RawSliderInput
      label={resolvedLabel}
      iconLabel={<HeightOutlined sx={{ color: 'text.primary', transform: 'rotate(90deg)' }} />}
      units="%"
      step={step}
      min={1}
      max={100}
      marks={false}
      value={defaultValue ?? 1}
      setValue={onChange}
      {...props}
    />
  );
};

export default WidthInput;
