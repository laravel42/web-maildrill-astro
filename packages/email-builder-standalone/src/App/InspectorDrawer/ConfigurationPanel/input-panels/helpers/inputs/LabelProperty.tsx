import React from 'react';

import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';

const LabelProperty: React.FC<{ label?: React.ReactNode; action?: React.ReactNode }> = ({
  label,
  action,
}) => {
  const theme = useTheme();
  // Matches the host app's form labels (12.5px / 600). Previously this was an
  // unsized <p> at `bold`, so it inherited 16px/700 and towered over the
  // controls it labelled.
  //
  // 6px bottom margin — the label-to-control gap the design calls for
  // (4-6px). Set directly rather than relying on a control's own leading.
  const labelStyle: React.CSSProperties = {
    fontSize: '12.5px',
    fontWeight: 600,
    lineHeight: 1.4,
    color: theme.palette.text.primary,
    marginBottom: '6px',
  };
  if (label === undefined || label === null || label === '') {
    return null;
  }
  if (!action) {
    return <p style={{ ...labelStyle, margin: 0, marginBottom: '6px' }}>{label}</p>;
  }
  // With an action (the theme panel's per-field reset button), the row's
  // 32px-tall IconButton — not the ~18px label text — was setting the row
  // height. The row itself carries no bottom margin now (margin on a
  // flex-end row still measures from the tallest child, the button, not
  // the label text, which kept producing more than the intended 6px gap
  // to the input below). Spacing to the input is left to the input's own
  // layout.
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
        minHeight: 0,
      }}
    >
      <p style={{ ...labelStyle, margin: 0 }}>{label}</p>
      {action}
    </Box>
  );
};

export default LabelProperty;
