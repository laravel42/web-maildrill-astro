import React from 'react';
import { useTranslation } from 'react-i18next';

import { RestartAltOutlined } from '@mui/icons-material';
import { IconButton, Tooltip } from '@mui/material';

type ResetButtonProps = {
  /** Callback invoked when the user clicks the reset button. */
  onReset: () => void;
  /**
   * When `false`, the button is hidden so the row reserves the same
   * horizontal space whether the field is overridden or not.
   * Hiding instead of disabling keeps the layout calmer — disabled
   * icons clutter the panel when most fields are at default.
   */
  visible: boolean;
};

/**
 * Phase 2c — Inspector Theme panel.
 *
 * Per-property "reset to default" trigger. Removes the override at
 * `root.data.theme.blocks[type][section][key]` so the resolution chain
 * falls through to the block schema's default (level 3).
 *
 * The button is only rendered when `visible` is true; the slot keeps
 * its width via a fixed-size placeholder when hidden so the input row
 * doesn't shift while the user edits a field.
 */
export default function ResetButton({ onReset, visible }: ResetButtonProps) {
  const { t } = useTranslation('inspector');

  if (!visible) {
    return <span aria-hidden="true" style={{ display: 'inline-block', width: 32, height: 32, flexShrink: 0 }} />;
  }

  return (
    <Tooltip title={t('theme.reset')} placement="left">
      <IconButton
        size="small"
        onClick={onReset}
        sx={{
          color: 'primary.main',
          flexShrink: 0,
          width: 32,
          height: 32,
          '&:hover': { backgroundColor: 'action.hover' },
        }}
      >
        <RestartAltOutlined fontSize="small" />
      </IconButton>
    </Tooltip>
  );
}
