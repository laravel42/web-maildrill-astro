/**
 * ThemePresetsButton — palette-icon toolbar button that opens a menu of
 * predefined themes. Selecting one applies it through the existing
 * `applyThemeBundle()` pipeline (single, undoable atomic write).
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { CheckOutlined, PaletteOutlined } from '@mui/icons-material';
import { Box, IconButton, ListItemText, Menu, MenuItem, Stack, Tooltip } from '@mui/material';

import {
  applyThemePreset,
  clearAppliedTheme,
  clearThemeBundle,
  useAppliedThemeId,
} from '../../../documents/editor/EditorContext';

import { THEME_PRESETS, type ThemePreset } from './defaults';
import ThemePresetPreview from './ThemePresetPreview';

export default function ThemePresetsButton() {
  const { t } = useTranslation('inspector');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const appliedThemeId = useAppliedThemeId();

  const handleApply = (preset: ThemePreset) => {
    if (appliedThemeId === preset.id) {
      // Re-clicking the already-selected preset deselects it: reset the
      // document to its base state (theme globals + per-block overrides
      // fall back to schema defaults) so the user can build a fully
      // custom theme from scratch.
      clearThemeBundle();
      clearAppliedTheme();
    } else {
      applyThemePreset(preset.bundle, preset.id);
    }
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t('theme.presets.tooltip', 'Predefined themes')}>
        <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)}>
          <PaletteOutlined fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {THEME_PRESETS.map((preset) => {
          const selected = appliedThemeId === preset.id;
          return (
            <MenuItem
              key={preset.id}
              onClick={() => handleApply(preset)}
              selected={selected}
              sx={{ flexDirection: 'column', alignItems: 'stretch', gap: 0.75, py: 1, minWidth: 200 }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Stack direction="row" spacing={0.5}>
                  {preset.swatch.map((color, i) => (
                    <Box
                      key={i}
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: color,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                  ))}
                </Stack>
                <ListItemText primary={preset.name} sx={{ my: 0 }} />
                {selected && (
                  <CheckOutlined fontSize="small" color="primary" aria-label={t('theme.applied.badge', 'Selected')} />
                )}
              </Stack>
              <ThemePresetPreview preset={preset} />
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
