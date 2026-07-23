import { z } from 'zod';

import { BUTTON_TYPES, HEADER_FORMATS, WA_CATEGORIES } from './whatsapp';

/**
 * WhatsApp block schemas.
 *
 * Mirrors `@eb/document-core`'s conventions: a flat document
 * `Record<blockId, { type, data }>` rooted at `'root'`, one zod schema
 * per block type, and a discriminated union over `type`. Unlike email
 * blocks there is NO `data.style` — WhatsApp fixes all styling, so
 * every block carries only `data.props` (content).
 *
 * Fields are `.optional()` with render-time fallbacks (same convention
 * as the email block schemas) so factories and seeds stay content-only.
 */

export const WhatsAppMessagePropsSchema = z
  .object({
    /** Meta template language code, e.g. 'en', 'es_MX'. */
    language: z.string().optional(),
    /** Meta template category. */
    category: z.enum(WA_CATEGORIES).optional(),
    /**
     * Ordered section ids. The store enforces at most one section per
     * type and the canonical header → body → footer → buttons order.
     */
    childrenIds: z.array(z.string()).optional(),
  })
  .passthrough();
export type WhatsAppMessageProps = z.infer<typeof WhatsAppMessagePropsSchema>;

export const HeaderPropsSchema = z
  .object({
    props: z
      .object({
        format: z.enum(HEADER_FORMATS).optional(),
        /** Text-format header content (max 60 chars, one {{1}}). */
        text: z.string().optional(),
        /** Media-format header sample/handle URL (image/video/document). */
        mediaUrl: z.string().optional(),
        /** Location-format display name + address (preview only). */
        locationName: z.string().optional(),
        locationAddress: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();
export type HeaderProps = z.infer<typeof HeaderPropsSchema>;

export const BodyPropsSchema = z
  .object({
    props: z
      .object({
        /** Body text: WA markdown (*b* _i_ ~s~ ```m```) + {{n}} variables. */
        text: z.string().optional(),
        /** Example values for {{n}} variables, index n-1. */
        examples: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .passthrough();
export type BodyProps = z.infer<typeof BodyPropsSchema>;

export const FooterPropsSchema = z
  .object({
    props: z
      .object({
        /** Plain text, max 60 chars. No markdown, no variables. */
        text: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();
export type FooterProps = z.infer<typeof FooterPropsSchema>;

export const WaButtonSchema = z.object({
  type: z.enum(BUTTON_TYPES),
  /** Visible label (all types; for COPY_CODE Meta shows "Copy offer code"). */
  text: z.string().optional(),
  /** URL buttons: target, may end with one {{1}} variable. */
  url: z.string().optional(),
  /** PHONE_NUMBER buttons: full number incl. country code. */
  phoneNumber: z.string().optional(),
  /** COPY_CODE buttons: the offer code example. */
  couponCode: z.string().optional(),
});
export type WaButton = z.infer<typeof WaButtonSchema>;

export const ButtonsPropsSchema = z
  .object({
    props: z
      .object({
        buttons: z.array(WaButtonSchema).optional(),
      })
      .optional(),
  })
  .passthrough();
export type ButtonsProps = z.infer<typeof ButtonsPropsSchema>;

export const WhatsAppBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('WhatsAppMessage'), data: WhatsAppMessagePropsSchema }),
  z.object({ type: z.literal('Header'), data: HeaderPropsSchema }),
  z.object({ type: z.literal('Body'), data: BodyPropsSchema }),
  z.object({ type: z.literal('Footer'), data: FooterPropsSchema }),
  z.object({ type: z.literal('Buttons'), data: ButtonsPropsSchema }),
]);
export type TWhatsAppBlock = z.infer<typeof WhatsAppBlockSchema>;

export const WhatsAppConfigurationSchema = z.record(z.string(), WhatsAppBlockSchema);
export type TWhatsAppConfiguration = z.infer<typeof WhatsAppConfigurationSchema>;

export const BLOCK_TYPES = ['WhatsAppMessage', 'Header', 'Body', 'Footer', 'Buttons'] as const;
export type WhatsAppBlockType = (typeof BLOCK_TYPES)[number];

/** Section types insertable from the palette (everything except the root). */
export const SECTION_TYPES = ['Header', 'Body', 'Footer', 'Buttons'] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** Canonical WhatsApp template section order. */
export const SECTION_ORDER: Record<SectionType, number> = {
  Header: 0,
  Body: 1,
  Footer: 2,
  Buttons: 3,
};
