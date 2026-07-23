/**
 * Standalone entry point — self-contained build with Shadow DOM encapsulation.
 *
 * This bundles React, ReactDOM, and all dependencies. The <email-builder> web component
 * renders inside a Shadow DOM so it won't conflict with the host page's styles or React version.
 */
import r2wc from '@r2wc/react-to-web-component';

import EmailBuilderStandalone from './EmailBuilderStandalone';

let EmailBuilderElementClass: CustomElementConstructor | null = null;

function ensureElementClass(): CustomElementConstructor {
  if (EmailBuilderElementClass) return EmailBuilderElementClass;
  EmailBuilderElementClass = r2wc(EmailBuilderStandalone, {
    shadow: 'open',
    props: {
      primaryColor: 'string',
      secondaryColor: 'string',
      galleryImages: 'boolean',
      darkMode: 'boolean',
      height: 'string',
      stickyHeader: 'boolean',
      sticky: 'boolean',
      htmlTab: 'boolean',
      jsonTab: 'boolean',
      locale: 'string',
      dataLocale: 'string',
      imagePlaceholder: 'string',
      imageUrlInput: 'boolean',
      imageUploadInput: 'boolean',
      backgroundUrlInput: 'boolean',
      backgroundUploadInput: 'boolean',
      data: 'json',
      showVersion: 'boolean',
      componentTree: 'boolean',
      componentsStorage: 'string',
      templateSaving: 'boolean',
      templateLibrary: 'boolean',
      themeSaving: 'boolean',
      enableAI: 'boolean',
      mergeTags: 'json',
    },
  }) as unknown as CustomElementConstructor;
  return EmailBuilderElementClass;
}

export function registerEmailBuilder(tagName: string = 'email-builder') {
  if (typeof customElements === 'undefined') return;
  if (!customElements.get(tagName)) {
    customElements.define(tagName, ensureElementClass());
  }
}

// Auto-register
if (typeof window !== 'undefined') {
  try {
    registerEmailBuilder('email-builder');
  } catch {
    /* ignore if already defined */
  }
}

export { default as EmailBuilder } from './index';
export type { EmailBuilderProps, EmailBuilderRef, TEditorConfiguration } from './index';
