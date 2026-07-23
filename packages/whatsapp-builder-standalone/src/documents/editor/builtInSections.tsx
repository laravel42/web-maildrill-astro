import React from 'react';

import CallToActionOutlined from '@mui/icons-material/CallToActionOutlined';
import NotesOutlined from '@mui/icons-material/NotesOutlined';
import TitleOutlined from '@mui/icons-material/TitleOutlined';
import VerticalAlignBottomOutlined from '@mui/icons-material/VerticalAlignBottomOutlined';

import type { SectionType, TWhatsAppBlock } from '../schemas';

/**
 * Palette entries — the WhatsApp analogue of the email builder's
 * `builtInBlocks.tsx` factories. Content-only seeds: schema
 * `.default(...)`s supply everything else (same rule as email: never
 * duplicate defaults in factories).
 */
export type SectionEntry = {
  type: SectionType;
  labelKey: string;
  descriptionKey: string;
  icon: React.ReactElement;
  block: () => TWhatsAppBlock;
};

export const SECTIONS: SectionEntry[] = [
  {
    type: 'Header',
    labelKey: 'palette.header.label',
    descriptionKey: 'palette.header.description',
    icon: <TitleOutlined fontSize="small" />,
    block: () => ({ type: 'Header', data: { props: { format: 'text', text: '' } } }),
  },
  {
    type: 'Body',
    labelKey: 'palette.body.label',
    descriptionKey: 'palette.body.description',
    icon: <NotesOutlined fontSize="small" />,
    block: () => ({ type: 'Body', data: { props: { text: '' } } }),
  },
  {
    type: 'Footer',
    labelKey: 'palette.footer.label',
    descriptionKey: 'palette.footer.description',
    icon: <VerticalAlignBottomOutlined fontSize="small" />,
    block: () => ({ type: 'Footer', data: { props: { text: '' } } }),
  },
  {
    type: 'Buttons',
    labelKey: 'palette.buttons.label',
    descriptionKey: 'palette.buttons.description',
    icon: <CallToActionOutlined fontSize="small" />,
    block: () => ({
      type: 'Buttons',
      data: { props: { buttons: [{ type: 'QUICK_REPLY', text: '', url: '', phoneNumber: '', couponCode: '' }] } },
    }),
  },
];
