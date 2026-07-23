/**
 * WhatsApp Business template constraints (Meta Cloud API).
 *
 * These are the rules the builder enforces — the whole point of this
 * package versus the email builder is that WhatsApp fixes ALL visual
 * styling, so the "style surface" collapses to: which sections exist,
 * their text content (with WhatsApp's own markdown), media handles,
 * variables, and buttons. Reference: Meta "Message templates" docs.
 */

export const LIMITS = {
  /** Text-format header: max 60 chars, at most one {{1}} variable. */
  HEADER_TEXT_MAX: 60,
  /** Body: required, max 1024 chars, {{n}} variables, WA markdown. */
  BODY_TEXT_MAX: 1024,
  /** Footer: optional, max 60 chars, plain text only. */
  FOOTER_TEXT_MAX: 60,
  /** Any button label. */
  BUTTON_TEXT_MAX: 25,
  /** URL button target. */
  BUTTON_URL_MAX: 2000,
  /** Phone-number button. */
  BUTTON_PHONE_MAX: 20,
  /** Copy-code button offer code. */
  BUTTON_CODE_MAX: 15,
  /** Total buttons per template. */
  MAX_BUTTONS: 10,
  MAX_URL_BUTTONS: 2,
  MAX_PHONE_BUTTONS: 1,
  MAX_COPY_BUTTONS: 1,
} as const;

/** Meta template categories. */
export const WA_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
export type WaCategory = (typeof WA_CATEGORIES)[number];

/** Header formats WhatsApp accepts. */
export const HEADER_FORMATS = ['text', 'image', 'video', 'document', 'location'] as const;
export type HeaderFormat = (typeof HEADER_FORMATS)[number];

/** Button types WhatsApp accepts. */
export const BUTTON_TYPES = ['QUICK_REPLY', 'URL', 'PHONE_NUMBER', 'COPY_CODE'] as const;
export type WaButtonType = (typeof BUTTON_TYPES)[number];

/** Common template languages (subset; Meta accepts many more codes). */
export const WA_LANGUAGES = ['en', 'en_US', 'es', 'es_MX', 'it', 'pt_BR', 'fr', 'de'] as const;

/** Matches every {{n}} variable occurrence. */
export const VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

/** Extract the ordered list of variable indices used in a text. */
export function extractVariables(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(VARIABLE_RE)) out.push(Number(m[1]));
  return out;
}

/**
 * Per-button-type count ceilings, used by both validation and the
 * "add button" affordance in the inspector.
 */
export function maxForButtonType(type: WaButtonType): number {
  switch (type) {
    case 'URL':
      return LIMITS.MAX_URL_BUTTONS;
    case 'PHONE_NUMBER':
      return LIMITS.MAX_PHONE_BUTTONS;
    case 'COPY_CODE':
      return LIMITS.MAX_COPY_BUTTONS;
    case 'QUICK_REPLY':
      return LIMITS.MAX_BUTTONS;
  }
}
