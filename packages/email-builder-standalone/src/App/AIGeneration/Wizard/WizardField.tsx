import React from 'react';

import { TextField, type TextFieldProps } from '@mui/material';

import { INPUT_TEXTFIELD_SX } from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/components/inputStyles';
import LabelProperty from '../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

type WizardFieldProps = Omit<TextFieldProps, 'label' | 'variant' | 'size'> & {
  /** Bold label rendered above the input, matching the inspector pattern. */
  label: string;
};

/**
 * Wizard text field with the label rendered above the input — matching the
 * inspector's `LabelProperty` + `TextField` (with `INPUT_TEXTFIELD_SX`) pattern
 * used across the rest of the application. Avoids MUI's floating `label` prop
 * so wizard inputs are visually consistent with the configuration panel.
 */
export default function WizardField({ label, sx, ...textFieldProps }: WizardFieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
      <LabelProperty label={label} />
      <TextField
        fullWidth
        size="small"
        variant="outlined"
        {...textFieldProps}
        sx={[INPUT_TEXTFIELD_SX, ...(Array.isArray(sx) ? sx : sx ? [sx] : [])]}
      />
    </div>
  );
}
