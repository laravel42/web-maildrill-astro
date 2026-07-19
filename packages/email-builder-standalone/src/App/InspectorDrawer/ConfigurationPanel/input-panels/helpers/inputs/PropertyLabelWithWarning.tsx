import React from 'react';

import { Box, IconButton, Tooltip } from '@mui/material';

import LabelProperty from './LabelProperty';
import { WarningIcon } from './WarningIcon';

type Props = {
  label: React.ReactNode;
  tooltipTitle: React.ReactNode;
  hideWarning?: boolean;
};

export default function PropertyLabelWithWarning({ label, tooltipTitle, hideWarning }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
      <LabelProperty label={label} />
      {!hideWarning && (
        <Tooltip title={tooltipTitle} placement="top">
          <IconButton
            size="small"
            color="warning"
            disableRipple
            sx={{
              p: 0,
              cursor: 'help',
              lineHeight: 0,
              '&:hover': {
                backgroundColor: 'transparent',
              },
            }}
          >
            <WarningIcon aria-hidden />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}
