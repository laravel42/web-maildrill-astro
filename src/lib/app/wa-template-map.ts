import type {
  MetaButton,
  MetaComponent,
  MetaTemplate,
  TemplateCategory,
  TemplateDoc,
} from 'wa-template-studio';
import { emptyDoc, extractVariables, fromMetaJson, toMetaJson } from 'wa-template-studio';

import type { TplCategory } from '@/lib/app/templates-data';
import {
  normalizeTemplateLanguageCode,
  TEMPLATE_LANGUAGE_OPTIONS,
  templateLanguageCountry,
  templateLanguageFlagSrc,
  templateLanguageLabel,
  type TemplateLanguageOption,
} from '@/lib/app/template-language';

/** Meta template categories shown in the WhatsApp editor header. */
export const WA_TEMPLATE_CATEGORY_LABELS = ['Marketing', 'Utility', 'Authentication'] as const;
export type WaTemplateCategoryLabel = (typeof WA_TEMPLATE_CATEGORY_LABELS)[number];

/** @deprecated Use `TemplateLanguageOption` from `@/lib/app/template-language`. */
export type WaLanguageOption = TemplateLanguageOption;

/** @deprecated Use `TEMPLATE_LANGUAGE_OPTIONS`. */
export const WA_LANGUAGE_OPTIONS = TEMPLATE_LANGUAGE_OPTIONS;

/** @deprecated Use `normalizeTemplateLanguageCode`. */
export const normalizeWaLanguageCode = normalizeTemplateLanguageCode;

/** @deprecated Use `templateLanguageLabel`. */
export const waLanguageLabel = templateLanguageLabel;

/** @deprecated Use `templateLanguageCountry`. */
export const waLanguageCountry = templateLanguageCountry;

/** @deprecated Use `templateLanguageFlagSrc`. */
export const waLanguageFlagSrc = templateLanguageFlagSrc;

const WA_LABEL_TO_META: Record<WaTemplateCategoryLabel, TemplateCategory> = {
  Marketing: 'MARKETING',
  Utility: 'UTILITY',
  Authentication: 'AUTHENTICATION',
};

const WA_META_TO_LABEL: Record<TemplateCategory, WaTemplateCategoryLabel> = {
  MARKETING: 'Marketing',
  UTILITY: 'Utility',
  AUTHENTICATION: 'Authentication',
};

export function waCategoryLabel(category: TemplateCategory): WaTemplateCategoryLabel {
  return WA_META_TO_LABEL[category];
}

export function waLabelToMeta(label: string): TemplateCategory {
  if (label in WA_LABEL_TO_META) return WA_LABEL_TO_META[label as WaTemplateCategoryLabel];
  return 'MARKETING';
}

/** Map Meta category → Maildrill gallery category. */
export function metaCategoryToMaildrill(category: TemplateCategory): TplCategory {
  if (category === 'UTILITY' || category === 'AUTHENTICATION') return 'Transactional';
  return 'Promotional';
}

/** Map Maildrill gallery category → Meta category (legacy templates). */
export function maildrillCategoryToMeta(category: string | undefined): TemplateCategory {
  return category === 'Transactional' ? 'UTILITY' : 'MARKETING';
}

function isTemplateDoc(value: unknown): value is TemplateDoc {
  if (!value || typeof value !== 'object') return false;
  const blocks = (value as TemplateDoc).blocks;
  return Boolean(blocks && typeof blocks === 'object' && blocks.body);
}

function bodyText(doc: TemplateDoc): string {
  const data = doc.blocks.body.data as { text?: unknown };
  return typeof data.text === 'string' ? data.text : '';
}

/**
 * Ordered send-time subscriber tokens for the body's {{1}}..{{n}} placeholders,
 * from the studio's variable→field mapping (`variables[n].source`, a merge tag
 * like `{{attributes.company}}`). Unmapped positions become "" — the sender then
 * falls back to the variable's Meta-review example value.
 */
function bodyPlaceholderTokens(doc: TemplateDoc): string[] {
  const data = doc.blocks.body.data as {
    variables?: Record<string, { source?: string }>;
  };
  const count = Math.max(0, ...extractVariables(bodyText(doc)));
  if (count === 0) return [];
  const vars = data.variables ?? {};
  return Array.from({ length: count }, (_, i) => {
    const source = vars[String(i + 1)]?.source;
    const m = typeof source === 'string' ? /^\{\{\s*([\w.]+)\s*\}\}$/.exec(source.trim()) : null;
    return m ? m[1] : '';
  });
}

function normalizeButton(btn: MetaButton): Record<string, unknown> {
  const type = String(btn.type ?? '').toUpperCase();
  if (type === 'PHONE_NUMBER') {
    const phone =
      typeof btn.phone_number === 'string'
        ? btn.phone_number
        : typeof btn.phoneNumber === 'string'
          ? btn.phoneNumber
          : undefined;
    return { type: 'PHONE_NUMBER', text: btn.text, ...(phone ? { phoneNumber: phone } : {}) };
  }
  if (type === 'URL') {
    return {
      type: 'URL',
      text: btn.text,
      ...(typeof btn.url === 'string' ? { url: btn.url } : {}),
    };
  }
  return { type, text: btn.text };
}

