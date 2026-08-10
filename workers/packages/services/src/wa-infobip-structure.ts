import type { WhatsAppTemplateButton, WhatsAppTemplateStructure } from '@maildrill/providers';

type StoredComponents = Record<string, unknown>;
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

/** Meta Cloud `example.header_handle` / `header_text` → Infobip string `example`. */
function infobipHeaderExample(format: string, example: unknown): string | undefined {
  if (typeof example === 'string') return example.trim() || undefined;
  const ex = asRecord(example);
  if (format === 'TEXT') return firstString(ex.header_text);
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
    return firstString(ex.header_handle);
  }
  return undefined;
}

function infobipHeader(header: Record<string, unknown>): WhatsAppTemplateStructure['header'] {
  const format = String(header.format ?? 'TEXT').toUpperCase() as
    'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  const out: NonNullable<WhatsAppTemplateStructure['header']> = { format };
  if (typeof header.text === 'string') out.text = header.text;
  const example = infobipHeaderExample(format, header.example);
  if (example) (out as Record<string, unknown>).example = example;
  return out;
}

function infobipButton(btn: Record<string, unknown>): Record<string, unknown> {
  const type = String(btn.type ?? '').toUpperCase();
  if (type === 'URL') {
    const out: Record<string, unknown> = {
      type: 'URL',
      text: btn.text,
      ...(typeof btn.url === 'string' ? { url: btn.url } : {}),
    };
    const example = firstString(btn.example);
    if (example) out.example = example;
    return out;
  }
  if (type === 'PHONE_NUMBER') {
    const phone =
      typeof btn.phoneNumber === 'string'
        ? btn.phoneNumber
        : typeof btn.phone_number === 'string'
          ? btn.phone_number
          : undefined;
    return {
      type: 'PHONE_NUMBER',
      text: btn.text,
      ...(phone ? { phoneNumber: phone } : {}),
    };
  }
  if (type === 'COPY_CODE') {
    const example = firstString(btn.example);
    return {
      type: 'COPY_CODE',
      ...(example ? { example } : {}),
    };
  }
  if (type === 'OTP') {
    const otpType = String(btn.otp_type ?? btn.otpType ?? 'COPY_CODE').toUpperCase();
    const out: Record<string, unknown> = {
      text: btn.text ?? 'Copy code',
      otpType: otpType === 'ONE_TAP' || otpType === 'ZERO_TAP' ? otpType : 'COPY_CODE',
    };
    if (typeof btn.autofill_text === 'string') out.autofillText = btn.autofill_text;
    if (typeof btn.package_name === 'string') out.packageName = btn.package_name;
    if (typeof btn.signature_hash === 'string') out.signatureHash = btn.signature_hash;
    return out;
  }
  return { type, text: btn.text };
}

function infobipAuthStructure(components: StoredComponents): WhatsAppTemplateStructure | null {
  const body = asRecord(components.body);
  const footer = asRecord(components.footer);
  const buttons = Array.isArray(components.buttons) ? components.buttons : [];
  const otp = buttons.find((b) => {
    const type = String(asRecord(b).type ?? '').toUpperCase();
    return type === 'OTP' || type === 'COPY_CODE';
  });
  if (!otp) return null;

  const structure: Record<string, unknown> = {
    body: {
      addSecurityRecommendation: Boolean(
        body.add_security_recommendation ?? body.addSecurityRecommendation,
      ),
    },
  };
  const minutes = footer.code_expiration_minutes ?? footer.codeExpirationMinutes;
  if (typeof minutes === 'number') {
    structure.footer = { codeExpirationMinutes: minutes };
  }
  structure.buttons = [infobipButton(asRecord(otp))];
  // Auth structures carry no body.text by design — Infobip supplies the copy.
  return structure as unknown as WhatsAppTemplateStructure;
}

/** Infobip/Meta require lowercase alphanumeric + underscores. */
export function normalizeWhatsAppTemplateName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

function resolveCategory(components: StoredComponents | null | undefined): WaInfobipCategory {
  const cat = typeof components?.category === 'string' ? components.category.toUpperCase() : '';
  return cat === 'UTILITY' || cat === 'AUTHENTICATION' ? cat : 'MARKETING';
}

function infobipStructureType(
  category: WaInfobipCategory,
  structure: Record<string, unknown>,
): 'TEXT' | 'MEDIA' | undefined {
  if (category === 'AUTHENTICATION') return undefined;
  const hasMedia = Boolean(structure.header || structure.footer || structure.buttons);
  return hasMedia ? 'MEDIA' : 'TEXT';
}

/**
 * Convert the flat `templates.components` blob (Meta-shaped, from wa-template-studio)
 * into the structure Infobip's POST /whatsapp/2/senders/{sender}/templates expects.
 */
