import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AlignHorizontalLeftOutlined,
  AlignHorizontalRightOutlined,
  AlignVerticalBottomOutlined,
  AlignVerticalTopOutlined,
  Lock,
  LockOpen,
} from '@mui/icons-material';
import { Box, IconButton, Stack, ToggleButton, Tooltip, Typography } from '@mui/material';

import { useSelectedScreenSize } from '../../../../../../documents/editor/EditorContext';
import LabelProperty from '../inputs/LabelProperty';
import RadioGroupInput from '../inputs/RadioGroupInput';
import RawSliderInput from '../inputs/raw/RawSliderInput';

type SizeType = 'x-small' | 'small' | 'medium' | 'large' | 'custom';

type CustomPadding = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/** Optional per-side values (e.g. button block size object). */
type LooseCustomPadding = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
};

function normalizePadding(p: CustomPadding | LooseCustomPadding): CustomPadding {
  return {
    top: Number(p.top ?? 0),
    bottom: Number(p.bottom ?? 0),
    left: Number(p.left ?? 0),
    right: Number(p.right ?? 0),
  };
}

type ResponsiveSizeValue = SizeType | CustomPadding | LooseCustomPadding;

type ResponsiveSizeInputProps = {
  size?: ResponsiveSizeValue;
  sizeMobile?: ResponsiveSizeValue;
  /** Persisted inspector UI: custom padding desktop — single slider vs per-side */
  sizePaddingSidesLinked?: boolean;
  /** Persisted inspector UI: custom padding mobile */
  sizeMobilePaddingSidesLinked?: boolean;
  onChange: (updates: {
    size?: SizeType | CustomPadding;
    sizeMobile?: SizeType | CustomPadding;
    sizePaddingSidesLinked?: boolean;
    sizeMobilePaddingSidesLinked?: boolean;
  }) => void;
  label?: string;
  maxValue?: string | number;
  paddingSteps?: number;
};

