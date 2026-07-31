import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

import { CropSquareOutlined, FormatUnderlined, LinkOutlined } from '@mui/icons-material';
import { Box } from '@mui/material';

import EmailLayoutPropsSchema, {
  EmailLayoutProps,
} from '../../../../documents/blocks/EmailLayout/EmailLayoutPropsSchema';
import { DEFAULT_FONT } from '../../../../documents/blocks/helpers/fontFamily';

import ColorInput from './helpers/inputs/ColorInput';
import LinkUnderlineInput from './helpers/inputs/ColorInput/LinkUnderlineInput';
import CompactableInput from './helpers/inputs/CompactableInput';
import { NullableFontFamily } from './helpers/inputs/FontFamily';
import {
  BackgroundColorIcon,
  FontFamilyIcon,
  TextColorIcon,
} from './helpers/style-inputs/SingleStylePropertyPanel';

type EmailLayoutSidebarFieldsProps = {
  data: EmailLayoutProps;
  setData: (v: EmailLayoutProps) => void;
};

export default function EmailLayoutSidebarFields({ data, setData }: EmailLayoutSidebarFieldsProps) {
  const [, setErrors] = useState<ZodError | null>(null);
  const { t } = useTranslation('inspector');

  const updateData = (d: unknown) => {
    const res = EmailLayoutPropsSchema.safeParse(d);
    if (res.success) {
      setData(res.data);
      setErrors(null);
    } else {
      setErrors(res.error);
    }
  };

  // Box, not Stack — theme.ts's MuiStack styleOverrides forces
  // `margin: 0 !important` on every Stack's children workspace-wide (see
  // BaseSidebarPanel.tsx). gap: 2 (1rem) matches the between-property
  // spacing used everywhere else in the inspector.
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <CompactableInput
        icon={BackgroundColorIcon}
        label={t('inputs.panels.emailLayout.backgroundColor')}
      >
        <ColorInput
          label={t('inputs.panels.emailLayout.backgroundColor')}
          defaultValue={data.backdropColor ?? '#F5F5F5'}
          onChange={(backdropColor) => updateData({ ...data, backdropColor })}
        />
      </CompactableInput>

      <CompactableInput
        icon={CropSquareOutlined}
        label={t('inputs.panels.emailLayout.canvasColor')}
      >
        <ColorInput
          label={t('inputs.panels.emailLayout.canvasColor')}
          defaultValue={data.canvasColor ?? '#FFFFFF'}
          onChange={(canvasColor) => updateData({ ...data, canvasColor })}
        />
      </CompactableInput>

      <CompactableInput icon={FontFamilyIcon} label={t('inputs.panels.emailLayout.fontFamily')}>
        <NullableFontFamily
          label={t('inputs.panels.emailLayout.fontFamily')}
          defaultValue={(data.fontFamily as string) || DEFAULT_FONT.FAMILY}
          onChange={(fontFamily) => updateData({ ...data, fontFamily })}
        />
      </CompactableInput>

      <CompactableInput icon={TextColorIcon} label={t('inputs.panels.emailLayout.textColor')}>
        <ColorInput
          label={t('inputs.panels.emailLayout.textColor')}
          defaultValue={data.textColor ?? '#262626'}
          onChange={(textColor) => updateData({ ...data, textColor })}
        />
      </CompactableInput>

      <CompactableInput icon={LinkOutlined} label={t('inputs.links.color')}>
        <ColorInput
          label={t('inputs.links.color')}
          defaultValue={data.linkGlobal?.linkColor || '#000000'}
          onChange={(linkColor) =>
            updateData({
              ...data,
              linkGlobal: { linkColor, underline: data.linkGlobal?.underline ?? false },
            })
          }
        />
      </CompactableInput>

      <CompactableInput icon={FormatUnderlined} label={t('inputs.links.underline')}>
        <LinkUnderlineInput
          label={t('inputs.links.underline')}
          underline={data.linkGlobal?.underline || false}
          onChange={(underline) =>
            updateData({
              ...data,
              linkGlobal: { linkColor: data.linkGlobal?.linkColor ?? '#000000', underline },
            })
          }
        />
      </CompactableInput>
    </Box>
  );
}
