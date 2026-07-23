import React from 'react';

import { TextField, Typography } from '@mui/material';

/**
 * Text field with a live n/max counter that turns red past the limit —
 * the workhorse input of every WhatsApp panel, since nearly every rule
 * in a template is a character budget.
 */
export default function CharCountedField({
  label,
  value,
  max,
  onChange,
  multiline = false,
  minRows,
  placeholder,
  helperText,
}: {
  label: string;
  value: string;
  max: number;
  onChange: (value: string) => void;
  multiline?: boolean;
  minRows?: number;
  placeholder?: string;
  helperText?: string;
}) {
  const over = value.length > max;
  return (
    <TextField
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      multiline={multiline}
      minRows={minRows}
      placeholder={placeholder}
      size="small"
      fullWidth
      error={over}
      helperText={
        <Typography component="span" sx={{ display: 'flex', justifyContent: 'space-between', fontSize: 'inherit' }}>
          <span>{helperText ?? ''}</span>
          <span>{`${value.length}/${max}`}</span>
        </Typography>
      }
    />
  );
}
