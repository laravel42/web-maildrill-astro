import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CropSquare, Lock, LockOpen, PanoramaFishEye, RoundedCorner } from '@mui/icons-material';
import { Box, IconButton, Stack, ToggleButton, Tooltip } from '@mui/material';

import { TBorderRadius, TShape } from '../../../../../../documents/blocks/helpers/TStyle';

import LabelProperty from './LabelProperty';
import RadioGroupInput from './RadioGroupInput';
import RawSliderInput from './raw/RawSliderInput';

type ShapeProps = {
  label?: string;
  defaultValue: TShape;
  onChange: (style: TShape) => void;
  maxValue?: string | number;
  shapeSteps?: number;
  cornersLinked?: boolean;
  onCornersLinkedChange: (linked: boolean) => void;
};

type ShapeTab = 'rectangle' | 'pill' | 'rounded';

const Shape: FC<ShapeProps> = ({
  label,
  defaultValue,
  onChange,
  maxValue = 600,
  shapeSteps = 8,
  cornersLinked,
  onCornersLinkedChange,
}) => {
  const { t } = useTranslation('inspector');

  const [selectedShape, setSelectedShape] = useState<ShapeTab>(() => {
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      return 'rounded';
    }
    return (defaultValue as ShapeTab) || 'rectangle';
  });

  const [borderRadius, setBorderRadius] = useState<TBorderRadius>(() => {
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      return defaultValue;
    }
    return {
      topLeft: 0,
      topRight: 0,
      bottomLeft: 0,
      bottomRight: 0,
    };
  });

  const isLocked = cornersLinked === true;

  useEffect(() => {
    if (typeof defaultValue === 'object' && defaultValue !== null) {
      setBorderRadius(defaultValue);
      setSelectedShape('rounded');
    } else if (defaultValue === 'rectangle' || defaultValue === 'pill') {
      setSelectedShape(defaultValue);
    }
  }, [defaultValue]);

  const handleShapeChange = (value: string) => {
    const tab = value as ShapeTab;
    setSelectedShape(tab);
    if (tab === 'rounded') {
      onChange(borderRadius);
    } else {
      onChange(tab);
    }
  };

  const handleBorderRadiusChange = (corner: keyof TBorderRadius, value: number) => {
    let newBorderRadius;

    if (isLocked) {
      // Cuando está bloqueado, aplicar el mismo valor a todas las esquinas
      newBorderRadius = {
        topLeft: value,
        topRight: value,
        bottomLeft: value,
        bottomRight: value,
      };
    } else {
      // Comportamiento normal, solo cambiar la esquina específica
      newBorderRadius = {
        ...borderRadius,
        [corner]: value,
      };
    }

    setBorderRadius(newBorderRadius);
    onChange(newBorderRadius);
  };

  const toggleLock = () => {
    const nextLocked = !isLocked;
    if (!isLocked) {
      const lockedValue = {
        topLeft: borderRadius.topLeft,
        topRight: borderRadius.topLeft,
        bottomLeft: borderRadius.topLeft,
        bottomRight: borderRadius.topLeft,
      };
      setBorderRadius(lockedValue);
      onChange(lockedValue);
    }
    onCornersLinkedChange(nextLocked);
  };

  const MAX_BORDER_RADIUS = typeof maxValue === 'number' ? maxValue : Number(maxValue) || 600;
  const resolvedLabel = label || t('shape.label');

  return (
    <>
      <RadioGroupInput label={resolvedLabel} defaultValue={selectedShape} onChange={handleShapeChange}>
        <ToggleButton value="rectangle">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <CropSquare fontSize="small" />
            <span>{t('shape.square')}</span>
          </Box>
        </ToggleButton>
        <ToggleButton value="pill">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <PanoramaFishEye fontSize="small" />
            <span>{t('shape.pill')}</span>
          </Box>
        </ToggleButton>
        <ToggleButton value="rounded">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <RoundedCorner fontSize="small" />
            <span>{t('shape.custom')}</span>
          </Box>
        </ToggleButton>
      </RadioGroupInput>

      {selectedShape === 'rounded' && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start', pb: 1 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <LabelProperty label={t('shape.borderRadius')} />
            <Tooltip title={isLocked ? t('lockValues.unlockTooltip') : t('lockValues.lockTooltip')}>
              <IconButton
                size="small"
                onClick={toggleLock}
                sx={{
                  marginTop: '0!important',
                  color: isLocked ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                {isLocked ? <Lock fontSize="small" /> : <LockOpen fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          {isLocked ? (
            <>
              <RawSliderInput
                iconLabel={<RoundedCorner sx={{ fontSize: 16 }} />}
                value={Number(borderRadius.topRight)}
                setValue={(num) => handleBorderRadiusChange('topLeft', num)}
                units="px"
                min={0}
                step={shapeSteps}
                marks={shapeSteps > 1 ? true : false}
                max={MAX_BORDER_RADIUS}
              />
            </>
          ) : (
            <>
              <RawSliderInput
                iconLabel={<RoundedCorner sx={{ fontSize: 16, transform: 'rotate(0deg)' }} />}
                value={Number(borderRadius.topLeft)}
                setValue={(num) => handleBorderRadiusChange('topLeft', num)}
                units="px"
                min={0}
                step={shapeSteps}
                marks={shapeSteps > 1 ? true : false}
                max={MAX_BORDER_RADIUS}
              />

              <RawSliderInput
                iconLabel={<RoundedCorner sx={{ fontSize: 16, transform: 'rotate(270deg)' }} />}
                value={Number(borderRadius.topRight)}
                setValue={(num) => handleBorderRadiusChange('topRight', num)}
                units="px"
                min={0}
                step={shapeSteps}
                marks={shapeSteps > 1 ? true : false}
                max={MAX_BORDER_RADIUS}
              />

              <RawSliderInput
                iconLabel={<RoundedCorner sx={{ fontSize: 16, transform: 'rotate(180deg)' }} />}
                value={Number(borderRadius.bottomLeft)}
                setValue={(num) => handleBorderRadiusChange('bottomLeft', num)}
                units="px"
                min={0}
                step={shapeSteps}
                marks={shapeSteps > 1 ? true : false}
                max={MAX_BORDER_RADIUS}
              />

              <RawSliderInput
                iconLabel={<RoundedCorner sx={{ fontSize: 16, transform: 'rotate(90deg)' }} />}
                value={Number(borderRadius.bottomRight)}
                setValue={(num) => handleBorderRadiusChange('bottomRight', num)}
                units="px"
                min={0}
                step={shapeSteps}
                marks={shapeSteps > 1 ? true : false}
                max={MAX_BORDER_RADIUS}
              />
            </>
          )}
        </Stack>
      )}
    </>
  );
};

export default Shape;
