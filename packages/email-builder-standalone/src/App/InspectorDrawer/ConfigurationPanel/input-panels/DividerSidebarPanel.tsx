import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import { DividerProps, DividerPropsSchema } from '@eb/block-divider';

import { TStyle } from '../../../../documents/blocks/helpers/TStyle';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type DividerSidebarPanelProps = {
  data: DividerProps;
  setData: (v: DividerProps) => void;
};
export default function DividerSidebarPanel({ data, setData }: DividerSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const { t } = useTranslation('inspector');
  const updateData = (d: unknown) => {
    const res = DividerPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  return (
    <BaseSidebarPanel title={t('inputs.panels.divider.title')}>
      <MultiStylePropertyPanel
        names={[
          'width',
          'widthMobile',
          'height',
          'heightMobile',
          'color',
          'backgroundColor',
          'textAlign',
          'textAlignMobile',
          'padding',
          'mobilePadding',
        ]}
        value={data.style as unknown as TStyle | undefined}
        onChange={(style) => updateData({ ...data, style: style as unknown as DividerProps['style'] })}
      />
    </BaseSidebarPanel>
  );
}
