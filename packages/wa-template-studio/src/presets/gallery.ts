import { LIMITS } from '@/core/limits';
import { getButtonPlugin } from '@/core/registry';
import { newId, type TemplateCategory, type TemplateDoc } from '@/core/types';
import type { VariableMap } from '@/core/variables';

/**
 * Template gallery — a curated catalog of ready-made WhatsApp templates a
 * host feeds in (see `docs/whatsapp-message-templates.json`). It is *content*,
 * not part of the editor core, so it arrives as data and is normalized here
 * into the studio's domain model. Picking one rebuilds the document.
 */

// ---------------------------------------------------------------------------
// Raw catalog shape (matches docs/whatsapp-message-templates.json)
// ---------------------------------------------------------------------------

export interface RawGalleryTemplate {
  id: string;
  name: string;
  /** Human-readable variable hints, e.g. "{{1}} customer name". */
  variables?: string[];
  /** Body text keyed by 2-letter language code (must include 'en'). */
  text?: Record<string, string>;
}

export interface RawGalleryCategory {
  id: string;
  name: string;
  templates?: RawGalleryTemplate[];
}

export interface RawGalleryCatalog {
  categories?: RawGalleryCategory[];
}

// ---------------------------------------------------------------------------
// Normalized model
// ---------------------------------------------------------------------------

export interface GalleryVariable {
  /** 1-based number, matching {{n}} in the body text. */
  n: number;
  /** Label parsed from the catalog, e.g. "customer name". */
  label: string;
  /** Example value that satisfies Meta's review requirement. */
  example: string;
}

export interface GalleryTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  /** Body text keyed by 2-letter language code (always has 'en'). */
  text: Record<string, string>;
  variables: GalleryVariable[];
}

export interface GalleryCategory {
  id: string;
  /** Display label, e.g. "Marketing". */
  name: string;
  category: TemplateCategory;
  templates: GalleryTemplate[];
}

const CATEGORY_BY_ID: Record<string, TemplateCategory> = {
  marketing: 'MARKETING',
  utility: 'UTILITY',
  authentication: 'AUTHENTICATION',
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/** Meta template name: lowercase letters, digits and underscores only. */
export function slugifyTemplateName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, LIMITS.NAME_MAX);
  return slug || 'template';
}

/** Parse "{{1}} customer name" → { n: 1, label: "customer name" }. */
function parseVariableHint(raw: string): { n: number; label: string } | null {
  const match = raw.match(/\{\{\s*(\d+)\s*\}\}\s*(.*)$/);
  if (!match) return null;
  return { n: Number(match[1]), label: (match[2] ?? '').trim() };
}

/**
 * Keyword → example value, so an applied template previews with realistic
 * data instead of bare {{n}} placeholders. Ordered: first match wins.
 */
const EXAMPLE_RULES: Array<[RegExp, string]> = [
  [/(customer|client|recipient|user)\s*name|^name$/, 'Alex Morgan'],
  [/provider|staff/, 'Dr. Lee'],
  [/product|cart/, 'Aurora Headphones'],
  [/sale name/, 'Summer'],
  [/occasion|season/, 'Diwali'],
  [/webinar|demo|event name/, 'Growth Summit'],
  [/event highlight|topic|skill/, 'a live Q&A'],
  [/service/, 'Deep-tissue massage'],
  [/subscription|plan/, 'Pro'],
  [/tracking number/, '1Z999AA10123456784'],
  [/carrier/, 'DHL'],
  [/invoice number|order number|return request number|booking reference|reference|order/, '10248'],
  [
    /estimated delivery|renewal date|expiry date|delivery date|end date|date\/time|^date$/,
    'May 14',
  ],
  [/delivery time|^time$|\btime\b/, '3:00 PM'],
  [/address|location/, '221B Baker St'],
  [/items?/, '2× Aurora Headphones'],
  [/transaction amount|refund amount|amount|total/, '$149.00'],
  [/promo code|offer code|coupon|voucher/, 'SAVE20'],
  [/discount|offer/, '20%'],
  [/points/, '250'],
  [/payment method/, 'Visa •••• 4242'],
  [/status/, 'Approved'],
  [/change description/, 'email address'],
  [/referral reward|reward/, '$10 credit'],
  [/app|business/, 'Maildrill'],
  [/minutes|expiry|validity/, '10'],
  [/\bcode\b/, '839201'],
];

function exampleForLabel(label: string, n: number): string {
  const lower = label.toLowerCase();
  for (const [re, value] of EXAMPLE_RULES) {
    if (re.test(lower)) return value;
  }
  return label ? label.replace(/\b\w/g, (c) => c.toUpperCase()) : `Sample ${n}`;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizeGalleryCatalog(
  raw: RawGalleryCatalog | null | undefined,
): GalleryCategory[] {
  if (!raw?.categories) return [];
  const out: GalleryCategory[] = [];
  for (const cat of raw.categories) {
    const category = CATEGORY_BY_ID[(cat.id ?? '').toLowerCase()];
    if (!category) continue;
    const templates: GalleryTemplate[] = [];
    for (const t of cat.templates ?? []) {
      const text = t.text ?? {};
      if (Object.keys(text).length === 0) continue;
      const variables: GalleryVariable[] = [];
      for (const hint of t.variables ?? []) {
        const parsed = parseVariableHint(hint);
        if (!parsed) continue;
        variables.push({
          n: parsed.n,
          label: parsed.label,
          example: exampleForLabel(parsed.label, parsed.n),
        });
      }
      variables.sort((a, b) => a.n - b.n);
      templates.push({ id: t.id, name: t.name, category, text, variables });
    }
    if (templates.length > 0) out.push({ id: cat.id, name: cat.name, category, templates });
  }
  return out;
}

/** Body text for a language (2-letter match, English fallback). */
export function pickGalleryText(t: GalleryTemplate, language: string): string {
  const two = (language || 'en').slice(0, 2).toLowerCase();
  return t.text[two] ?? t.text.en ?? Object.values(t.text)[0] ?? '';
}

/**
 * Build a TemplateDoc from a gallery template, preserving the current doc's
 * name and language. Marketing/Utility fill a free-text body; Authentication
 * uses Meta's generated body + a code-expiration footer (the catalog copy is
 * only illustrative — Meta owns the wording for auth templates).
 */
export function galleryTemplateToDoc(t: GalleryTemplate, doc: TemplateDoc): TemplateDoc {
  if (t.category === 'AUTHENTICATION') {
    // Meta owns the copy for auth templates; the studio models exactly the
    // knobs the API accepts (generated body + code expiration) plus the
    // mandatory OTP button, so the applied template validates immediately.
    const otpPlugin = getButtonPlugin('otp');
    return {
      ...doc,
      category: 'AUTHENTICATION',
      blocks: {
        header: null,
        body: { id: newId('body'), type: 'body-auth', data: { securityRecommendation: true } },
        footer: { id: newId('footer'), type: 'footer-auth', data: { codeExpirationMinutes: 10 } },
        buttons: [
          {
            id: newId('btn'),
            type: 'otp',
            data: otpPlugin ? otpPlugin.defaults() : { otpType: 'COPY_CODE', text: 'Copy code' },
          },
        ],
      },
    };
  }

  const text = pickGalleryText(t, doc.language);
  const variables: VariableMap = {};
  for (const v of t.variables) {
    variables[String(v.n)] = { name: v.label, example: v.example };
  }

  return {
    ...doc,
    category: t.category,
    blocks: {
      header: null,
      body: { id: newId('body'), type: 'body', data: { text, variables } },
      footer: null,
      buttons: [],
    },
  };
}
