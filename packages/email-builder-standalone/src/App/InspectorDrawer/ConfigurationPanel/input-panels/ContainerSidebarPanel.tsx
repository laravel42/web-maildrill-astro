import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import ContainerPropsSchema, { ContainerProps } from '../../../../documents/blocks/Container/ContainerPropsSchema';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type ContainerSidebarPanelProps = {
  data: ContainerProps;
  setData: (v: ContainerProps) => void;
};

export default function ContainerSidebarPanel({ data, setData }: ContainerSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const { t } = useTranslation('inspector');

  const updateData = (d: unknown) => {
    const res = ContainerPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  return (
    <BaseSidebarPanel title={t('inputs.panels.container.title')}>
      <MultiStylePropertyPanel
        names={['backgroundColor', 'background', 'border', 'borderMobile', 'shape', 'padding', 'mobilePadding']}
        value={data.style}
        shapeSteps={30}
        onChange={(style) => updateData({ ...data, style })}
      />
    </BaseSidebarPanel>
  );
}
