import React from 'react';
import { useTranslation } from 'react-i18next';

import { resolveBlockProp, type ThemeJson, type Viewport } from '@eb/document-core';
import {
  BorderStyleOutlined,
  FormatAlignCenterOutlined,
  FormatBoldOutlined,
  FormatLineSpacingOutlined,
  FormatSizeOutlined,
  HeightOutlined,
  PaletteOutlined,
  RoundedCornerOutlined,
  type SvgIconComponent,
  WallpaperOutlined,
  WidthFullOutlined,
} from '@mui/icons-material';
import { SvgIcon, type SvgIconProps } from '@mui/material';

import type { EmailLayoutProps } from '../../../../../../documents/blocks/EmailLayout/EmailLayoutPropsSchema';
import { TStyle } from '../../../../../../documents/blocks/helpers/TStyle';
import { EDITOR_SCHEMA_DEFAULTS_BY_TYPE } from '../../../../../../documents/editor/core';
import {
  useBlockTypeSelected,
  useRoot,
  useSelectedScreenSize,
} from '../../../../../../documents/editor/EditorContext';
import BackgroundImageInput from '../inputs/BackgroundImageInput';
import BorderInput from '../inputs/BorderInput';
import { NullableColorInput } from '../inputs/ColorInput';
import CompactableInput from '../inputs/CompactableInput';
import { NullableFontFamily } from '../inputs/FontFamily';
import FontSizeInput from '../inputs/FontSizeInput';
import FontWeightInput from '../inputs/FontWeightInput';
import HeightInput from '../inputs/HeightInput';
import LineHeightInput from '../inputs/LineHeightInput';
import PaddingInput, { PaddingIcon } from '../inputs/PaddingInput';
import Shape from '../inputs/Shape';
import SliderInput from '../inputs/SliderInput';
import TextAlignInput from '../inputs/TextAlignInput';
import WidthInput from '../inputs/WidthInput';

export const FontFamilyIcon: SvgIconComponent = ((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M15 4h7v2h-7zm1 4h6v2h-6zm2 4h4v2h-4zM9.307 4l-6 16h2.137l1.875-5h6.363l1.875 5h2.137l-6-16zm-1.239 9L10.5 6.515L12.932 13z"
    />
  </SvgIcon>
)) as unknown as SvgIconComponent;
FontFamilyIcon.muiName = 'FontFamilyIcon';

export const BackgroundColorIcon: SvgIconComponent = ((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <path d="M13.04 4.75h3.66c1.68 0 2.52 0 3.162.327a3 3 0 0 1 1.311 1.311c.327.642.327 1.482.327 3.162v5.4c0 1.68 0 2.52-.327 3.162a3 3 0 0 1-1.311 1.311c-.642.327-1.482.327-3.162.327H7.8c-1.68 0-2.52 0-3.162-.327a3 3 0 0 1-1.311-1.311C3 17.47 3 16.63 3 14.95v-.93" />
      <path d="m6.407 2.818l5.384 5.385M6.407 2.818L3.01 6.214c-.696.696-1.044 1.044-1.174 1.446c-.057.176-.086.36-.086.543m4.657-5.385L5.589 2m6.202 6.203l-3.396 3.396c-.696.696-1.044 1.044-1.445 1.174a1.76 1.76 0 0 1-1.086 0c-.401-.13-.75-.478-1.445-1.174L3.01 10.191c-.696-.696-1.044-1.044-1.174-1.445a1.8 1.8 0 0 1-.086-.543m10.042 0H1.75m10.672 4.094l1.485-2.448l1.744 2.313a1.824 1.824 0 0 1-.668 2.491c-1.546.893-3.322-.74-2.562-2.356" />
    </g>
  </SvgIcon>
)) as unknown as SvgIconComponent;
BackgroundColorIcon.muiName = 'BackgroundColorIcon';

