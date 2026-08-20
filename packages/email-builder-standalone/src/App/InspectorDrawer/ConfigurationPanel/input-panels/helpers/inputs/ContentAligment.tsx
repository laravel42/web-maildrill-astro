import React from 'react';
import { useTranslation } from 'react-i18next';

import {
  VerticalAlignBottomOutlined,
  VerticalAlignCenterOutlined,
  VerticalAlignTopOutlined,
} from '@mui/icons-material';
import { ToggleButton } from '@mui/material';

import { useSelectedScreenSize } from '../../../../../../documents/editor/EditorContext';

import RadioGroupInput from './RadioGroupInput';

type Props = {
  data: any; // Puedes tipar mejor si quieres
  updateData: (d: any) => void;
};

const ALIGN_PROP: Record<string, 'contentAlignment' | 'contentAlignmentMobile'> = {
  desktop: 'contentAlignment',
  mobile: 'contentAlignmentMobile',
};

export default function ContentAlignment({ data, updateData }: Props) {
  const { t } = useTranslation('inspector');
  const selectedScreen = useSelectedScreenSize();
  const alignProp = ALIGN_PROP[selectedScreen] || 'contentAlignment';

  const currentValue = data.props?.[alignProp] ?? data.props?.['contentAlignment'];

  const handleChange = (alignment: string) => {
    updateData({
      ...data,
      props: {
        ...data.props,
        [alignProp]: alignment,
      },
    });
  };

  return (
    <RadioGroupInput
      label={t('inputs.alignment.label')}
      defaultValue={currentValue}
      onChange={handleChange}
    >
      <ToggleButton value="top">
        <VerticalAlignTopOutlined fontSize="small" />
      </ToggleButton>
      <ToggleButton value="middle">
        <VerticalAlignCenterOutlined fontSize="small" />
      </ToggleButton>
      <ToggleButton value="bottom">
        <VerticalAlignBottomOutlined fontSize="small" />
      </ToggleButton>
    </RadioGroupInput>
  );
}
