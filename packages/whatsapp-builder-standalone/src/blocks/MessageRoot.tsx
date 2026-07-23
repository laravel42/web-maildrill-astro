import React from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Typography } from '@mui/material';

import EditorBlockById from '../documents/editor/EditorBlockById';
import { useRootChildrenIds } from '../documents/editor/EditorContext';
import type { WhatsAppMessageProps } from '../documents/schemas';

/**
 * The message bubble — WhatsApp's analogue of `EmailLayout`. Renders
 * the ordered sections inside a chat bubble with the classic tail and
 * timestamp. All colors are WhatsApp's own (via CSS vars set by
 * PhoneFrame) — nothing here is user-stylable, by design.
 */
export default function MessageRoot(_props: WhatsAppMessageProps & { blockId?: string; isNotClient?: boolean }) {
  const { t } = useTranslation('waInspector');
  const childrenIds = useRootChildrenIds();

  const now = new Date();
  const timestamp = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <Box
      sx={{
        position: 'relative',
        maxWidth: 340,
        minWidth: 200,
        bgcolor: 'var(--wa-bubble)',
        color: 'var(--wa-text)',
        borderRadius: '8px',
        borderTopLeftRadius: 0,
        boxShadow: '0 1px 0.5px rgba(11,20,26,0.13)',
        p: 0.5,
        pb: 0.75,
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: -8,
          width: 8,
          height: 13,
          bgcolor: 'var(--wa-bubble)',
          clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
        },
      }}
    >
      {childrenIds.length === 0 ? (
        <Typography
          sx={{ px: 1, py: 2, fontSize: 13, color: 'var(--wa-muted)', textAlign: 'center', fontStyle: 'italic' }}
        >
          {t('canvas.emptyMessage')}
        </Typography>
      ) : (
        childrenIds.map((id) => <EditorBlockById key={id} id={id} />)
      )}
      <Typography
        component="span"
        sx={{
          display: 'block',
          textAlign: 'right',
          fontSize: 11,
          lineHeight: 1,
          color: 'var(--wa-muted)',
          px: 0.75,
          pt: 0.25,
        }}
      >
        {timestamp}
      </Typography>
    </Box>
  );
}
