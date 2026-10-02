/**
 * ChipsFilterRow — a single-line row of toggleable filter chips with a
 * trailing "+N" overflow chip that opens a Popover listing the rest.
 *
 * Used inside each Components Library accordion to filter by axis
 * (role / type / shape) or by tags without consuming vertical space.
 * Purely controlled: reads `selected` and emits the next selection via
 * `onChange`.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Chip, Popover, Stack, Typography } from '@mui/material';

import { RADIUS_INPUT } from '../../constants';

// Homologado con Builder42 (`.pbx-breadcrumb__btn` / `.pbx-badge--override`,
// packages/builder42/src/styles/chrome/{inspector.css,inspector-controls.css}):
// un chip activo ahí nunca es un relleno sólido con texto blanco tipo
// "pill" — es un fondo tenue con texto del MISMO tono pero intenso, y un
// radio sobrio (--pb-chrome-radius-xs, 8px) en vez de MUI's default
// pill-shaped Chip. Mismos valores que --accent / --accent-tint del host
// (ver theme.ts, APP_ACCENT / APP_ACCENT_TINT).
const ACTIVE_CHIP_BG = '#eef0ff'; // --accent-tint
const ACTIVE_CHIP_TEXT = '#4f46e5'; // --accent
const CHIP_RADIUS = RADIUS_INPUT + 2; // 8px — análogo a --pb-chrome-radius-xs

const activeChipSx = {
  fontSize: '0.7rem',
  height: 22,
  cursor: 'pointer',
  borderRadius: `${CHIP_RADIUS}px`,
  backgroundColor: ACTIVE_CHIP_BG,
  color: ACTIVE_CHIP_TEXT,
  border: '1px solid transparent',
  '& .MuiChip-label': { color: ACTIVE_CHIP_TEXT, fontWeight: 500 },
  '&:hover': { backgroundColor: ACTIVE_CHIP_BG },
};

const inactiveChipSx = {
  fontSize: '0.7rem',
  height: 22,
  cursor: 'pointer',
  borderRadius: `${CHIP_RADIUS}px`,
};

export default function ChipsFilterRow({
  items,
  selected,
  onChange,
  maxVisible = 4,
  labelFor,
  title,
}: {
  /** All available filter values. */
  items: string[];
  /** Currently active values. */
  selected: string[];
  /** Emits the next selection. */
  onChange: (next: string[]) => void;
  /** How many chips to show inline before collapsing the rest into "+N". */
  maxVisible?: number;
  /** Optional label resolver for a chip value (i18n). Defaults to identity. */
  labelFor?: (value: string) => string;
  /** Optional title shown at the top of the overflow popover. */
  title?: string;
}) {
  const { t } = useTranslation('inspector');
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const label = labelFor ?? ((v: string) => v);

  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  // Keep selected chips visible first so an active filter never hides
  // inside the overflow popover.
  const ordered = useMemo(() => {
    const sel = items.filter((i) => selected.includes(i));
    const rest = items.filter((i) => !selected.includes(i));
    return [...sel, ...rest];
  }, [items, selected]);

  if (items.length === 0) return null;

  const visible = ordered.slice(0, maxVisible);
  const overflow = ordered.slice(maxVisible);

  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
      {visible.map((value) => {
        const isActive = selected.includes(value);
        return (
          <Chip
            key={value}
            size="small"
            label={label(value)}
            variant="outlined"
            onClick={() => toggle(value)}
            sx={isActive ? activeChipSx : inactiveChipSx}
          />
        );
      })}

      {overflow.length > 0 && (
        <>
          <Chip
            size="small"
            label={`+${overflow.length}`}
            variant="outlined"
            onClick={(e) => setAnchorEl(e.currentTarget)}
            sx={inactiveChipSx}
          />
          <Popover
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={() => setAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 1, maxWidth: 280 }}>
              {title && (
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ display: 'block', mb: 0.5 }}
                >
                  {title}
                </Typography>
              )}
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {overflow.map((value) => {
                  const isActive = selected.includes(value);
                  return (
                    <Chip
                      key={value}
                      size="small"
                      label={label(value)}
                      variant="outlined"
                      onClick={() => toggle(value)}
                      sx={isActive ? activeChipSx : inactiveChipSx}
                    />
                  );
                })}
              </Stack>
              {selected.length > 0 && (
                <Typography
                  variant="caption"
                  color="primary"
                  onClick={() => onChange([])}
                  sx={{ display: 'block', mt: 1, cursor: 'pointer', textAlign: 'right' }}
                >
                  {t('componentsLibrary.search.clear', 'Clear')}
                </Typography>
              )}
            </Box>
          </Popover>
        </>
      )}
    </Box>
  );
}
