import React from 'react';

import { Typography } from '@mui/material';

import LabelProperty from '../../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/LabelProperty';

interface Props {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

/**
 * Field wrapper for wizard questions: a `LabelProperty` (the app's 12.5px/600
 * form label) + an optional caption hint + the control. Mirrors `WizardField`
 * so pill selects and text inputs share identical label/hint rhythm.
 */
export default function FieldShell({ label, hint, children }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      <LabelProperty label={label} />
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: '-4px', mb: '2px' }}>
          {hint}
        </Typography>
      )}
      {children}
    </div>
  );
}
