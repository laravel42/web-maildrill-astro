import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ZodError } from 'zod';

import { ButtonProps, ButtonPropsDefaults, ButtonPropsSchema } from '@eb/block-button';
import {
  AspectRatioOutlined,
  LinkOutlined,
  PaletteOutlined,
  TitleOutlined,
  WidthFullOutlined,
} from '@mui/icons-material';

import type { EmailLayoutProps } from '../../../../documents/blocks/EmailLayout/EmailLayoutPropsSchema';
import { useRoot, useSelectedSidebarTab } from '../../../../documents/editor/EditorContext';
import { useCompactMode } from '../../CompactModeContext';

import BaseSidebarPanel, { CompactDivider } from './helpers/BaseSidebarPanel';
import ColorInput from './helpers/inputs/ColorInput';
import CompactableInput from './helpers/inputs/CompactableInput';
import ResponsiveSizeInput from './helpers/inputs/InputSizeButton';
import ResponsiveWidthInput from './helpers/inputs/InputWidth';
import TextInput from './helpers/inputs/TextInput';
import MultiStylePropertyPanel from './helpers/style-inputs/MultiStylePropertyPanel';
import { TextColorIcon } from './helpers/style-inputs/SingleStylePropertyPanel';

type ButtonSidebarPanelProps = {
  data: ButtonProps;
  setData: (v: ButtonProps) => void;
};
export default function ButtonSidebarPanel({ data, setData }: ButtonSidebarPanelProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const root = useRoot();
  const { t } = useTranslation('inspector');
  const updateData = (d: unknown) => {
    const res = ButtonPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error as any);
    }
  };

  const text = data.props?.text ?? ButtonPropsDefaults.text;
  const url = data.props?.url ?? ButtonPropsDefaults.url;
  const fullWidth = data.props?.fullWidth ?? ButtonPropsDefaults.fullWidth;
  const size = data.props?.size ?? ButtonPropsDefaults.size;
  const rootLayout = root as EmailLayoutProps | undefined;
  const resolvedButtonTextColor = data.style?.buttonTextColor ?? data.props?.buttonTextColor ?? rootLayout?.textColor;
  const resolvedButtonBackgroundColor =
    data.style?.buttonBackgroundColor ?? data.props?.buttonBackgroundColor ?? ButtonPropsDefaults.buttonBackgroundColor;
  const fullWidthMobile = data.props?.fullWidthMobile;
  const sizeMobile = data.props?.sizeMobile;

  const selectedTab = useSelectedSidebarTab();
  const compact = useCompactMode();

  return (
    <BaseSidebarPanel title={t('inputs.panels.button.title')}>
      {(selectedTab == 'block-configuration' || compact) && (
        <>
          <MultiStylePropertyPanel
            disabledCSSValidation
            names={['fontFamily', 'fontSize', 'fontSizeMobile', 'fontWeight', 'lineHeight']}
            value={data.style}
            onChange={(style) => updateData({ ...data, style })}
          />
          <CompactableInput icon={TitleOutlined} label={t('inputs.panels.button.textLabel')}>
            <TextInput
              label={t('inputs.panels.button.textLabel')}
              defaultValue={text}
              onChange={(text) => updateData({ ...data, props: { ...data.props, text } })}
            />
          </CompactableInput>
          <CompactableInput icon={LinkOutlined} label={t('inputs.panels.button.targetLabel')}>
            <TextInput
              label={t('inputs.panels.button.targetLabel')}
              placeholder={t('inputs.panels.button.targetPlaceholder')}
              defaultValue={url}
              onChange={(url) => updateData({ ...data, props: { ...data.props, url } })}
            />
          </CompactableInput>
          <CompactableInput icon={WidthFullOutlined} label={t('properties.width')}>
            <ResponsiveWidthInput
              label={t('properties.width')}
              fullWidth={fullWidth}
              fullWidthMobile={fullWidthMobile}
              onChange={(widthUpdates) => {
                return updateData({ ...data, props: { ...data.props, ...widthUpdates } });
              }}
            />
          </CompactableInput>
          <CompactableInput icon={AspectRatioOutlined} label={t('properties.size', 'Size')}>
            <ResponsiveSizeInput
              size={size}
              sizeMobile={sizeMobile}
              sizePaddingSidesLinked={data.props?.sizePaddingSidesLinked}
              sizeMobilePaddingSidesLinked={data.props?.sizeMobilePaddingSidesLinked}
              onChange={(sizeUpdates) => updateData({ ...data, props: { ...data.props, ...sizeUpdates } })}
            />
          </CompactableInput>
        </>
      )}
      <CompactDivider />
      <MultiStylePropertyPanel
        names={[
          'shape',
          'textAlign',
          'textAlignMobile',
          'backgroundColor',
          'border',
          'borderMobile',
          'padding',
          'mobilePadding',
        ]}
        value={data.style}
        shapeMaxValue={80}
        onChange={(style) => updateData({ ...data, style })}
      />
      {(selectedTab === 'css' || compact) && (
        <>
          <CompactableInput icon={TextColorIcon} label={t('inputs.panels.button.textColor')}>
            <ColorInput
              label={t('inputs.panels.button.textColor')}
              defaultValue={resolvedButtonTextColor}
              onChange={(buttonTextColor) => updateData({ ...data, style: { ...data.style, buttonTextColor } })}
            />
          </CompactableInput>
          <CompactableInput icon={PaletteOutlined} label={t('inputs.panels.button.buttonColor')}>
            <ColorInput
              label={t('inputs.panels.button.buttonColor')}
              defaultValue={resolvedButtonBackgroundColor}
              onChange={(buttonBackgroundColor) =>
                updateData({ ...data, style: { ...data.style, buttonBackgroundColor } })
              }
            />
          </CompactableInput>
        </>
      )}
    </BaseSidebarPanel>
  );
}
