import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';

import { HeightOutlined } from '@mui/icons-material';

import RawSliderInput from './raw/RawSliderInput';

type HeightInputProps = {
  label?: string;
  defaultValue?: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
};
const HeightInput: FC<HeightInputProps> = ({
  label,
  defaultValue,
  onChange,
  min = 1,
  max = 100,
  step = 1,
}) => {
  const { t } = useTranslation('inspector');
  const resolvedLabel = label ?? t('inputs.common.height');

  return (
    <RawSliderInput
      label={resolvedLabel}
      iconLabel={<HeightOutlined sx={{ color: 'text.secondary' }} />}
      units="px"
      step={step}
      min={min}
      max={max}
      marks={false}
      value={defaultValue ?? min}
      setValue={onChange}
    />
  );
};

export default HeightInput;
