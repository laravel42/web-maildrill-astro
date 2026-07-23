import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AddOutlined from '@mui/icons-material/AddOutlined';
import ArrowDownwardOutlined from '@mui/icons-material/ArrowDownwardOutlined';
import ArrowUpwardOutlined from '@mui/icons-material/ArrowUpwardOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { Box, Button, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';

import { updateBlockData } from '../../../documents/editor/EditorContext';
import type { ButtonsProps, WaButton } from '../../../documents/schemas';
import { BUTTON_TYPES, LIMITS, maxForButtonType, type WaButtonType } from '../../../documents/whatsapp';
import CharCountedField from '../inputs/CharCountedField';

const emptyButton = (type: WaButtonType): WaButton => ({
  type,
  text: '',
  url: '',
  phoneNumber: '',
  couponCode: '',
});

export default function ButtonsSidebarPanel({ blockId, data }: { blockId: string; data: ButtonsProps }) {
  const { t } = useTranslation('waInspector');
  const buttons = data.props?.buttons ?? [];
  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null);

  const setButtons = (next: WaButton[]) => {
    updateBlockData(blockId, (block) => {
      const d = block.data as ButtonsProps;
      return { ...d, props: { ...(d.props ?? {}), buttons: next } } as ButtonsProps;
    });
  };

  const updateButton = (i: number, patch: Partial<WaButton>) => {
    setButtons(buttons.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= buttons.length) return;
    const next = [...buttons];
    [next[i], next[j]] = [next[j], next[i]];
    setButtons(next);
  };

  const countOf = (type: WaButtonType) => buttons.filter((b) => b.type === type).length;
  const canAdd = (type: WaButtonType) => buttons.length < LIMITS.MAX_BUTTONS && countOf(type) < maxForButtonType(type);

  return (
    <Stack spacing={2}>
      {buttons.map((b, i) => (
        <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.secondary' }}>
              {t(`buttons.types.${b.type}`)}
            </Typography>
            <Stack direction="row" spacing={0}>
              <Tooltip title={t('buttons.moveUp')}>
                <span>
                  <IconButton size="small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('buttons.moveUp')}>
                    <ArrowUpwardOutlined sx={{ fontSize: 15 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('buttons.moveDown')}>
                <span>
                  <IconButton
                    size="small"
                    onClick={() => move(i, 1)}
                    disabled={i === buttons.length - 1}
                    aria-label={t('buttons.moveDown')}
                  >
                    <ArrowDownwardOutlined sx={{ fontSize: 15 }} />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={t('buttons.remove')}>
                <IconButton
                  size="small"
                  onClick={() => setButtons(buttons.filter((_, idx) => idx !== i))}
                  aria-label={t('buttons.remove')}
                >
                  <DeleteOutlineOutlined sx={{ fontSize: 15 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          <Stack spacing={1.5}>
            {b.type !== 'COPY_CODE' && (
              <CharCountedField
                label={t('buttons.label')}
                value={b.text ?? ''}
                max={LIMITS.BUTTON_TEXT_MAX}
                onChange={(v) => updateButton(i, { text: v })}
              />
            )}
            {b.type === 'URL' && (
              <TextField
                size="small"
                fullWidth
                label={t('buttons.url')}
                value={b.url ?? ''}
                onChange={(e) => updateButton(i, { url: e.target.value })}
                placeholder="https://…"
                helperText={t('buttons.urlHint')}
              />
            )}
            {b.type === 'PHONE_NUMBER' && (
              <TextField
                size="small"
                fullWidth
                label={t('buttons.phone')}
                value={b.phoneNumber ?? ''}
                onChange={(e) => updateButton(i, { phoneNumber: e.target.value })}
                placeholder="+1 555 0100"
              />
            )}
            {b.type === 'COPY_CODE' && (
              <CharCountedField
                label={t('buttons.code')}
                value={b.couponCode ?? ''}
                max={LIMITS.BUTTON_CODE_MAX}
                onChange={(v) => updateButton(i, { couponCode: v })}
              />
            )}
          </Stack>
        </Box>
      ))}

      <Button
        size="small"
        variant="outlined"
        startIcon={<AddOutlined fontSize="small" />}
        disabled={buttons.length >= LIMITS.MAX_BUTTONS}
        onClick={(e) => setAddAnchor(e.currentTarget)}
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        {t('buttons.add')}
      </Button>
      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        {BUTTON_TYPES.map((type) => (
          <MenuItem
            key={type}
            disabled={!canAdd(type)}
            onClick={() => {
              setButtons([...buttons, emptyButton(type)]);
              setAddAnchor(null);
            }}
            sx={{ fontSize: '0.85rem' }}
          >
            {t(`buttons.types.${type}`)}
            {type !== 'QUICK_REPLY' && (
              <Typography component="span" sx={{ ml: 1, fontSize: '0.75rem', color: 'text.secondary' }}>
                {countOf(type)}/{maxForButtonType(type)}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Menu>

      <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>
        {t('buttons.limits', { max: LIMITS.MAX_BUTTONS })}
      </Typography>
    </Stack>
  );
}
