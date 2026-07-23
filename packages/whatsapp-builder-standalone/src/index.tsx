import React, { forwardRef, useEffect, useImperativeHandle, useMemo } from 'react';
import { I18nextProvider } from 'react-i18next';

import { CssBaseline, ThemeProvider } from '@mui/material';

import App from './App';
import { buildComponents, buildText, type WaTemplateComponents } from './documents/components';
import {
  AUTO_SAVE_EVENT,
  editorStateStore,
  resetDocument,
} from './documents/editor/EditorContext';
import type { TWhatsAppConfiguration } from './documents/schemas';
import { getEmptyWhatsAppMessage } from './getConfiguration';
import i18n, { setLocale } from './i18n';
import { getTheme } from './theme';

/**
 * WhatsAppBuilder — public React component. Mirrors the email
 * builder's contract (`initialDocument`/`data`, `onSave`/`onAutoSave`,
 * imperative ref) with WhatsApp-specific output: instead of
 * `getHtml()`, the ref exposes `getComponents()` (the Meta template
 * `components` payload) and `getText()` (the flattened body).
 */

export interface WhatsAppBuilderProps {
  /** Initial document (builder JSON) or its JSON string. */
  initialDocument?: TWhatsAppConfiguration | string;
  /** Alias of initialDocument for r2wc attribute mapping parity. */
  data?: TWhatsAppConfiguration | string;
  onSave?: (document: TWhatsAppConfiguration) => void;
  /** Debounced (2s) after any edit — same bridge as the email builder. */
  onAutoSave?: (document: TWhatsAppConfiguration) => void;
  locale?: string;
  darkMode?: boolean;
  height?: string;
  /** Business display name shown in the chat header preview. */
  businessName?: string;
  /** Editor-chrome primary color override. */
  primaryColor?: string;
  disableEdition?: boolean;
}

export interface WhatsAppBuilderRef {
  getDocument: () => TWhatsAppConfiguration;
  setDocument: (document: TWhatsAppConfiguration) => void;
  save: () => TWhatsAppConfiguration;
  /** Meta-style template `components` payload for submission/preview. */
  getComponents: () => WaTemplateComponents;
  /** Flattened body text (the host persists it as `ApiTemplate.text`). */
  getText: () => string;
}

function parseDocument(input: TWhatsAppConfiguration | string | undefined): TWhatsAppConfiguration | null {
  if (!input) return null;
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as TWhatsAppConfiguration;
    } catch {
      return null;
    }
  }
  return input;
}

export const WhatsAppBuilder = forwardRef<WhatsAppBuilderRef, WhatsAppBuilderProps>(function WhatsAppBuilder(
  {
    initialDocument,
    data,
    onSave,
    onAutoSave,
    locale,
    darkMode = false,
    height = '100%',
    businessName,
    primaryColor,
    disableEdition = false,
  },
  ref
) {
  // Load the initial document once per identity change.
  useEffect(() => {
    const doc = parseDocument(initialDocument) ?? parseDocument(data);
    resetDocument(doc && doc.root ? doc : getEmptyWhatsAppMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeof initialDocument === 'string' ? initialDocument : initialDocument && JSON.stringify(initialDocument)]);

  useEffect(() => {
    if (locale) void setLocale(locale);
  }, [locale]);

  // Autosave bridge: store dispatches a window event; forward to the host.
  useEffect(() => {
    if (!onAutoSave || typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ document: TWhatsAppConfiguration }>).detail;
      if (detail?.document) onAutoSave(detail.document);
    };
    window.addEventListener(AUTO_SAVE_EVENT, handler);
    return () => window.removeEventListener(AUTO_SAVE_EVENT, handler);
  }, [onAutoSave]);

  useImperativeHandle(
    ref,
    (): WhatsAppBuilderRef => ({
      getDocument: () => editorStateStore.getState().document,
      setDocument: (document) => resetDocument(document),
      save: () => {
        const document = editorStateStore.getState().document;
        onSave?.(document);
        return document;
      },
      getComponents: () => buildComponents(editorStateStore.getState().document),
      getText: () => buildText(editorStateStore.getState().document),
    }),
    [onSave]
  );

  const theme = useMemo(() => getTheme(darkMode, primaryColor), [darkMode, primaryColor]);

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="whatsapp-builder-root" style={{ height }}>
          <App darkMode={darkMode} businessName={businessName} disableEdition={disableEdition} height={height} />
        </div>
      </ThemeProvider>
    </I18nextProvider>
  );
});

export default WhatsAppBuilder;

// ---------------------------------------------------------------------------
// Schema / util re-exports (mirrors the email builder's public surface)
// ---------------------------------------------------------------------------

export { buildComponents, buildText } from './documents/components';
export type { WaTemplateComponents } from './documents/components';
export {
  BLOCK_TYPES,
  BodyPropsSchema,
  ButtonsPropsSchema,
  FooterPropsSchema,
  HeaderPropsSchema,
  SECTION_TYPES,
  WaButtonSchema,
  WhatsAppBlockSchema,
  WhatsAppConfigurationSchema,
  WhatsAppMessagePropsSchema,
} from './documents/schemas';
export type {
  BodyProps,
  ButtonsProps,
  FooterProps,
  HeaderProps,
  SectionType,
  TWhatsAppBlock,
  TWhatsAppConfiguration,
  WaButton,
  WhatsAppBlockType,
  WhatsAppMessageProps,
} from './documents/schemas';
export { validateWhatsAppDocument } from './documents/validation';
export type { ValidationIssue } from './documents/validation';
export { LIMITS, WA_CATEGORIES, BUTTON_TYPES, HEADER_FORMATS, extractVariables } from './documents/whatsapp';
export type { WaCategory, WaButtonType, HeaderFormat } from './documents/whatsapp';
export { getEmptyWhatsAppMessage } from './getConfiguration';
