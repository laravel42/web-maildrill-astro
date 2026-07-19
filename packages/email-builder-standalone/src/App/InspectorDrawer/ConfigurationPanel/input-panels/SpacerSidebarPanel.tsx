import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import { SpacerProps, SpacerPropsSchema } from '@eb/block-spacer';

import BaseSidebarPanel from './helpers/BaseSidebarPanel';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';

type SpacerSidebarPanelProps = {
  data: SpacerProps;
  setData: (v: SpacerProps) => void;
};
export default function SpacerSidebarPanel({ data, setData }: SpacerSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const { t } = useTranslation('inspector');

  const updateData = (d: unknown) => {
    const res = SpacerPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  return (
    <BaseSidebarPanel title={t('inputs.panels.spacer.title')}>
      <MultiStylePropertyPanel
        names={['height', 'heightMobile', 'backgroundColor']}
        value={data.style}
        onChange={(style) => updateData({ ...data, style })}
      />
    </BaseSidebarPanel>
  );
}
