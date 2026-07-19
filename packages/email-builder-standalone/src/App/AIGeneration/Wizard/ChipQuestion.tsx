import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Chip, Stack, TextField, Typography } from '@mui/material';

import { INPUT_TEXTFIELD_SX } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';

export interface ChipOption {
  value: string;
  /** i18n key for the label. If absent, `value` is used directly. */
  labelKey?: string;
}

interface ChipQuestionProps {
  /** i18n key for the question heading. */
  questionKey: string;
  /** i18n key for the microcopy hint. */
  hintKey?: string;
  options: ChipOption[];
  selected: string[];
  multi?: boolean;
  onChange: (next: string[]) => void;
  /** If provided, renders a free-text input below the chips. */
  textValue?: string;
  onTextChange?: (v: string) => void;
  /** i18n key for the text input placeholder. */
  textPlaceholderKey?: string;
}

export default function ChipQuestion({
  questionKey,
  hintKey,
  options,
  selected,
  multi = false,
  onChange,
  textValue,
  onTextChange,
  textPlaceholderKey,
}: ChipQuestionProps) {
  const { t } = useTranslation('aiWizard');

  function handleChipClick(value: string) {
    if (multi) {
      onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
    } else {
      onChange(selected.includes(value) ? [] : [value]);
    }
  }

  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        {t(questionKey)}
      </Typography>
      {hintKey && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          {t(hintKey)}
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: onTextChange ? 2 : 0 }}>
        {options.map((opt) => (
          <Chip
            key={opt.value}
            label={opt.labelKey ? t(opt.labelKey) : opt.value}
            onClick={() => handleChipClick(opt.value)}
            color={selected.includes(opt.value) ? 'primary' : 'default'}
            variant={selected.includes(opt.value) ? 'filled' : 'outlined'}
            size="small"
          />
        ))}
      </Stack>
      {onTextChange !== undefined && (
        <TextField
          fullWidth
          size="small"
          variant="outlined"
          value={textValue ?? ''}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={textPlaceholderKey ? t(textPlaceholderKey) : undefined}
          sx={INPUT_TEXTFIELD_SX}
        />
      )}
    </Box>
  );
}
