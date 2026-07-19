import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatClear, FormatUnderlined } from '@mui/icons-material';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

import FieldContainer from '../components/FieldContainer';
import LabelProperty from '../LabelProperty';

import ColorInput from './index';

type LinksInputProps = {
  label?: string;
  linkColor: string | null;
  underline: boolean;
  onChange: (v: { linkColor: string | null; underline: boolean }) => void;
};

const LinksInput: FC<LinksInputProps> = ({ label, linkColor, underline = false, onChange }) => {
  const [color, setColor] = useState(linkColor ?? '#FF0000');
  const [isUnderlined, setIsUnderlined] = useState(underline);
  const { t } = useTranslation('inspector');
  const colorLabel = label ?? t('inputs.links.color');
  const underlineToggleValue = isUnderlined ? 'enabled' : 'disabled';
  const styles = {
    container: {
      width: '100%',
    },
  };

  useEffect(() => {
    if (linkColor !== color) {
      setColor(linkColor ?? '#FF0000');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [linkColor]);

  useEffect(() => {
    if (underline !== isUnderlined) {
      setIsUnderlined(underline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [underline]);

  const handleColorChange = (value: string | null) => {
    const newColor = value ?? '#FF0000';
    setColor(newColor);
    onChange({
      linkColor: newColor,
      underline: isUnderlined,
    });
  };

  const handleUnderlineToggle = (_: unknown, value: 'enabled' | 'disabled' | null) => {
    if (!value) {
      return;
    }
    const newUnderlineState = value === 'enabled';
    setIsUnderlined(newUnderlineState);
    onChange({
      linkColor: color,
      underline: newUnderlineState,
    });
  };

  return (
    <FieldContainer>
      <ColorInput label={colorLabel} defaultValue={color} onChange={handleColorChange} />
      <LabelProperty label={t('inputs.links.underline')} />
      <Box sx={styles.container}>
        <ToggleButtonGroup
          value={underlineToggleValue}
          exclusive
          fullWidth
          onChange={handleUnderlineToggle}
          sx={{ width: '100%' }}
        >
          <ToggleButton value="enabled">
            <Tooltip title={t('inputs.links.underlineOn')}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <FormatUnderlined fontSize="small" />
              </Box>
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="disabled">
            <Tooltip title={t('inputs.links.underlineOff')}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <FormatClear fontSize="small" />
              </Box>
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </FieldContainer>
  );
};

export default LinksInput;
