import React from 'react';
import { useTranslation } from 'react-i18next';

import CheckCircleOutlined from '@mui/icons-material/CheckCircleOutlined';
import { Box, ButtonBase, Typography } from '@mui/material';

import { SECTIONS } from '../../documents/editor/builtInSections';
import { addSection, useDocument, useRootChildrenIds } from '../../documents/editor/EditorContext';

/**
 * Left rail — the WhatsApp analogue of the Components Library. Because
 * a template has a fixed section grammar (header? body footer? buttons?)
 * with at most one instance each, this is a click-to-add checklist
 * rather than a drag-source gallery: added sections show as done and
 * disable, order is enforced by the store.
 */
export default function BlocksPalette() {
  const { t } = useTranslation('waInspector');
  const document = useDocument();
  const childrenIds = useRootChildrenIds();

  const presentTypes = new Set(childrenIds.map((id) => document[id]?.type));

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: 1.5,
        display: { xs: 'none', md: 'block' },
        overflowY: 'auto',
      }}
    >
      <Typography variant="overline" sx={{ color: 'text.secondary', px: 0.5 }}>
        {t('palette.title')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
        {SECTIONS.map((entry) => {
          const added = presentTypes.has(entry.type);
          return (
            <ButtonBase
              key={entry.type}
              disabled={added}
              onClick={() => addSection(entry.type, entry.block())}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1,
                p: 1.25,
                borderRadius: 1.5,
                border: '1px solid',
                borderColor: added ? 'success.light' : 'divider',
                bgcolor: added ? 'action.hover' : 'background.paper',
                textAlign: 'left',
                justifyContent: 'flex-start',
                transition: 'border-color 120ms, background-color 120ms',
                '&:hover': { borderColor: added ? 'success.light' : 'primary.main' },
              }}
            >
              <Box sx={{ color: added ? 'success.main' : 'text.secondary', display: 'flex', pt: 0.25 }}>
                {added ? <CheckCircleOutlined fontSize="small" /> : entry.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{t(entry.labelKey)}</Typography>
                <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }}>{t(entry.descriptionKey)}</Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
