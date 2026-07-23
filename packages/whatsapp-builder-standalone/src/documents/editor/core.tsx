import React from 'react';

import { buildBlockComponent, buildBlockConfigurationDictionary } from '@eb/document-core';

import BodyBlock from '../../blocks/BodyBlock';
import ButtonsBlock from '../../blocks/ButtonsBlock';
import FooterBlock from '../../blocks/FooterBlock';
import HeaderBlock from '../../blocks/HeaderBlock';
import MessageRoot from '../../blocks/MessageRoot';
import {
  BodyPropsSchema,
  ButtonsPropsSchema,
  FooterPropsSchema,
  HeaderPropsSchema,
  WhatsAppMessagePropsSchema,
} from '../schemas';

/**
 * The editor dictionary — same registration pattern as the email
 * builder's `core.tsx`: `{ [type]: { schema, Component } }` fed to
 * `buildBlockComponent` from `@eb/document-core` (the builders are
 * fully generic; only the schema set is channel-specific).
 *
 * Selection/removal chrome lives in the canvas (`SectionWrapper`), not
 * here, because WhatsApp sections are a fixed, non-draggable list.
 */
const EDITOR_DICTIONARY = buildBlockConfigurationDictionary({
  WhatsAppMessage: {
    schema: WhatsAppMessagePropsSchema,
    Component: (props) => <MessageRoot {...props} />,
  },
  Header: {
    schema: HeaderPropsSchema,
    Component: (props) => <HeaderBlock {...props} />,
  },
  Body: {
    schema: BodyPropsSchema,
    Component: (props) => <BodyBlock {...props} />,
  },
  Footer: {
    schema: FooterPropsSchema,
    Component: (props) => <FooterBlock {...props} />,
  },
  Buttons: {
    schema: ButtonsPropsSchema,
    Component: (props) => <ButtonsBlock {...props} />,
  },
});

export const EditorBlock = buildBlockComponent(EDITOR_DICTIONARY);

export type { TWhatsAppBlock, TWhatsAppConfiguration } from '../schemas';
