import type { TWhatsAppConfiguration, WaButton } from './schemas';
import { extractVariables, type WaCategory } from './whatsapp';

/**
 * Serialize a builder document into a Meta-style template `components`
 * payload — the shape the host app persists on `ApiTemplate.components`
 * (today `{ category, body: { text } }`; this extends it with header /
 * footer / buttons while keeping those two keys byte-compatible).
 */

export type WaTemplateComponents = {
  category: WaCategory;
  language: string;
  header?:
    | { format: 'TEXT'; text: string; example?: { header_text: string[] } }
    | { format: 'IMAGE' | 'VIDEO' | 'DOCUMENT'; example?: { header_handle: string[] } }
    | { format: 'LOCATION' };
  body: { text: string; example?: { body_text: string[][] } };
  footer?: { text: string };
  buttons?: Array<
    | { type: 'QUICK_REPLY'; text: string }
    | { type: 'URL'; text: string; url: string }
    | { type: 'PHONE_NUMBER'; text: string; phone_number: string }
    | { type: 'COPY_CODE'; example: string }
  >;
};

type SectionMap = {
  header?: Extract<TWhatsAppConfiguration[string], { type: 'Header' }>['data'];
  body?: Extract<TWhatsAppConfiguration[string], { type: 'Body' }>['data'];
  footer?: Extract<TWhatsAppConfiguration[string], { type: 'Footer' }>['data'];
  buttons?: Extract<TWhatsAppConfiguration[string], { type: 'Buttons' }>['data'];
};

/** Collect the (at most one per type) sections referenced by the root. */
export function collectSections(document: TWhatsAppConfiguration): SectionMap {
  const root = document.root;
  if (!root || root.type !== 'WhatsAppMessage') return {};
  const out: SectionMap = {};
  for (const id of root.data.childrenIds ?? []) {
    const block = document[id];
    if (!block) continue;
    if (block.type === 'Header' && !out.header) out.header = block.data;
    if (block.type === 'Body' && !out.body) out.body = block.data;
    if (block.type === 'Footer' && !out.footer) out.footer = block.data;
    if (block.type === 'Buttons' && !out.buttons) out.buttons = block.data;
  }
  return out;
}

function serializeButton(b: WaButton): NonNullable<WaTemplateComponents['buttons']>[number] | null {
  switch (b.type) {
    case 'QUICK_REPLY':
      return b.text ? { type: 'QUICK_REPLY', text: b.text } : null;
    case 'URL':
      return b.text && b.url ? { type: 'URL', text: b.text, url: b.url } : null;
    case 'PHONE_NUMBER':
      return b.text && b.phoneNumber ? { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phoneNumber } : null;
    case 'COPY_CODE':
      return b.couponCode ? { type: 'COPY_CODE', example: b.couponCode } : null;
  }
}

/** Flattened body text — the host keeps this on `ApiTemplate.text`. */
export function buildText(document: TWhatsAppConfiguration): string {
  return collectSections(document).body?.props?.text ?? '';
}

export function buildComponents(document: TWhatsAppConfiguration): WaTemplateComponents {
  const root = document.root;
  const rootData = root && root.type === 'WhatsAppMessage' ? root.data : undefined;
  const { header, body, footer, buttons } = collectSections(document);

  const out: WaTemplateComponents = {
    category: (rootData?.category ?? 'MARKETING') as WaCategory,
    language: rootData?.language ?? 'en',
    body: { text: body?.props?.text ?? '' },
  };

  const bodyVars = extractVariables(out.body.text);
  const examples = body?.props?.examples ?? [];
  if (bodyVars.length > 0) {
    out.body.example = {
      body_text: [bodyVars.map((n) => examples[n - 1] ?? `Sample ${n}`)],
    };
  }

  if (header) {
    const p = header.props ?? {};
    const format = p.format ?? 'text';
    if (format === 'text' && p.text) {
      out.header = { format: 'TEXT', text: p.text };
      if (extractVariables(p.text).length > 0) {
        out.header.example = { header_text: ['Sample'] };
      }
    } else if (format === 'image' || format === 'video' || format === 'document') {
      out.header = {
        format: format.toUpperCase() as 'IMAGE' | 'VIDEO' | 'DOCUMENT',
        ...(p.mediaUrl ? { example: { header_handle: [p.mediaUrl] } } : {}),
      };
    } else if (format === 'location') {
      out.header = { format: 'LOCATION' };
    }
  }

  if (footer?.props?.text) out.footer = { text: footer.props.text };

  if (buttons) {
    const serialized = (buttons.props?.buttons ?? [])
      .map(serializeButton)
      .filter((b): b is NonNullable<typeof b> => b !== null);
    if (serialized.length > 0) out.buttons = serialized;
  }

  return out;
}
