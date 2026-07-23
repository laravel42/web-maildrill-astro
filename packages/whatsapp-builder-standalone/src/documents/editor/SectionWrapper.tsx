import React from 'react';
import { useTranslation } from 'react-i18next';

import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import { Box, IconButton, Tooltip } from '@mui/material';

import type { SectionType } from '../schemas';
import {
  removeBlock,
  setSelectedBlockId,
  useDisableEdition,
  useSelectedBlockId,
  useSelectedMainTab,
} from './EditorContext';

/**
 * Canvas selection chrome for one message section — the WhatsApp
 * analogue of the email builder's `EditorBlockWrapper`, minus drag
 * (section order is fixed by WhatsApp, so there is nothing to drag).
 * Renders bare children outside the editor tab.
 */
export default function SectionWrapper({
  blockId,
  type,
  children,
}: {
  blockId: string;
  type: SectionType;
  children: React.ReactNode;
}) {
  const { t } = useTranslation('waInspector');
  const selectedId = useSelectedBlockId();
  const mainTab = useSelectedMainTab();
  const disabled = useDisableEdition();

  if (mainTab !== 'editor' || disabled) return <>{children}</>;

  const selected = selectedId === blockId;

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        setSelectedBlockId(blockId);
      }}
      sx={{
        position: 'relative',
        cursor: 'pointer',
        borderRadius: 1,
        outline: selected ? '2px solid' : '2px solid transparent',
        outlineColor: selected ? 'primary.main' : 'transparent',
        outlineOffset: '1px',
        transition: 'outline-color 120ms',
        '&:hover': { outlineColor: selected ? 'primary.main' : 'action.disabled' },
        '&:hover .wa-section-actions': { opacity: 1 },
      }}
    >
      {children}
      <Box
        className="wa-section-actions"
        sx={{
          position: 'absolute',
          top: -10,
          right: -6,
          opacity: selected ? 1 : 0,
          transition: 'opacity 120ms',
          zIndex: 2,
        }}
      >
        <Tooltip title={t('canvas.removeSection', { section: t(`sections.${type.toLowerCase()}`) })}>
          <IconButton
            size="small"
            aria-label={t('canvas.removeSection', { section: t(`sections.${type.toLowerCase()}`) })}
            onClick={(e) => {
              e.stopPropagation();
              removeBlock(blockId);
            }}
            sx={{
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              boxShadow: 1,
              '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' },
            }}
          >
            <DeleteOutlineOutlined sx={{ fontSize: 14 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
