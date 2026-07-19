import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { AddOutlined, FormatColorReset } from '@mui/icons-material';
import { Box, ButtonBase, Menu, Stack, Tooltip } from '@mui/material';

import { RADIUS_INPUT } from '../../../../../../../constants';
import FieldContainer from '../components/FieldContainer';
import LabelProperty from '../LabelProperty';

import Picker from './Picker';

type Props =
  | {
      nullable: true;
      label?: string;
      labelAction?: React.ReactNode;
      onChange: (value: string | null) => void;
      defaultValue: string | null;
      compact?: boolean;
      /**
       * Phase 2c — when set, the input is rendered with a muted visual
       * treatment to signal that the value is inherited from the
       * document theme (`'theme'`) or the block schema default
       * (`'default'`) rather than explicitly set on the block. Editing
       * the input promotes the value to explicit; no special handling
       * is required at the call site.
       */
      inheritedFrom?: 'theme' | 'default';
    }
  | {
      nullable: false;
      label?: string;
      labelAction?: React.ReactNode;
      onChange: (value: string) => void;
      defaultValue: string;
      compact?: boolean;
      inheritedFrom?: 'theme' | 'default';
    };

export default function ColorInput({
  label,
  labelAction,
  defaultValue,
  onChange,
  nullable,
  compact = false,
  inheritedFrom,
}: Props) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [value, setValue] = useState(defaultValue);
  const { t } = useTranslation('inspector');
  useEffect(() => {
    if (value !== defaultValue) {
      setValue(defaultValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- syncs the incoming prop into local state one-way; adding the local value to deps would re-fire and loop
  }, [defaultValue]);

  const handleClickOpen = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const BUTTON_SX = compact
    ? {
        border: '1px solid',
        borderColor: 'cadet.400',
        width: 28,
        height: 28,
        borderRadius: `${RADIUS_INPUT}px`,
        bgcolor: '#FFFFFF',
      }
    : {
        border: label ? '1px solid' : '',
        borderColor: 'cadet.400',
        width: '100%',
        height: 36,
        paddingTop: '8px',
        paddingBottom: '8px',
        paddingLeft: '12px',
        paddingRight: '12px',
        borderRadius: `${RADIUS_INPUT}px`,
        bgcolor: '#FFFFFF',
      };
  const onChangeColor = (color: string) => {
    setValue(color);
    onChange(color);
  };
  const renderResetButton = () => {
    if (!nullable) {
      return null;
    }
    if (typeof value !== 'string' || value.trim().length === 0) {
      return null;
    }
    return (
      <Tooltip title={t('inputs.background.reset')} placement="left">
        <Box
          sx={{ minWidth: 24, lineHeight: 1, flexShrink: 0, pr: '4px', display: 'grid', placeItems: 'center' }}
          onClick={() => onChangeColor(null)}
        >
          <FormatColorReset sx={{ color: 'primary.main' }} />
        </Box>
      </Tooltip>
    );
  };

  const colorButton = value ? (
    <ButtonBase onClick={handleClickOpen} sx={{ ...BUTTON_SX, bgcolor: value }} />
  ) : (
    <ButtonBase onClick={handleClickOpen} sx={{ ...BUTTON_SX }}>
      <AddOutlined fontSize="small" />
    </ButtonBase>
  );

  const menu = (
    <Menu
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={() => setAnchorEl(null)}
      sx={{
        '& .MuiPaper-root': {
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.4);',
          borderRadius: 1,
          maxWidth: '200px',
          transform: 'translateX(-100%) !important;',
        },
      }}
      slotProps={{
        list: {
          sx: {
            height: 'auto',
            padding: 0,
          },
        },
      }}
    >
      <Picker value={value || ''} nullable={nullable} onChange={(v) => onChangeColor(v)} />
    </Menu>
  );

  if (compact) {
    return (
      <Box sx={{ display: 'inline-flex', opacity: inheritedFrom ? 0.55 : 1, transition: 'opacity 120ms ease-out' }}>
        {colorButton}
        {menu}
      </Box>
    );
  }

  return (
    <FieldContainer>
      <LabelProperty label={label} action={labelAction} />
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignContent: 'center', opacity: inheritedFrom ? 0.55 : 1, transition: 'opacity 120ms ease-out' }}
      >
        {colorButton}
        {renderResetButton()}
      </Stack>
      {menu}
    </FieldContainer>
  );
}
