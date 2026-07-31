import React, { useEffect, useState } from 'react';

import { InputProps, TextField } from '@mui/material';

import { useDebouncedCallback } from '../../../../../../utils/useDebounce';

import { INPUT_TEXTFIELD_SX } from './components/inputStyles';
import LabelProperty from './LabelProperty';

type Props = {
  label: string;
  rows?: number;
  placeholder?: string;
  helperText?: string | React.ReactElement;
  InputProps?: InputProps;
  defaultValue: string;
  onChange: (v: string) => void;
};

export default function TextInput({
  helperText,
  label,
  placeholder,
  rows,
  InputProps,
  defaultValue,
  onChange,
}: Props) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (value !== defaultValue) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);

  // Debounce de 150ms para actualizaciones del store
  const debouncedUpdate = useDebouncedCallback((newValue: string) => {
    onChange(newValue);
  }, 150);

  const isMultiline = typeof rows === 'number' && rows > 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <LabelProperty label={label} />
      <TextField
        fullWidth
        multiline={isMultiline}
        minRows={rows}
        variant="outlined"
        placeholder={placeholder}
        helperText={helperText}
        slotProps={{ input: InputProps }}
        value={value}
        sx={INPUT_TEXTFIELD_SX}
        onChange={(ev) => {
          const v = ev.target.value;
          // Actualizar UI inmediatamente (optimistic update)
          setValue(v);
          // Actualizar store con debounce
          debouncedUpdate(v);
        }}
        onBlur={() => {
          // Forzar actualización al perder foco
          debouncedUpdate.flush();
        }}
      />
    </div>
  );
}
