import React from 'react';

import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const LabelProperty: React.FC<{ label?: React.ReactNode; action?: React.ReactNode }> = ({ label, action }) => {
  const theme = useTheme();
  // Matches the host app's form labels (12.5px / 600). Previously this was an
  // unsized <p> at `bold`, so it inherited 16px/700 and towered over the
  // controls it labelled.
  //
  // The margin is 2px rather than the app's 6px because the control rows here
  // contribute ~5px of their own leading; 6px measured as an 11px gap.
  const labelStyle: React.CSSProperties = {
    fontSize: '12.5px',
    fontWeight: 600,
    lineHeight: 1.4,
    color: theme.palette.text.primary,
  };
  if (label === undefined || label === null || label === '') {
    return null;
  }
  if (!action) {
    return <p style={{ ...labelStyle, marginBottom: 0 }}>{label}</p>;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <p style={{ ...labelStyle, margin: 0 }}>{label}</p>
      {action}
    </Box>
  );
};

export default LabelProperty;