export function storedComponentsToInfobipStructure(
  components: StoredComponents | null | undefined,
  fallbackText: string | null | undefined,
  category: WaInfobipCategory,
): { structure: WhatsAppTemplateStructure; type?: 'TEXT' | 'MEDIA' } | null {
  const c = components ?? {};
  if (category === 'AUTHENTICATION') {
    const auth = infobipAuthStructure(c);
    return auth ? { structure: auth } : null;
  }

  const bodyStored = asRecord(c.body);
  const text =
    (typeof bodyStored.text === 'string' ? bodyStored.text : '') ||
    (typeof fallbackText === 'string' ? fallbackText : '');
  if (!text.trim()) return null;

  const body: WhatsAppTemplateStructure['body'] = { text };
  if (Array.isArray(bodyStored.examples) && bodyStored.examples.length) {
    body.examples = bodyStored.examples.filter((e): e is string => typeof e === 'string');
  }

  const structure: WhatsAppTemplateStructure & Record<string, unknown> = { body };

  if (c.header && typeof c.header === 'object') {
    structure.header = infobipHeader(asRecord(c.header));
  }
  if (c.footer && typeof c.footer === 'object') {
    const footer = asRecord(c.footer);
    if (typeof footer.text === 'string') structure.footer = { text: footer.text };
  }
  if (Array.isArray(c.buttons) && c.buttons.length) {
    // OTP/COPY_CODE button shapes legitimately exceed WhatsAppTemplateButton.
    structure.buttons = c.buttons.map(
      (b) => infobipButton(asRecord(b)) as unknown as WhatsAppTemplateButton,
    );
  }

  const type = infobipStructureType(category, structure);
  return {
    structure,
    ...(type ? { type } : {}),
  };
}

/** Redact secrets from a payload before logging in dev. */
export function sanitizeInfobipTemplatePayload(payload: Record<string, unknown>): unknown {
  return JSON.parse(JSON.stringify(payload));
}

export function validateWhatsAppTemplateName(name: string): string | undefined {
  const trimmed = name.trim();
  if (!trimmed) return 'Template name is required';
  const normalized = normalizeWhatsAppTemplateName(trimmed);
  if (!normalized) {
    return 'WhatsApp template name must contain lowercase letters, numbers, or underscores (e.g. welcome_offer)';
  }
  if (normalized !== trimmed) {
    return `WhatsApp template name must be lowercase letters, numbers, and underscores only (will submit as "${normalized}")`;
  }
  return undefined;
}

/** Pre-flight checks that produce clearer errors than Infobip GENERAL_ERROR. */
export function validateInfobipStructure(
  components: StoredComponents | null | undefined,
  fallbackText: string | null | undefined,
  category: WaInfobipCategory,
  opts?: { templateName?: string | null },
): string | undefined {
  // Display names stay authored ("Jose's Birthday"); the provider call uses
  // the normalized form. Only an un-normalizable name blocks submission.
  if (opts?.templateName && !normalizeWhatsAppTemplateName(opts.templateName)) {
    return 'WhatsApp template name must contain letters or numbers (it is submitted as e.g. welcome_offer)';
  }

  const storedCategory = resolveCategory(components);
  if (storedCategory !== category) {
    return `Template category mismatch (${storedCategory} stored, ${category} expected) — save again before submitting`;
  }

  const built = storedComponentsToInfobipStructure(components, fallbackText, category);
  if (!built) {
    return category === 'AUTHENTICATION'
      ? 'Authentication templates need an OTP button'
      : 'Template body text is required';
  }

  const header = asRecord(components?.header);
  const format = String(header.format ?? '').toUpperCase();
  if (format === 'TEXT') {
    const headerText = typeof header.text === 'string' ? header.text : '';
    const headerVars = headerText.match(/\{\{\s*1\s*\}\}/);
    if (headerVars && !infobipHeaderExample('TEXT', header.example)) {
      return 'Text header with {{1}} requires an example value for Meta review';
    }
  }
  if (format === 'IMAGE' || format === 'VIDEO' || format === 'DOCUMENT') {
    const example = infobipHeaderExample(format, header.example);
    if (!example) {
      return `${format} header requires a public HTTPS sample URL for Meta review`;
    }
    if (example.startsWith('blob:') || example.startsWith('data:')) {
      return 'Media header sample must be a public HTTPS URL — upload to your CDN; blob and data URLs cannot reach Infobip';
    }
    if (!/^https:\/\//i.test(example)) {
      return 'Media header sample must be a public HTTPS URL (Infobip cannot fetch blob or http links)';
    }
  }

  const body = built.structure.body;
  const placeholders = body.text.match(/\{\{\s*\d+\s*\}\}/g) ?? [];
  if (placeholders.length > 0 && !(body.examples?.length === placeholders.length)) {
    return `Body has ${placeholders.length} variable(s) — add an example value for each before submitting`;
  }

  const buttons = Array.isArray(components?.buttons) ? components.buttons : [];
  for (const raw of buttons) {
    const btn = asRecord(raw);
    const type = String(btn.type ?? '').toUpperCase();
    if (type === 'URL') {
      if (!firstString(btn.text)) return 'URL buttons need button label text';
      if (
        typeof btn.url === 'string' &&
        /\{\{\s*1\s*\}\}/.test(btn.url) &&
        !firstString(btn.example)
      ) {
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
      return 'Buttons cannot mix quick replies with call/URL/copy-code buttons (Meta grouping rule)';
    }
  }

  return undefined;
}
