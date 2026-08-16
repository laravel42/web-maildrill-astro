import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FormatColorText } from '@mui/icons-material';
import type { Editor } from '@tiptap/react';

import PickerColor from '../../../email-builder-standalone/src/App/InspectorDrawer/ConfigurationPanel/input-panels/helpers/inputs/ColorInput/Picker';

import ToolbarIconButton from './ToolbarIconButton';
import ToolbarPopover from './ToolbarPopover';

type Props = { editor: Editor };

export default function ColorPickerButton({ editor }: Props) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const currentColor = editor.getAttributes('textStyle').color || '#000000';

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
          editor.chain().focus().setColor(color).run();
        } else {
          editor.chain().focus().unsetColor().run();
        }
      });
    },
    [editor],
  );

  return (
    <>
      <ToolbarIconButton
        tooltip={t('bubbleMenu.textColor')}
        active={editor.isActive('textStyle')}
        onClick={handleClick}
      >
        <FormatColorText fontSize="small" sx={{ color: currentColor }} />
      </ToolbarIconButton>

      <ToolbarPopover anchorEl={anchor} onClose={handleClose} disableAutoFocus>
        <PickerColor value={currentColor} nullable={true} onChange={handleChange} />
      </ToolbarPopover>
    </>
  );
}
