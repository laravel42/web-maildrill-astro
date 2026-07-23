import r2wc from '@r2wc/react-to-web-component';

import WhatsAppBuilder from './index';

/**
 * Web-component wrapper — same registration pattern as the email
 * builder's standalone entry (`@r2wc/react-to-web-component`).
 * Function props (onSave/onAutoSave) are React-only; attribute-mapped
 * props cover embedding without a React host.
 */

let WhatsAppBuilderElementClass: CustomElementConstructor | null = null;

function buildElementClass(): CustomElementConstructor {
  if (!WhatsAppBuilderElementClass) {
    WhatsAppBuilderElementClass = r2wc(WhatsAppBuilder, {
      props: {
        data: 'json',
        locale: 'string',
        darkMode: 'boolean',
        height: 'string',
        businessName: 'string',
        primaryColor: 'string',
        disableEdition: 'boolean',
      },
    }) as unknown as CustomElementConstructor;
  }
  return WhatsAppBuilderElementClass;
}

export function registerWhatsAppBuilder(tagName = 'whatsapp-builder') {
  if (typeof window === 'undefined' || typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, buildElementClass());
  }
}

if (typeof window !== 'undefined') {
  registerWhatsAppBuilder();
}

export { WhatsAppBuilder };
export default WhatsAppBuilder;