export default function ResponsiveSizeInput({
  size,
  sizeMobile,
  sizePaddingSidesLinked,
  sizeMobilePaddingSidesLinked,
  onChange,
  label,
  maxValue = 100,
  paddingSteps = 8,
}: ResponsiveSizeInputProps) {
  const { t } = useTranslation('inspector');
  const resolvedLabel = label ?? t('inputs.common.size');
  const selectedScreenSize = useSelectedScreenSize();

  // Estado para el padding personalizado
  const [padding, setPadding] = useState<CustomPadding>(() => {
    const currentValue =
      selectedScreenSize === 'desktop' ? size : sizeMobile !== undefined ? sizeMobile : size;

    if (typeof currentValue === 'object' && currentValue !== null) {
      return normalizePadding(currentValue);
    }

    return {
      top: 8,
      bottom: 8,
      left: 16,
      right: 16,
    };
  });

  const isLocked =
    selectedScreenSize === 'desktop'
      ? sizePaddingSidesLinked === true
      : sizeMobilePaddingSidesLinked === true;

  useEffect(() => {
    const currentValue =
      selectedScreenSize === 'desktop' ? size : sizeMobile !== undefined ? sizeMobile : size;

    // Si el valor actual es un objeto (custom padding), actualizarlo
    if (typeof currentValue === 'object' && currentValue !== null) {
      setPadding(normalizePadding(currentValue));
    }
  }, [size, sizeMobile, selectedScreenSize]);

  // Función para obtener el valor con fallback
  const getCurrentValue = (): string => {
    const currentValue =
      selectedScreenSize === 'desktop' ? size : sizeMobile !== undefined ? sizeMobile : size;

    // Si es un objeto (custom padding), retornar 'custom'
    if (typeof currentValue === 'object' && currentValue !== null) {
      return 'custom';
    }

    return typeof currentValue === 'string' ? currentValue : 'medium';
  };

  const maxSlider = typeof maxValue === 'number' ? maxValue : Number(maxValue) || 100;

  const handleChange = (value: SizeType) => {
    if (selectedScreenSize === 'desktop') {
      // Actualizar desktop y aplicar fallback a mobile si mobile no tiene valor
      const updates: {
        size: SizeType | CustomPadding;
        sizeMobile?: SizeType | CustomPadding;
        customPadding?: CustomPadding;
      } = {
        size: value === 'custom' ? padding : value,
      };

      // Si mobile no tiene valor, aplicar el mismo valor
      if (sizeMobile === undefined || sizeMobile === null) {
        updates.sizeMobile = value === 'custom' ? padding : value;
      }

      onChange(updates);
    } else {
      // Actualizar solo mobile
      const updates: {
        sizeMobile: SizeType | CustomPadding;
        customPaddingMobile?: CustomPadding;
      } = {
        sizeMobile: value === 'custom' ? padding : value,
      };

      onChange(updates);
    }
  };

  const handlePaddingChange = (side: keyof CustomPadding, value: number) => {
    let newPadding;

    if (isLocked) {
      // Cuando está bloqueado, aplicar el mismo valor a todos los lados
      newPadding = {
        top: value,
        bottom: value,
        left: value,
        right: value,
      };
    } else {
      // Comportamiento normal, solo cambiar el lado específico
      newPadding = {
        ...padding,
        [side]: value,
      };
    }

    setPadding(newPadding);

    // Enviar el objeto de padding directamente según el screen size actual
    if (selectedScreenSize === 'desktop') {
      onChange({ size: newPadding });
    } else {
      onChange({ sizeMobile: newPadding });
    }
  };

  const toggleLock = () => {
    if (selectedScreenSize === 'desktop') {
      if (!isLocked) {
        const newPadding = {
          top: padding.top,
          bottom: padding.top,
          left: padding.top,
          right: padding.top,
        };
        setPadding(newPadding);
        onChange({ size: newPadding, sizePaddingSidesLinked: true });
      } else {
        onChange({ sizePaddingSidesLinked: false });
      }
    } else if (!isLocked) {
      const newPadding = {
        top: padding.top,
        bottom: padding.top,
        left: padding.top,
        right: padding.top,
      };
      setPadding(newPadding);
      onChange({ sizeMobile: newPadding, sizeMobilePaddingSidesLinked: true });
    } else {
      onChange({ sizeMobilePaddingSidesLinked: false });
    }
  };

  const currentValue = getCurrentValue();

  return (
    <Stack spacing={2}>
      <RadioGroupInput label={resolvedLabel} defaultValue={currentValue} onChange={handleChange}>
        <ToggleButton value="x-small">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <span>{t('inputs.responsiveSize.options.xSmall')}</span>
          </Box>
        </ToggleButton>
        <ToggleButton value="small">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <span>{t('inputs.responsiveSize.options.small')}</span>
          </Box>
        </ToggleButton>
        <ToggleButton value="medium">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <span>{t('inputs.responsiveSize.options.medium')}</span>
          </Box>
        </ToggleButton>
        <ToggleButton value="custom">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
            <span>{t('inputs.responsiveSize.options.custom')}</span>
          </Box>
        </ToggleButton>
      </RadioGroupInput>

      {currentValue === 'custom' && (
        <Stack spacing={2} sx={{ alignItems: 'flex-start', pb: 1 }}>
          <Stack
            direction="row"
            sx={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
          >
            <LabelProperty label={t('inputs.responsiveSize.customPadding')} />
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
            <RawSliderInput
              iconLabel={
                <Typography variant="body2" component="span">
                  {t('inputs.responsiveSize.allSides')}
                </Typography>
              }
              value={padding.top} // Usar un valor como referencia
              setValue={(num) => handlePaddingChange('top', num)}
              units="px"
              min={0}
              step={paddingSteps}
              marks={paddingSteps > 1 ? true : false}
              max={maxSlider}
            />
          ) : (
            <>
              <RawSliderInput
                iconLabel={<AlignVerticalTopOutlined sx={{ fontSize: 16 }} />}
                value={padding.top}
                setValue={(num) => handlePaddingChange('top', num)}
                units="px"
                min={0}
                step={paddingSteps}
                marks={paddingSteps > 1 ? true : false}
                max={maxSlider}
              />

              <RawSliderInput
                iconLabel={<AlignVerticalBottomOutlined sx={{ fontSize: 16 }} />}
                value={padding.bottom}
                setValue={(num) => handlePaddingChange('bottom', num)}
                units="px"
                min={0}
                step={paddingSteps}
                marks={paddingSteps > 1 ? true : false}
                max={maxSlider}
              />

              <RawSliderInput
                iconLabel={<AlignHorizontalLeftOutlined sx={{ fontSize: 16 }} />}
                value={padding.left}
                setValue={(num) => handlePaddingChange('left', num)}
                units="px"
                min={0}
                step={paddingSteps}
                marks={paddingSteps > 1 ? true : false}
                max={maxSlider}
              />

              <RawSliderInput
                iconLabel={<AlignHorizontalRightOutlined sx={{ fontSize: 16 }} />}
                value={padding.right}
                setValue={(num) => handlePaddingChange('right', num)}
                units="px"
                min={0}
                step={paddingSteps}
                marks={paddingSteps > 1 ? true : false}
                max={maxSlider}
              />
            </>
          )}
        </Stack>
      )}
    </Stack>
  );
}
