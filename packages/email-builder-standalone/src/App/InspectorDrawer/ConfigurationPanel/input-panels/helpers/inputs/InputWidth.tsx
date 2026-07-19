import React from 'react';
import { useTranslation } from 'react-i18next';

import { WidthFull, WidthNormal } from '@mui/icons-material';
import { Box, ToggleButton } from '@mui/material';

import { useSelectedScreenSize } from '../../../../../../documents/editor/EditorContext';
import RadioGroupInput from '../inputs/RadioGroupInput';

type ResponsiveWidthInputProps = {
  fullWidth?: boolean;
  fullWidthMobile?: boolean;
  onChange: (updates: { fullWidth?: boolean; fullWidthMobile?: boolean }) => void;
  label?: string;
};

export default function ResponsiveWidthInput({
  fullWidth,
  fullWidthMobile,
  onChange,
  label = 'Width',
}: ResponsiveWidthInputProps) {
  const selectedScreenSize = useSelectedScreenSize();
  const { t } = useTranslation('inspector');
  // Función para obtener el valor con fallback
  const getCurrentValue = () => {
    if (selectedScreenSize === 'desktop') {
      return fullWidth;
    } else {
      // Si no hay valor mobile, usar el fallback de desktop
      return fullWidthMobile !== undefined ? fullWidthMobile : fullWidth;
    }
  };

  const handleChange = (value: string) => {
    const isFullWidth = value === 'FULL_WIDTH';

    if (selectedScreenSize === 'desktop') {
      // Actualizar desktop y aplicar fallback a mobile si mobile no tiene valor
      const updates: { fullWidth: boolean; fullWidthMobile?: boolean } = {
        fullWidth: isFullWidth,
      };

      // Si mobile no tiene valor, aplicar el mismo valor
      if (fullWidthMobile === undefined || fullWidthMobile === null) {
        updates.fullWidthMobile = isFullWidth;
      }

      onChange(updates);
    } else {
      // Actualizar solo mobile
      onChange({ fullWidthMobile: isFullWidth });
    }
  };

  const currentValue = getCurrentValue();

  return (
    <RadioGroupInput label={label} defaultValue={currentValue ? 'FULL_WIDTH' : 'AUTO'} onChange={handleChange}>
      <ToggleButton value="FULL_WIDTH">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <WidthFull fontSize="small" />
          <span>{t('inputs.width.full')}</span>
        </Box>
      </ToggleButton>
      <ToggleButton value="AUTO">
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
          <WidthNormal fontSize="small" />
          <span>{t('inputs.width.auto')}</span>
        </Box>
      </ToggleButton>
    </RadioGroupInput>
  );
}
