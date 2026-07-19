import React from 'react';
import { useTranslation } from 'react-i18next';

import { IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';

import { toggleComponentTree, useComponentTreeOpen } from '../../documents/editor/EditorContext';

export default function ToggleComponentTreeButton() {
  const { t } = useTranslation('inspector');
  const componentTreeOpen = useComponentTreeOpen();

  const handleClick = () => {
    toggleComponentTree();
  };

  const label = componentTreeOpen
    ? t('header.closeComponentTree', 'Close component tree')
    : t('header.openComponentTree', 'Open component tree');

  return (
    <Tooltip title={label} placement="bottom">
      <IconButton
        onClick={handleClick}
        size="small"
        aria-label={label}
        data-component-tree-toggle="true"
        sx={(theme) => ({
          color: componentTreeOpen ? theme.palette.primary.main : theme.palette.text.primary,
          '&:hover': {
            color: componentTreeOpen ? theme.palette.primary.dark : theme.palette.primary.dark,
            backgroundColor: `${alpha(theme.palette.primary.main, 0.08)}`,
          },
        })}
      >
        {componentTreeOpen ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            width="20px"
            viewBox="0 -960 960 960"
            fill="currentColor"
          >
            <path d="M480-400 40-640l440-240 440 240-440 240Zm0 160L63-467l84-46 333 182 333-182 84 46-417 227Zm0 160L63-307l84-46 333 182 333-182 84 46L480-80Zm0-411 273-149-273-149-273 149 273 149Zm0-149Z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            height="20px"
            width="20px"
            viewBox="0 -960 960 960"
            fill="currentColor"
          >
            <path d="M480-400 40-640l440-240 440 240-440 240Zm0 160L63-467l84-46 333 182 333-182 84 46-417 227Zm0 160L63-307l84-46 333 182 333-182 84 46L480-80Zm0-411 273-149-273-149-273 149 273 149Zm0-149Z" />
          </svg>
        )}
      </IconButton>
    </Tooltip>
  );
}
