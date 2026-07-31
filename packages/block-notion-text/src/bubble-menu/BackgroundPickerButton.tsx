import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatColorFill as BackgroundColorIcon } from '@mui/icons-material';
import { Popover, useTheme } from '@mui/material';
import type { Editor } from '@tiptap/react';

import PickerColor from '../../../email-builder-standalone/src/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/ColorInput/Picker';

import ToolbarIconButton from './ToolbarIconButton';

type Props = { editor: Editor };

export default function BackgroundPickerButton({ editor }: Props) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const currentBackground = editor.getAttributes('textStyle').backgroundColor || 'transparent';
  const hasBackground = Boolean(editor.getAttributes('textStyle').backgroundColor);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchor(event.currentTarget);
  };

  const handleClose = () => {
    setAnchor(null);
  };

  const handleChange = useCallback(
    (color: string | null) => {
      requestAnimationFrame(() => {
        if (color) {
          editor.chain().focus().setBackgroundColor(color).run();
        } else {
          editor.chain().focus().unsetBackgroundColor().run();
        }
      });
    },
    [editor],
  );

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.backgroundColor')}
        active={hasBackground}
        onClick={handleClick}
      >
        <BackgroundColorIcon
          fontSize="small"
          sx={{
            color:
              currentBackground !== 'transparent'
                ? currentBackground
                : theme.palette.text.secondary,
            ...(currentBackground === 'transparent' && {
              opacity: 1,
            }),
          }}
        />
      </ToolbarIconButton>

      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={handleClose}
        disableEnforceFocus
        disableAutoFocus
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <PickerColor value={currentBackground} nullable={true} onChange={handleChange} />
      </Popover>
    </>
  );
}