function metaButtonToImport(btn: Record<string, unknown>): MetaButton {
  const type = String(btn.type ?? '').toUpperCase();
  if (type === 'PHONE_NUMBER' && typeof btn.phoneNumber === 'string') {
    return { type: 'PHONE_NUMBER', text: String(btn.text ?? ''), phone_number: btn.phoneNumber };
  }
  return btn as MetaButton;
}

/** Flat structure stored in `templates.components` for Meta/Infobip submission. */
export function metaToStoredComponents(meta: MetaTemplate): Record<string, unknown> {
  const out: Record<string, unknown> = { category: meta.category };

  for (const comp of meta.components ?? []) {
    const type = String(comp.type ?? '').toUpperCase();
    if (type === 'HEADER') {
      const header: Record<string, unknown> = { format: comp.format };
      if (typeof comp.text === 'string') header.text = comp.text;
      if (comp.example) header.example = comp.example;
      out.header = header;
    } else if (type === 'BODY') {
      const body: Record<string, unknown> = {
        text: typeof comp.text === 'string' ? comp.text : '',
      };
      const rows = (comp.example as { body_text?: string[][] } | undefined)?.body_text?.[0];
      if (rows?.length) body.examples = rows;
      out.body = body;
    } else if (type === 'FOOTER') {
      const footer: Record<string, unknown> = {};
      if (typeof comp.text === 'string') footer.text = comp.text;
      if (typeof comp.code_expiration_minutes === 'number') {
        footer.code_expiration_minutes = comp.code_expiration_minutes;
      }
      out.footer = footer;
    } else if (type === 'BUTTONS') {
      out.buttons = ((comp.buttons as MetaButton[] | undefined) ?? []).map(normalizeButton);
    }
  }

  return out;
}

/** Rebuild a Meta payload from the flat DB `components` blob (legacy saves). */
export function storedComponentsToMeta(
  components: Record<string, unknown>,
  opts: { name: string; language: string; text?: string | null },
): MetaTemplate {
  const category =
    typeof components.category === 'string'
      ? (components.category.toUpperCase() as TemplateCategory)
      : 'MARKETING';

  const metaComponents: MetaComponent[] = [];

  if (components.header && typeof components.header === 'object') {
    metaComponents.push({ ...(components.header as MetaComponent), type: 'HEADER' });
  }

  if (components.body && typeof components.body === 'object') {
    const body = components.body as { text?: string; examples?: string[] };
    metaComponents.push({
      type: 'BODY',
      text: body.text ?? opts.text ?? '',
      ...(body.examples?.length ? { example: { body_text: [body.examples] } } : {}),
    });
  } else if (opts.text) {
    metaComponents.push({ type: 'BODY', text: opts.text });
  }

  if (components.footer && typeof components.footer === 'object') {
    metaComponents.push({ ...(components.footer as MetaComponent), type: 'FOOTER' });
  }

  if (Array.isArray(components.buttons) && components.buttons.length) {
    metaComponents.push({
      type: 'BUTTONS',
      buttons: components.buttons.map((b) => metaButtonToImport(b as Record<string, unknown>)),
    });
  }

  return {
    name: opts.name,
    language: opts.language,
    category,
    components: metaComponents,
  };
}

/** Build the API PATCH/POST body fields for a WhatsApp template save. */
export function docToApiFields(doc: TemplateDoc) {
  const meta = toMetaJson(doc);
  const components = metaToStoredComponents(meta);
  const placeholders = bodyPlaceholderTokens(doc);
  if (placeholders.length > 0) components.placeholders = placeholders;
  return {
    name: doc.name.trim() || 'Untitled template',
    channel: 'whatsapp' as const,
    text: bodyText(doc) || null,
    category: metaCategoryToMaildrill(doc.category),
    language: doc.language,
    builderDoc: doc as unknown as Record<string, unknown>,
    components,
  };
}

/** Hydrate a studio document when opening an existing template. */
export function hydrateTemplateDoc(opts: {
  name: string;
  language?: string | null;
  text?: string | null;
  builderDoc?: Record<string, unknown> | null;
  components?: Record<string, unknown> | null;
  category?: string | null;
}): TemplateDoc {
  if (isTemplateDoc(opts.builderDoc)) {
    const doc = structuredClone(opts.builderDoc);
    if (opts.name) doc.name = opts.name;
    return doc;
  }

  if (opts.components && Object.keys(opts.components).length > 0) {
    const meta = storedComponentsToMeta(opts.components, {
      name: opts.name,
      language: opts.language ?? 'en_US',
      text: opts.text,
    });
    const doc = fromMetaJson(meta);
    doc.name = opts.name;
    return doc;
  }

  const doc = emptyDoc();
  doc.name = opts.name;
  doc.language = opts.language ?? 'en_US';
  doc.category = maildrillCategoryToMeta(opts.category ?? undefined);
  if (opts.text) {
    doc.blocks.body = {
      ...doc.blocks.body,
      data: { text: opts.text, variables: {} },
    };
  }
  return doc;
}
