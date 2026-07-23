import React from 'react';
import { useTranslation } from 'react-i18next';

import ErrorOutlineOutlined from '@mui/icons-material/ErrorOutlineOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material';

import { updateBlockData, useDocument } from '../../../documents/editor/EditorContext';
import { validateWhatsAppDocument } from '../../../documents/validation';
import { WA_CATEGORIES, WA_LANGUAGES } from '../../../documents/whatsapp';

/**
 * Message-level settings (root block): Meta language + category, plus a
 * live validation summary against WhatsApp Business template rules.
 */
export default function MessageSidebarPanel() {
  const { t } = useTranslation('waInspector');
  const document = useDocument();
  const root = document.root;
  const rootData = root && root.type === 'WhatsAppMessage' ? root.data : undefined;

  const issues = validateWhatsAppDocument(document);

  const setRootField = (field: 'language' | 'category', value: string) => {
    updateBlockData('root', (block) => ({ ...block.data, [field]: value }) as typeof block.data);
  };

  return (
    <Stack spacing={2}>
      <TextField
        select
        size="small"
        fullWidth
        label={t('message.category')}
        value={rootData?.category ?? 'MARKETING'}
        onChange={(e) => setRootField('category', e.target.value)}
        helperText={t('message.categoryHint')}
      >
        {WA_CATEGORIES.map((c) => (
          <MenuItem key={c} value={c}>
            {t(`message.categories.${c}`)}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        size="small"
        fullWidth
        label={t('message.language')}
        value={rootData?.language ?? 'en'}
        onChange={(e) => setRootField('language', e.target.value)}
      >
        {WA_LANGUAGES.map((l) => (
          <MenuItem key={l} value={l}>
            {l}
          </MenuItem>
        ))}
      </TextField>

      {issues.length === 0 ? (
        <Alert icon={<TaskAltOutlined fontSize="small" />} severity="success" sx={{ fontSize: 12.5 }}>
          {t('validation.allGood')}
        </Alert>
      ) : (
        <Alert icon={<ErrorOutlineOutlined fontSize="small" />} severity="warning" sx={{ fontSize: 12.5 }}>
          <Typography sx={{ fontSize: 'inherit', fontWeight: 600, mb: 0.5 }}>
            {t('validation.title', { count: issues.length })}
          </Typography>
          <ul style={{ margin: 0, paddingInlineStart: 16 }}>
            {issues.map((issue, i) => (
              <li key={i}>{t(`validation.${issue.key}`, issue.params)}</li>
            ))}
          </ul>
        </Alert>
      )}
    </Stack>
  );
}
