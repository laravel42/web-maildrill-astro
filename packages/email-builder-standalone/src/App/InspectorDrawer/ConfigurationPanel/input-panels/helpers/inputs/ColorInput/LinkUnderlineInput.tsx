import React, { FC, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatClear, FormatUnderlined } from '@mui/icons-material';
import { Box, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';

import LabelProperty from '../LabelProperty';

type LinkUnderlineInputProps = {
  label?: string;
  underline: boolean;
  onChange: (underline: boolean) => void;
};

/**
 * Standalone "Link underline" control — the underline half of the former
 * combined LinksInput, split out so the root EmailLayout inspector can
 * expose link color and link underline as two independent property rows
 * (each in its own CompactableInput, each with its own title) instead of
 * one merged field.
 */
const LinkUnderlineInput: FC<LinkUnderlineInputProps> = ({ label, underline = false, onChange }) => {
  const [isUnderlined, setIsUnderlined] = useState(underline);
  const { t } = useTranslation('inspector');
  const value = isUnderlined ? 'enabled' : 'disabled';

  useEffect(() => {
    if (underline !== isUnderlined) {
      setIsUnderlined(underline);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-way prop→state sync; adding the local value would loop
  }, [underline]);

  const handleToggle = (_: unknown, next: 'enabled' | 'disabled' | null) => {
    if (!next) return;
    const enabled = next === 'enabled';
    setIsUnderlined(enabled);
    onChange(enabled);
  };

  return (
    <Box sx={{ width: '100%' }}>
      <LabelProperty label={label ?? t('inputs.links.underline')} />
      <ToggleButtonGroup value={value} exclusive fullWidth onChange={handleToggle} sx={{ width: '100%' }}>
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
  );
};

export default LinkUnderlineInput;
