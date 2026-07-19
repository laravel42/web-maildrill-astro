import React from 'react';

import { TextField, Typography } from '@mui/material';

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}

export function PromptInput({ value, onChange, disabled }: PromptInputProps) {
  return (
    <>
      <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>Image description</Typography>
      <TextField
        disabled={disabled}
        autoFocus
        margin="dense"
        id="prompt"
        placeholder={'Enter a detailed description here...'}
        type="text"
        fullWidth
        multiline
        rows={4}
        variant="outlined"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ mt: 0.5, '& .MuiOutlinedInput-root': { borderRadius: '6px' } }}
      />
    </>
  );
}
