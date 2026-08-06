/**
 * Client-side mirror of workers/packages/services/src/wa-infobip-structure.ts
 * validation. Keep in sync — server checks are authoritative on submit.
 */

export type WaInfobipCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === 'string' && item.trim()) return item.trim();
    }
  }
  return undefined;
}

function headerExample(format: string, example: unknown): string | undefined {
  if (typeof example === 'string') return example.trim() || undefined;
  const ex = asRecord(example);
  if (format === 'TEXT') return firstString(ex.header_text);
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
    return firstString(ex.header_handle);
  }
  return undefined;
}

export function normalizeWhatsAppTemplateName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveCategory(components: Record<string, unknown> | null | undefined): WaInfobipCategory {
  const cat = typeof components?.category === 'string' ? components.category.toUpperCase() : '';
  return cat === 'UTILITY' || cat === 'AUTHENTICATION' ? cat : 'MARKETING';
}

/** Block submit in the UI before the product API call. */
export function validateWaTemplateSubmit(opts: {
  name: string;
  text?: string | null;
  components?: Record<string, unknown> | null;
}): string | undefined {
  const trimmed = opts.name.trim();
  if (!trimmed) return 'Template name is required';
  const normalized = normalizeWhatsAppTemplateName(trimmed);
  if (!normalized) {
    return 'WhatsApp template name must contain lowercase letters, numbers, or underscores (e.g. welcome_offer)';
  }
  if (normalized !== trimmed) {
    return `Rename the template to lowercase letters, numbers, and underscores only (e.g. ${normalized})`;
  }

  const components = opts.components ?? {};
  const category = resolveCategory(components);
  const body = asRecord(components.body);
  const text =
    (typeof body.text === 'string' ? body.text : '') ||
    (typeof opts.text === 'string' ? opts.text : '');
  if (!text.trim()) {
    return category === 'AUTHENTICATION'
      ? 'Authentication templates need an OTP button'
      : 'Template body text is required';
  }

  const header = asRecord(components.header);
  const format = String(header.format ?? '').toUpperCase();
  if (format === 'TEXT') {
    const headerText = typeof header.text === 'string' ? header.text : '';
    if (/\{\{\s*1\s*\}\}/.test(headerText) && !headerExample('TEXT', header.example)) {
      return 'Text header with {{1}} requires an example value for Meta review';
    }
  }
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
    const example = headerExample(format, header.example);
    if (!example) {
      return `${format} header requires a public HTTPS sample URL for Meta review`;
    }
    if (example.startsWith('blob:') || example.startsWith('data:')) {
      return 'Media header sample must be a public HTTPS URL — paste a CDN link; local uploads cannot reach Infobip';
    }
    if (!/^https:\/\//i.test(example)) {
      return 'Media header sample must be a public HTTPS URL';
    }
  }

  const placeholders = text.match(/\{\{\s*\d+\s*\}\}/g) ?? [];
  const examples = Array.isArray(body.examples)
    ? body.examples.filter((e): e is string => typeof e === 'string')
    : [];
  if (placeholders.length > 0 && examples.length !== placeholders.length) {
    return `Body has ${placeholders.length} variable(s) — add an example value for each before submitting`;
  }

  const buttons = Array.isArray(components.buttons) ? components.buttons : [];
  for (const raw of buttons) {
    const btn = asRecord(raw);
    const type = String(btn.type ?? '').toUpperCase();
    if (type === 'URL') {
      if (!firstString(btn.text)) return 'URL buttons need button label text';
      if (typeof btn.url === 'string' && /\{\{\s*1\s*\}\}/.test(btn.url) && !firstString(btn.example)) {
        return 'Dynamic URL buttons need an example full URL for Meta review';
      }
    }
    if (type === 'COPY_CODE' && !firstString(btn.example)) {
      return 'Copy offer code buttons need an example coupon code for Meta review';
    }
    if (type === 'PHONE_NUMBER') {
      const phone =
        typeof btn.phoneNumber === 'string'
          ? btn.phoneNumber
          : typeof btn.phone_number === 'string'
            ? btn.phone_number
            : '';
      if (!phone.trim()) return 'Call buttons need a phone number in international format';
    }
    if (type === 'QUICK_REPLY' && !firstString(btn.text)) {
      return 'Quick reply buttons need label text';
    }
  }

  if (category !== 'AUTHENTICATION' && buttons.length) {
    const types = buttons.map((b) => String(asRecord(b).type ?? '').toUpperCase());
    const hasQuickReply = types.includes('QUICK_REPLY');
    const hasCta = types.some((t) => t === 'URL' || t === 'PHONE_NUMBER' || t === 'COPY_CODE');
    if (hasQuickReply && hasCta) {
      return 'Buttons cannot mix quick replies with call/URL/copy-code buttons';
    }
  }

  return undefined;
}
