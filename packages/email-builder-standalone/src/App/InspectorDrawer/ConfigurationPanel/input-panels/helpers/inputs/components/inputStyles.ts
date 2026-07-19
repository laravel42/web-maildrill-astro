import { SxProps, Theme } from '@mui/material';

import { RADIUS_INPUT } from '../../../../../../../constants';

export const INPUT_HEIGHT = 36;
export const BORDER_RADIUS = RADIUS_INPUT;
// Common styles for single-line MUI TextField inputs
export const INPUT_TEXTFIELD_SX: SxProps<Theme> = {
  width: '100%',
  '& .MuiInputBase-root': {
    // Apply fixed height only for non-multiline inputs
    '&:not(.MuiInputBase-multiline)': {
      height: `${INPUT_HEIGHT}px`,
    },
  },
  '& .MuiOutlinedInput-root': {
    borderRadius: `${BORDER_RADIUS}px`,
    '&:not(.MuiInputBase-multiline)': {
      height: `${INPUT_HEIGHT}px`,
    },
  },
  '& .MuiInputBase-input': {
    paddingTop: '8px',
    paddingBottom: '8px',
    paddingLeft: '12px',
    paddingRight: '12px',
    height: 'unset',
  },
};
// Container styles for controls like Switch to match target spacing
export const INPUT_CONTAINER_SX: SxProps<Theme> = {
  width: '100%',
  height: `${INPUT_HEIGHT}px`,
  paddingTop: '8px',
  paddingBottom: '8px',
  paddingLeft: '12px',
  paddingRight: '12px',
  display: 'flex',
  alignItems: 'center',
  borderRadius: `${BORDER_RADIUS}px`,
};
