import React from 'react';
import { useTranslation } from 'react-i18next';

import { MenuItem, Stack, TextField } from '@mui/material';

import { updateBlockData } from '../../../documents/editor/EditorContext';
import type { HeaderProps } from '../../../documents/schemas';
import { HEADER_FORMATS, LIMITS } from '../../../documents/whatsapp';
import CharCountedField from '../inputs/CharCountedField';

export default function HeaderSidebarPanel({ blockId, data }: { blockId: string; data: HeaderProps }) {
  const { t } = useTranslation('waInspector');
  const props = data.props ?? {};
  const format = props.format ?? 'text';

  const setProp = (name: string, value: string) => {
    updateBlockData(blockId, (block) => {
      const d = block.data as HeaderProps;
      return { ...d, props: { ...(d.props ?? {}), [name]: value } } as HeaderProps;
    });
  };

  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label={t('header.format')}
        value={format}
        onChange={(e) => setProp('format', e.target.value)}
      >
        {HEADER_FORMATS.map((f) => (
          <MenuItem key={f} value={f}>
            {t(`header.formats.${f}`)}
          </MenuItem>
        ))}
      </TextField>

      {format === 'text' && (
        <CharCountedField
          label={t('header.text')}
          value={props.text ?? ''}
          max={LIMITS.HEADER_TEXT_MAX}
          onChange={(v) => setProp('text', v)}
          helperText={t('header.textHint')}
        />
      )}

      {(format === 'image' || format === 'video' || format === 'document') && (
        <TextField
          size="small"
          fullWidth
          label={t('header.mediaUrl')}
          value={props.mediaUrl ?? ''}
          onChange={(e) => setProp('mediaUrl', e.target.value)}
          placeholder="https://…"
          helperText={t('header.mediaUrlHint')}
        />
      )}

      {format === 'location' && (
        <>
          <TextField
            size="small"
            fullWidth
            label={t('header.locationName')}
            value={props.locationName ?? ''}
            onChange={(e) => setProp('locationName', e.target.value)}
          />
          <TextField
            size="small"
            fullWidth
            label={t('header.locationAddress')}
            value={props.locationAddress ?? ''}
            onChange={(e) => setProp('locationAddress', e.target.value)}
          />
        </>
      )}
    </Stack>
  );
}
