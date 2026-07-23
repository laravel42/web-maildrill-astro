import type { TemplateCategory } from './types';

/**
 * Meta WhatsApp Business template constraints — the single source for
 * every numeric limit and per-category capability. Validation, the
 * inspector counters and the library gating all read from here.
 * Reference: Meta "Message templates" + component-specific docs.
 */

export const LIMITS = {
  NAME_MAX: 512,
  HEADER_TEXT_MAX: 60,
  BODY_TEXT_MAX: 1024,
  /** Authentication bodies are Meta-generated; this is informational. */
  FOOTER_TEXT_MAX: 60,
  BUTTON_TEXT_MAX: 25,
  URL_MAX: 2000,
  PHONE_MAX: 20,
  COPY_CODE_MAX: 15,
  MAX_BUTTONS: 10,
  MAX_URL_BUTTONS: 2,
  MAX_PHONE_BUTTONS: 1,
  MAX_COPY_CODE_BUTTONS: 1,
  /** OTP templates carry exactly one OTP button. */
  MAX_OTP_BUTTONS: 1,
  MAX_FLOW_BUTTONS: 1,
  MAX_CATALOG_BUTTONS: 1,
  MAX_MPM_BUTTONS: 1,
  CODE_EXPIRATION_MIN: 1,
  CODE_EXPIRATION_MAX: 90,
  /** Header text allows at most one variable ({{1}}). */
  HEADER_MAX_VARIABLES: 1,
} as const;

/** Meta template name: lowercase letters, digits, underscores. */
export const TEMPLATE_NAME_RE = /^[a-z0-9_]+$/;

/** Common template languages (Meta accepts many more codes). */
export const LANGUAGES = [
  'en',
  'en_US',
  'en_GB',
  'es',
  'es_ES',
  'es_MX',
  'it',
  'pt_BR',
  'pt_PT',
  'fr',
  'de',
  'nl',
  'ar',
  'hi',
  'id',
  'ja',
  'ko',
  'zh_CN',
] as const;

export const CATEGORIES: readonly TemplateCategory[] = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];

/**
 * Per-category capability matrix. Plugins consult this via their
 * `availableIn`; the engine re-checks on category switches so existing
 * content gets flagged (never silently deleted).
 */
export const CATEGORY_CAPS: Record<
  TemplateCategory,
  {
    customHeader: boolean;
    customBody: boolean;
    customFooter: boolean;
    buttonTypes: readonly string[];
  }
> = {
  MARKETING: {
    customHeader: true,
    customBody: true,
    customFooter: true,
    buttonTypes: ['quick-reply', 'url', 'phone', 'copy-code', 'flow', 'catalog', 'mpm'],
  },
  UTILITY: {
    customHeader: true,
    customBody: true,
    customFooter: true,
    buttonTypes: ['quick-reply', 'url', 'phone', 'copy-code', 'flow'],
  },
  AUTHENTICATION: {
    // Meta generates auth content: no custom header, fixed body copy
    // (optional security recommendation), footer = code expiration.
    customHeader: false,
    customBody: false,
    customFooter: false,
    buttonTypes: ['otp'],
  },
};
