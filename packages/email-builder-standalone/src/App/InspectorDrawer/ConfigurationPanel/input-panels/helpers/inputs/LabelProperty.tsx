import React from 'react';

import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const LabelProperty: React.FC<{ label?: React.ReactNode; action?: React.ReactNode }> = ({ label, action }) => {
  const theme = useTheme();
  if (label === undefined || label === null || label === '') {
    return null;
  }
  if (!action) {
    return <p style={{ fontWeight: 'bold', color: theme.palette.text.primary, marginBottom: '4px' }}>{label}</p>;
  }
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <p style={{ fontWeight: 'bold', color: theme.palette.text.primary, margin: 0 }}>{label}</p>
      {action}
    </Box>
  );
};

export default LabelProperty;
