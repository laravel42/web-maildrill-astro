import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Crop, FitScreen, Percent, WidthWideOutlined } from '@mui/icons-material';
import { Box, Collapse, ToggleButton, ToggleButtonGroup, useTheme } from '@mui/material';

import FieldContainer from './components/FieldContainer';
import LabelProperty from './LabelProperty';
import RawSliderInput from './raw/RawSliderInput';

const SizeSelector = ({ defaultValue = 'original', scale = 100, onChange }) => {
  const [selected, setSelected] = useState(defaultValue);
  const [scaleValue, setScaleValue] = useState(scale);

  const theme = useTheme();
  const { t } = useTranslation('inspector');

  // Estilos dinámicos basados en el theme
  const styles = {
    container: {
      width: '100%',
    },
    label: {
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: 500,
      color: theme.palette.text.primary,
    },
    sliderContainer: {
      marginTop: '16px',
      padding: '0 8px',
    },
    slider: {
      '& .MuiSlider-thumb': {
        width: 12,
        height: 12,
        backgroundColor: theme.palette.primary.main,
        '&:hover': {
          boxShadow: `0 0 0 8px ${theme.palette.primary.main}20`,
        },
      },
      '& .MuiSlider-rail': {
        height: 4,
        backgroundColor: theme.palette.grey[300],
      },
      '& .MuiSlider-track': {
        height: 4,
        backgroundColor: theme.palette.primary.main,
      },
    },
    scaleValue: {
      marginTop: '4px',
      textAlign: 'right',
      fontSize: '14px',
      color: theme.palette.text.secondary,
    },
  };

  useEffect(() => {
    if (defaultValue !== selected || scale !== scaleValue) {
      if (defaultValue !== selected) setSelected(defaultValue);
      if (defaultValue === 'scale') setScaleValue(scale);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync from parent props only (not local state)
  }, [defaultValue, scale]);

  const handleModeChange = (event, newValue) => {
    if (newValue !== null) {
      setSelected(newValue);
      if (onChange) {
        onChange({
          mode: newValue,
          scale: newValue === 'scale' ? scaleValue : undefined,
        });
      }
    }
  };

  const handleScaleChange = (newValue) => {
    setScaleValue(newValue);
    if (onChange) {
      onChange({
        mode: selected,
        scale: newValue,
      });
    }
  };

  return (
    <FieldContainer>
      <LabelProperty label={t('inputs.sizeSelector.label')} />
      <Box sx={styles.container}>
        <ToggleButtonGroup value={selected} exclusive onChange={handleModeChange} sx={{ width: '100%' }}>
          <ToggleButton value="original">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
              <FitScreen fontSize="small" />
              <span>{t('inputs.sizeSelector.contain')}</span>
            </Box>
          </ToggleButton>
          <ToggleButton value="fill">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
              <Crop fontSize="small" />
              <span>{t('inputs.sizeSelector.cover')}</span>
            </Box>
          </ToggleButton>
          <ToggleButton value="scale">
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.75 }}>
              <Percent fontSize="small" />
              <span>{t('inputs.sizeSelector.scale')}</span>
            </Box>
          </ToggleButton>
        </ToggleButtonGroup>

        <Collapse in={selected === 'scale'}>
          <Box sx={styles.sliderContainer}>
            <RawSliderInput
              iconLabel={<WidthWideOutlined />}
              value={scaleValue}
              setValue={handleScaleChange}
              marks={false}
              units={'%'}
              min={1}
              max={100}
            />
          </Box>
        </Collapse>
      </Box>
    </FieldContainer>
  );
};

export default SizeSelector;
