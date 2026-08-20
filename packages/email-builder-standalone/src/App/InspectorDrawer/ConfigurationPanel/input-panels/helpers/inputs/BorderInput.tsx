import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BorderBottomOutlined,
  BorderLeftOutlined,
  BorderOuterOutlined,
  BorderRightOutlined,
  BorderTopOutlined,
  Lock,
  LockOpen,
} from '@mui/icons-material';
import { IconButton, Stack, Tooltip } from '@mui/material';

import ColorInput from './ColorInput';
import LabelProperty from './LabelProperty';
import SliderInput from './SliderInput';
type BorderInputProps = {
  label?: string;
  borderColor: string | null;
  borderTop: number | null;
  borderBottom: number | null;
  borderLeft: number | null;
  borderRight: number | null;
  onChange: (v: object) => void;
  mobile?: boolean;
  sidesLinked?: boolean;
  onSidesLinkedChange: (linked: boolean) => void;
};

const BorderInput: FC<BorderInputProps> = ({
  mobile = false,
  label,
  borderColor,
  borderTop,
  borderBottom,
  borderLeft,
  borderRight,
  onChange,
  sidesLinked,
  onSidesLinkedChange,
}) => {
  const { t } = useTranslation('inspector');

  const getBorderKeys = () => {
    if (mobile) {
      return {
        top: 'borderTopMobile',
        bottom: 'borderBottomMobile',
        left: 'borderLeftMobile',
        right: 'borderRightMobile',
      };
    }
    return {
      top: 'borderTop',
      bottom: 'borderBottom',
      left: 'borderLeft',
      right: 'borderRight',
    };
  };

  const areAllBordersEqual = (borderValues: { [key: string]: number }) => {
    const values = Object.values(borderValues);
    return values.every((val) => val === values[0]);
  };

  const borderKeys = getBorderKeys();

  const initialBorders = {
    [borderKeys.top]: borderTop ?? 0,
    [borderKeys.bottom]: borderBottom ?? 0,
    [borderKeys.left]: borderLeft ?? 0,
    [borderKeys.right]: borderRight ?? 0,
  };

  const [bColor, setBColor] = useState(borderColor ?? '#000000');
  const [border, setBorder] = useState(initialBorders);

  const numericBorderFromState: Record<string, number> = {
    [borderKeys.top]: Number(border[borderKeys.top]),
    [borderKeys.bottom]: Number(border[borderKeys.bottom]),
    [borderKeys.left]: Number(border[borderKeys.left]),
    [borderKeys.right]: Number(border[borderKeys.right]),
  };
  const linked =
    sidesLinked !== undefined ? sidesLinked : areAllBordersEqual(numericBorderFromState);

  useEffect(() => {
    if (borderColor !== bColor) {
      setBColor(borderColor ?? '#000000');
    }

    const currentBorders = {
      [borderKeys.top]: borderTop ?? 0,
      [borderKeys.bottom]: borderBottom ?? 0,
      [borderKeys.left]: borderLeft ?? 0,
      [borderKeys.right]: borderRight ?? 0,
    };

    const hasChanged = Object.keys(currentBorders).some(
      (key) => border[key] !== currentBorders[key],
    );

    if (hasChanged) {
      setBorder(currentBorders);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- emits the composed border to the parent; deps are the user-facing fields only — adding the derived border object/keys would loop
  }, [borderColor, borderTop, borderBottom, borderLeft, borderRight, mobile]);

  const toggleLock = () => {
    if (linked) {
      onSidesLinkedChange(false);
    } else {
      const unifiedValue = border[borderKeys.top] ?? 0;
      handleBorderAllChange(unifiedValue);
      onSidesLinkedChange(true);
    }
  };

  const handleBorderColorChange = (value: string | null) => {
    setBColor(value);
    onChange({
      borderColor: value,
      ...border,
    });
  };

  const handleBorderAllChange = (value: number) => {
    const newBorder = {
      [borderKeys.top]: value,
      [borderKeys.bottom]: value,
      [borderKeys.left]: value,
      [borderKeys.right]: value,
    };

    setBorder(newBorder);
    onChange({
      ...newBorder,
      borderColor: bColor,
    });
  };

  const handleBorderChange = (value: number, name: string) => {
    setBorder((prev) => ({ ...prev, [name]: value }));
    const newBorder = {
      ...border,
      borderColor: bColor,
      [name]: value,
    };

    onChange(newBorder);
  };

  return (
    <div>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
      >
        <LabelProperty label={label} />
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <ColorInput defaultValue={bColor} onChange={handleBorderColorChange} compact />
          <Tooltip title={linked ? t('lockValues.unlockTooltip') : t('lockValues.lockTooltip')}>
            <IconButton
              size="small"
              onClick={toggleLock}
              sx={{
                color: linked ? 'primary.main' : 'text.secondary',
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              {linked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      {linked && (
        <SliderInput
          label={''}
          iconLabel={<BorderOuterOutlined sx={{ color: 'text.secondary' }} />}
          units="px"
          step={1}
          min={0}
          max={8}
          defaultValue={border[borderKeys.top]}
          onChange={handleBorderAllChange}
        />
      )}
      {!linked && (
        <Stack spacing={2}>
          <SliderInput
            label={''}
            iconLabel={<BorderTopOutlined sx={{ color: 'text.secondary' }} />}
            units="px"
            step={1}
            min={0}
            max={8}
            defaultValue={border[borderKeys.top]}
            onChange={(v) => handleBorderChange(v, borderKeys.top)}
          />
          <SliderInput
            label={''}
            iconLabel={<BorderBottomOutlined sx={{ color: 'text.secondary' }} />}
            units="px"
            step={1}
            min={0}
            max={8}
            defaultValue={border[borderKeys.bottom]}
            onChange={(v) => handleBorderChange(v, borderKeys.bottom)}
          />
          <SliderInput
            label={''}
            iconLabel={<BorderLeftOutlined sx={{ color: 'text.secondary' }} />}
            units="px"
            step={1}
            min={0}
            max={8}
            defaultValue={border[borderKeys.left]}
            onChange={(v) => handleBorderChange(v, borderKeys.left)}
          />
          <SliderInput
            label={''}
            iconLabel={<BorderRightOutlined sx={{ color: 'text.secondary' }} />}
            units="px"
            step={1}
            min={0}
            max={8}
            defaultValue={border[borderKeys.right]}
            onChange={(v) => handleBorderChange(v, borderKeys.right)}
          />
        </Stack>
      )}
    </div>
  );
};

export default BorderInput;
