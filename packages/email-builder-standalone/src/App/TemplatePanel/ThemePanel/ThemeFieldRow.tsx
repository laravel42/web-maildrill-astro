import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BorderStyleOutlined,
  FormatAlignCenterOutlined,
  FormatBoldOutlined,
  FormatSizeOutlined,
  type SvgIconComponent,
} from '@mui/icons-material';

import { EDITOR_SCHEMA_DEFAULTS_BY_TYPE } from '../../../documents/editor/core';
import { useThemeField } from '../../../documents/editor/EditorContext';
import BorderInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/BorderInput';
import { NullableColorInput } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/ColorInput';
import CompactableInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/CompactableInput';
import { NullableFontFamily } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/FontFamily';
import FontSizeInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/FontSizeInput';
import FontWeightInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/FontWeightInput';
import PaddingInput, {
  PaddingIcon,
} from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/PaddingInput';
import TextAlignInput from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/TextAlignInput';
import {
  BackgroundColorIcon,
  FontFamilyIcon,
} from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/style-inputs/SingleStylePropertyPanel';

import type { ThemeField, ThemeFieldKind } from './registry';
import ResetButton from './ResetButton';

type ThemeFieldRowProps = {
  blockType: string;
  field: ThemeField;
};

const ZERO_PADDING = { top: 0, right: 0, bottom: 0, left: 0 } as const;

const KIND_ICONS: Record<ThemeFieldKind, SvgIconComponent> = {
  color: BackgroundColorIcon,
  padding: PaddingIcon,
  fontSize: FormatSizeOutlined,
  fontFamily: FontFamilyIcon,
  fontWeight: FormatBoldOutlined,
  textAlign: FormatAlignCenterOutlined,
  number: FormatSizeOutlined,
  border: BorderStyleOutlined,
};

/**
 * Phase 2c — Inspector Theme panel.
 *
 * Renders a single overridable field for a given block type. Reads the
 * current override (if any) via `useThemeField` and writes back through
 * the same hook's `set` / `reset` helpers so the change is atomic and
 * undo/redo-integrated.
 *
 * Default values for the inputs are intentionally neutral (e.g. `''`
 * for color, `0` padding, `16` fontSize). They serve only as the
 * initial state shown to the user when no override exists; the actual
 * "default" semantics live in each block schema and are applied by the
 * resolution chain.
 */
export default function ThemeFieldRow({ blockType, field }: ThemeFieldRowProps) {
  const { t } = useTranslation('inspector');
  const { value, isOverridden, set, reset } = useThemeField(blockType, field.section, field.key);
  const [sidesLinked, setSidesLinked] = useState(true);

  // Schema default for this field, so the global theme inputs show the
  // effective applied value (and editing promotes it to an override).
  const schemaDefault = (
    EDITOR_SCHEMA_DEFAULTS_BY_TYPE[blockType]?.[field.section] as
      Record<string, unknown> | undefined
  )?.[field.key];

  const label = t(field.labelKey);
  const resetButton = <ResetButton onReset={reset} visible={isOverridden} />;
  const fieldIcon = field.icon ?? KIND_ICONS[field.kind];

  switch (field.kind) {
    case 'color':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <NullableColorInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as string | null | undefined) ??
              (schemaDefault as string | null | undefined) ??
              null
            }
            onChange={(next) => (next === null ? reset() : set(next))}
          />
        </CompactableInput>
      );
    case 'padding':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <PaddingInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as { top: number; right: number; bottom: number; left: number } | null) ??
              (schemaDefault as {
                top: number;
                right: number;
                bottom: number;
                left: number;
              } | null) ??
              ZERO_PADDING
            }
            inheritedFrom={isOverridden ? undefined : 'default'}
            onChange={(next) => set(next)}
            sidesLinked={sidesLinked}
            onSidesLinkedChange={setSidesLinked}
          />
        </CompactableInput>
      );
    case 'fontSize':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <FontSizeInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as number | undefined) ?? (schemaDefault as number | undefined) ?? 16
            }
            onChange={(next) => set(next)}
          />
        </CompactableInput>
      );
    case 'fontFamily':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <NullableFontFamily
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as string | null | undefined) ??
              (schemaDefault as string | null | undefined) ??
              null
            }
            onChange={(next) => (next === null ? reset() : set(next))}
          />
        </CompactableInput>
      );
    case 'fontWeight':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <FontWeightInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as string | undefined) ?? (schemaDefault as string | undefined) ?? 'normal'
            }
            onChange={(next) => set(next)}
          />
        </CompactableInput>
      );
    case 'textAlign':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <TextAlignInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as string | null | undefined) ??
              (schemaDefault as string | null | undefined) ??
              null
            }
            onChange={(next) => (next === null ? reset() : set(next))}
          />
        </CompactableInput>
      );
    case 'number':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <FontSizeInput
            label={label}
            labelAction={resetButton}
            defaultValue={
              (value as number | undefined) ?? (schemaDefault as number | undefined) ?? 0
            }
            onChange={(next) => set(next)}
          />
        </CompactableInput>
      );
    case 'border':
      return (
        <CompactableInput icon={fieldIcon} label={label}>
          <ThemeBorderField blockType={blockType} field={field} />
        </CompactableInput>
      );
    default: {
      const exhaustiveCheck: never = field.kind;
      void exhaustiveCheck;
      return null;
    }
  }
}

function ThemeBorderField({ blockType, field }: ThemeFieldRowProps) {
  const { t } = useTranslation('inspector');
  const borderColor = useThemeField<string>(blockType, field.section, 'borderColor');
  const borderTop = useThemeField<number>(blockType, field.section, 'borderTop');
  const borderBottom = useThemeField<number>(blockType, field.section, 'borderBottom');
  const borderLeft = useThemeField<number>(blockType, field.section, 'borderLeft');
  const borderRight = useThemeField<number>(blockType, field.section, 'borderRight');
  const [sidesLinked, setSidesLinked] = useState(true);

  const styleDefaults = EDITOR_SCHEMA_DEFAULTS_BY_TYPE[blockType]?.[field.section] as
    Record<string, unknown> | undefined;

  const handleChange = (v: Record<string, unknown>) => {
    if (v.borderColor !== undefined) borderColor.set(v.borderColor);
    if (v.borderTop !== undefined) borderTop.set(v.borderTop);
    if (v.borderBottom !== undefined) borderBottom.set(v.borderBottom);
    if (v.borderLeft !== undefined) borderLeft.set(v.borderLeft);
    if (v.borderRight !== undefined) borderRight.set(v.borderRight);
  };

  return (
    <BorderInput
      label={t(field.labelKey)}
      borderColor={
        (borderColor.value as string | undefined) ??
        (styleDefaults?.borderColor as string | undefined) ??
        null
      }
      borderTop={
        (borderTop.value as number | undefined) ??
        (styleDefaults?.borderTop as number | undefined) ??
        0
      }
      borderBottom={
        (borderBottom.value as number | undefined) ??
        (styleDefaults?.borderBottom as number | undefined) ??
        0
      }
      borderLeft={
        (borderLeft.value as number | undefined) ??
        (styleDefaults?.borderLeft as number | undefined) ??
        0
      }
      borderRight={
        (borderRight.value as number | undefined) ??
        (styleDefaults?.borderRight as number | undefined) ??
        0
      }
      onChange={handleChange}
      sidesLinked={sidesLinked}
      onSidesLinkedChange={setSidesLinked}
    />
  );
}
