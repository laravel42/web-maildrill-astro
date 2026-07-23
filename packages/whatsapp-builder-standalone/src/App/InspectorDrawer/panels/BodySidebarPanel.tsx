import React from 'react';
import { useTranslation } from 'react-i18next';

import AddOutlined from '@mui/icons-material/AddOutlined';
import { Button, Stack, TextField, Typography } from '@mui/material';

import { updateBlockData } from '../../../documents/editor/EditorContext';
import type { BodyProps } from '../../../documents/schemas';
import { extractVariables, LIMITS } from '../../../documents/whatsapp';
import CharCountedField from '../inputs/CharCountedField';

export default function BodySidebarPanel({ blockId, data }: { blockId: string; data: BodyProps }) {
  const { t } = useTranslation('waInspector');
  const props = data.props ?? {};
  const text = props.text ?? '';
  const examples = props.examples ?? [];

  const usedVars = [...new Set(extractVariables(text))].sort((a, b) => a - b);
  const nextVar = usedVars.length > 0 ? Math.max(...usedVars) + 1 : 1;

  const update = (patch: Partial<NonNullable<BodyProps['props']>>) => {
    updateBlockData(blockId, (block) => {
      const d = block.data as BodyProps;
      return { ...d, props: { ...(d.props ?? {}), ...patch } } as BodyProps;
    });
  };

  return (
    <Stack spacing={2}>
      <CharCountedField
        label={t('body.text')}
        value={text}
        max={LIMITS.BODY_TEXT_MAX}
        onChange={(v) => update({ text: v })}
        multiline
        minRows={6}
        // Literal (not via t()): the string teaches WhatsApp's exact {{1}}
        // syntax, which i18next would swallow as an interpolation slot.
        placeholder={'Hi {{1}}, your order has shipped!'}
        helperText={t('body.formattingHint')}
      />

      <Button
        size="small"
        variant="outlined"
        startIcon={<AddOutlined fontSize="small" />}
        onClick={() => update({ text: `${text}{{${nextVar}}}` })}
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}
      >
        {t('body.insertVariable', { n: nextVar })}
      </Button>

      {usedVars.length > 0 && (
        <Stack spacing={1}>
          <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: 'text.secondary' }}>
            {t('body.examplesTitle')}
          </Typography>
          {usedVars.map((n) => (
            <TextField
              key={n}
              size="small"
              fullWidth
              label={`{{${n}}}`}
              value={examples[n - 1] ?? ''}
              onChange={(e) => {
                const next = [...examples];
                while (next.length < n) next.push('');
                next[n - 1] = e.target.value;
                update({ examples: next });
              }}
              helperText={n === usedVars[usedVars.length - 1] ? t('body.examplesHint') : undefined}
            />
          ))}
        </Stack>
      )}
    </Stack>
  );
}
