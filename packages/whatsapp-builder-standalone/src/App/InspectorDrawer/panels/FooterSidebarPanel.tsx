import React from 'react';
import { useTranslation } from 'react-i18next';

import { Stack } from '@mui/material';

import { updateBlockData } from '../../../documents/editor/EditorContext';
import type { FooterProps } from '../../../documents/schemas';
import { LIMITS } from '../../../documents/whatsapp';
import CharCountedField from '../inputs/CharCountedField';

export default function FooterSidebarPanel({ blockId, data }: { blockId: string; data: FooterProps }) {
  const { t } = useTranslation('waInspector');

  return (
    <Stack spacing={2}>
      <CharCountedField
        label={t('footer.text')}
        value={data.props?.text ?? ''}
        max={LIMITS.FOOTER_TEXT_MAX}
        onChange={(v) =>
          updateBlockData(blockId, (block) => {
            const d = block.data as FooterProps;
            return { ...d, props: { ...(d.props ?? {}), text: v } } as FooterProps;
          })
        }
        helperText={t('footer.hint')}
      />
    </Stack>
  );
}
