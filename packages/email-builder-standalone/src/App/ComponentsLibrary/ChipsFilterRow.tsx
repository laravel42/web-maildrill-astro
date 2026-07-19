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
            color={isActive ? 'secondary' : 'default'}
            variant={isActive ? 'filled' : 'outlined'}
            onClick={() => toggle(value)}
            sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
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
            sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
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
                <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
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
                      color={isActive ? 'secondary' : 'default'}
                      variant={isActive ? 'filled' : 'outlined'}
                      onClick={() => toggle(value)}
                      sx={{ fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
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