export const TextColorIcon: SvgIconComponent = ((props: SvgIconProps) => (
  <SvgIcon {...props} viewBox="0 0 24 24">
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.5"
    >
      <path d="m7.154 13.088l1.73-3.959m0 0h6.231m-6.23 0l2.652-6.065a.5.5 0 0 1 .926 0l2.652 6.065m0 0l1.731 3.96" />
      <rect width="15.5" height="4.353" x="4.25" y="16.897" rx="1.5" />
    </g>
  </SvgIcon>
)) as unknown as SvgIconComponent;
TextColorIcon.muiName = 'TextColorIcon';

type StylePropertyPanelProps = {
  name: keyof TStyle;
  value: TStyle;
  onChange: (style: TStyle) => void;
  shapeMaxValue?: number;
  shapeSteps?: number;
};

export default function SingleStylePropertyPanel({
  name,
  value,
  onChange,
  shapeMaxValue,
  shapeSteps,
}: StylePropertyPanelProps) {
  const selectedScreenSize = useSelectedScreenSize();
  const root = useRoot() as EmailLayoutProps | undefined;
  const blockType = useBlockTypeSelected();
  const { t } = useTranslation('inspector');

  // Resolve a style value through the chain: explicit block value →
  // theme global setting → schema default. Returns null only when no
  // value exists at any level so the input can show what's actually
  // applied (global/default) instead of a misleading 0.
  const resolveStyleValue = <T = any,>(key: keyof TStyle): T | null => {
    if (!blockType) return (value[key] as T | null) ?? null;
    const viewport: Viewport = selectedScreenSize === 'desktop' ? 'desktop' : 'mobile';
    const theme = (root as { theme?: ThemeJson } | undefined)?.theme;
    const block = { type: blockType, data: { style: value } };
    const resolved = resolveBlockProp<T>(block, 'style', key as string, theme, viewport);
    if (resolved !== undefined) return resolved;
    const schemaDefault = EDITOR_SCHEMA_DEFAULTS_BY_TYPE[blockType]?.style?.[key as string];
    return (schemaDefault as T | undefined) ?? null;
  };

  // Where a resolved value comes from, so inputs can mute inherited
  // (theme/default) values. Returns undefined when the value is set
  // explicitly on the block.
  const styleInheritedFrom = (key: keyof TStyle): 'theme' | 'default' | undefined => {
    if (value[key] !== undefined && value[key] !== null) return undefined;
    if (!blockType) return undefined;
    const theme = (root as { theme?: ThemeJson } | undefined)?.theme;
    const themeVal = theme?.blocks?.[blockType]?.style?.[key as string];
    if (themeVal !== undefined && themeVal !== null) return 'theme';
    const schemaDefault = EDITOR_SCHEMA_DEFAULTS_BY_TYPE[blockType]?.style?.[key as string];
    return schemaDefault !== undefined && schemaDefault !== null ? 'default' : undefined;
  };

  const resolveBorderValue = (key: keyof TStyle): number | null => resolveStyleValue<number>(key);

  const getValueWithFallback = (mobileProperty: keyof TStyle, desktopProperty: keyof TStyle) => {
    const mobileValue = value[mobileProperty];
    const desktopValue = value[desktopProperty];

    return mobileValue !== undefined && mobileValue !== null ? mobileValue : desktopValue;
  };

  const handleChange = (v: any, styles?: StylePropertyPanelProps) => {
    if (styles) {
      onChange({ ...value, ...styles, [name]: v });
    } else {
      onChange({ ...value, [name]: v });
    }
  };

  const handleBorderChange = (v: any) => {
    onChange({ ...value, ...v });
  };

  // Obtener el valor por defecto según la propiedad
  const getDefaultValue = () => {
    switch (name) {
      case 'textAlignMobile':
        return resolveStyleValue('textAlignMobile') ?? resolveStyleValue('textAlign');
      case 'mobilePadding':
        return resolveStyleValue('mobilePadding') ?? resolveStyleValue('padding');
      case 'fontSizeMobile':
        return resolveStyleValue('fontSizeMobile') ?? resolveStyleValue('fontSize') ?? 16;
      case 'heightMobile':
        return resolveStyleValue('heightMobile') ?? resolveStyleValue('height');
      case 'widthMobile':
        return resolveStyleValue('widthMobile') ?? resolveStyleValue('width');
      case 'borderMobile':
        return {
          borderTop: getValueWithFallback('borderTopMobile', 'borderTop'),
          borderBottom: getValueWithFallback('borderBottomMobile', 'borderBottom'),
          borderLeft: getValueWithFallback('borderLeftMobile', 'borderLeft'),
          borderRight: getValueWithFallback('borderRightMobile', 'borderRight'),
        };
      default:
        return resolveStyleValue(name);
    }
  };

  const defaultValue = getDefaultValue();

  switch (name) {
    case 'backgroundColor':
      return (
        <CompactableInput icon={BackgroundColorIcon} label={t('properties.backgroundColor')}>
          <NullableColorInput
            label={t('properties.backgroundColor')}
            defaultValue={defaultValue ?? root?.canvasColor}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'background':
      return (
        <CompactableInput icon={WallpaperOutlined} label={t('properties.background', 'Background')}>
          <BackgroundImageInput
            defaultValue={defaultValue}
            onChange={(backgroundImage: any, styles?: any) => handleChange(backgroundImage, styles)}
            values={value}
          />
        </CompactableInput>
      );
    case 'borderColor':
      return (
        <CompactableInput icon={BackgroundColorIcon} label={t('properties.border')}>
          <NullableColorInput
            label={t('properties.border')}
            defaultValue={defaultValue}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'borderRadius':
      return (
        <CompactableInput icon={RoundedCornerOutlined} label={t('properties.borderRadius')}>
          <SliderInput
            iconLabel={<RoundedCornerOutlined />}
            units="px"
            step={4}
            marks
            min={0}
            max={48}
            label={t('properties.borderRadius')}
            defaultValue={defaultValue}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'color':
      return (
        <CompactableInput icon={PaletteOutlined} label={t('properties.color')}>
          <NullableColorInput
            label={t('properties.color')}
            defaultValue={defaultValue}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'fontFamily':
      return (
        <CompactableInput icon={FontFamilyIcon} label={t('properties.fontFamily')}>
          <NullableFontFamily
            label={t('properties.fontFamily')}
            defaultValue={defaultValue}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'fontWeight':
      return (
        <CompactableInput icon={FormatBoldOutlined} label={t('properties.fontWeight')}>
          <FontWeightInput
            label={t('properties.fontWeight')}
            defaultValue={defaultValue}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'textAlign':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={FormatAlignCenterOutlined} label={t('properties.alignment')}>
            <TextAlignInput
              label={t('properties.alignment')}
              defaultValue={defaultValue}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'textAlignMobile':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={FormatAlignCenterOutlined} label={t('properties.alignment')}>
            <TextAlignInput
              label={t('properties.alignment')}
              defaultValue={defaultValue}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'padding':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={PaddingIcon} label={t('properties.padding')}>
            <PaddingInput
              label={t('properties.padding')}
              defaultValue={resolveStyleValue('padding')}
              inheritedFrom={styleInheritedFrom('padding')}
              onChange={handleChange}
              sidesLinked={value.paddingSidesLinked}
              onSidesLinkedChange={(linked) => onChange({ ...value, paddingSidesLinked: linked })}
            />
          </CompactableInput>
        )
      );
    case 'mobilePadding':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={PaddingIcon} label={t('properties.padding')}>
            <PaddingInput
              label={t('properties.padding')}
              defaultValue={resolveStyleValue('mobilePadding') ?? resolveStyleValue('padding')}
              inheritedFrom={value['mobilePadding'] != null ? undefined : 'default'}
              onChange={handleChange}
              sidesLinked={value.mobilePaddingSidesLinked}
              onSidesLinkedChange={(linked) =>
                onChange({ ...value, mobilePaddingSidesLinked: linked })
              }
            />
          </CompactableInput>
        )
      );
    case 'fontSize':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={FormatSizeOutlined} label={t('properties.fontSize')}>
            <FontSizeInput
              maxValue={80}
              step={8}
              label={t('properties.fontSize')}
              defaultValue={defaultValue ?? 16}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'fontSizeMobile':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={FormatSizeOutlined} label={t('properties.fontSize')}>
            <FontSizeInput
              maxValue={80}
              step={8}
              label={t('properties.fontSize')}
              defaultValue={defaultValue}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'lineHeight':
      return (
        <CompactableInput icon={FormatLineSpacingOutlined} label={t('properties.lineHeight')}>
          <LineHeightInput
            label={t('properties.lineHeight')}
            defaultValue={defaultValue ?? 1.5}
            onChange={handleChange}
          />
        </CompactableInput>
      );
    case 'shape':
      return (
        <CompactableInput icon={RoundedCornerOutlined} label={t('properties.shape')}>
          <Shape
            shapeSteps={shapeSteps}
            maxValue={shapeMaxValue}
            label={t('properties.shape')}
            defaultValue={defaultValue}
            onChange={handleChange}
            cornersLinked={value.shapeCornersLinked}
            onCornersLinkedChange={(linked) => onChange({ ...value, shapeCornersLinked: linked })}
          />
        </CompactableInput>
      );
    case 'height':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={HeightOutlined} label={t('properties.height')}>
            <HeightInput
              label={t('properties.height')}
              defaultValue={defaultValue}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'heightMobile':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={HeightOutlined} label={t('properties.height')}>
            <HeightInput
              label={t('properties.height')}
              defaultValue={defaultValue}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'width':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={WidthFullOutlined} label={t('properties.width')}>
            <WidthInput
              label={t('properties.width')}
              defaultValue={resolveStyleValue<number>('width') ?? undefined}
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'widthMobile':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={WidthFullOutlined} label={t('properties.width')}>
            <WidthInput
              label={t('properties.width')}
              defaultValue={
                resolveStyleValue<number>('widthMobile') ??
                resolveStyleValue<number>('width') ??
                undefined
              }
              onChange={handleChange}
            />
          </CompactableInput>
        )
      );
    case 'border':
      return (
        selectedScreenSize === 'desktop' && (
          <CompactableInput icon={BorderStyleOutlined} label={t('properties.border')}>
            <BorderInput
              label={t('properties.border')}
              borderColor={value['borderColor'] ?? null}
              borderTop={resolveBorderValue('borderTop')}
              borderBottom={resolveBorderValue('borderBottom')}
              borderLeft={resolveBorderValue('borderLeft')}
              borderRight={resolveBorderValue('borderRight')}
              onChange={handleBorderChange}
              sidesLinked={value.borderSidesLinked}
              onSidesLinkedChange={(linked) => onChange({ ...value, borderSidesLinked: linked })}
            />
          </CompactableInput>
        )
      );
    case 'borderMobile':
      return (
        selectedScreenSize != 'desktop' && (
          <CompactableInput icon={BorderStyleOutlined} label={t('properties.border')}>
            <BorderInput
              mobile={true}
              label={t('properties.border')}
              borderColor={value['borderColor'] ?? null}
              borderTop={resolveBorderValue('borderTopMobile') ?? resolveBorderValue('borderTop')}
              borderBottom={
                resolveBorderValue('borderBottomMobile') ?? resolveBorderValue('borderBottom')
              }
              borderLeft={
                resolveBorderValue('borderLeftMobile') ?? resolveBorderValue('borderLeft')
              }
              borderRight={
                resolveBorderValue('borderRightMobile') ?? resolveBorderValue('borderRight')
              }
              onChange={handleBorderChange}
              sidesLinked={value.borderMobileSidesLinked}
              onSidesLinkedChange={(linked) =>
                onChange({ ...value, borderMobileSidesLinked: linked })
              }
            />
          </CompactableInput>
        )
      );
    default:
      return null;
  }
}
