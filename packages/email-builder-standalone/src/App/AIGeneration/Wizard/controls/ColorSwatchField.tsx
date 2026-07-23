import React from 'react';

import { AddOutlined } from '@mui/icons-material';
import { ButtonBase, Menu, Stack, Typography } from '@mui/material';

import { RADIUS_CARD } from '../../../../constants';
import Picker from '../../../InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/ColorInput/Picker';

interface Props {
  label: string;
  value: string;
  onChange: (hex: string) => void;
  /** Swatch height in px. Width always fills the container. */
  height?: number;
}

/**
 * A large color swatch that fills the full width of its slot so the chosen
 * brand colour reads clearly. Opens the shared inspector `Picker` popover on
 * click. Meant to be laid out in an equal-width row (each in a `flex: 1` slot).
 */
export default function ColorSwatchField({ label, value, onChange, height = 64 }: Props) {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const swatchSx = {
    width: '100%',
    height,
    borderRadius: `${RADIUS_CARD}px`,
    border: '1px solid',
    borderColor: value ? 'divider' : 'cadet.400',
    bgcolor: value || 'background.paper',
    color: 'text.secondary',
    borderStyle: value ? 'solid' : 'dashed',
    transition: 'box-shadow 120ms ease-out, border-color 120ms ease-out',
    '&:hover': {
      borderColor: 'text.secondary',
      boxShadow: 2,
    },
  } as const;

  return (
    <Stack spacing={0.75} sx={{ alignItems: 'stretch', width: '100%' }}>
      <ButtonBase aria-label={label} onClick={(e) => setAnchorEl(e.currentTarget)} sx={swatchSx}>
        {!value && <AddOutlined fontSize="small" />}
      </ButtonBase>
      <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
        {label}
      </Typography>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{ list: { sx: { p: 0 } } }}
        sx={{ '& .MuiPaper-root': { borderRadius: 1, maxWidth: 220 } }}
      >
        <Picker value={value || ''} nullable={false} onChange={(v) => onChange(v)} />
      </Menu>
    </Stack>
  );
}
