import { and, desc, eq } from "drizzle-orm";
import {
  db,
  templates,
  type NewTemplate,
  type Subscriber,
  type TemplateRow,
} from "@maildrill/database";
import type { Channel } from "@maildrill/domain";

export interface UpsertTemplateInput {
  tenantId: string;
  name: string;
  channel?: Channel;
  subject?: string | null;
  preheader?: string | null;
  html?: string | null;
  text?: string | null;
  builderDoc?: Record<string, unknown> | null;
  category?: string | null;
  favorite?: boolean;
  /** WhatsApp template language tag (e.g. "en"); null on other channels. */
  language?: string | null;
  /** WhatsApp template structure (header/body/footer/buttons + placeholder map). */
  components?: Record<string, unknown> | null;
}

export async function createTemplate(input: UpsertTemplateInput): Promise<TemplateRow> {
  const rows = await db
    .insert(templates)
    .values({
      tenantId: input.tenantId,
      name: input.name,
      channel: input.channel ?? "email",
      subject: input.subject ?? null,
      preheader: input.preheader ?? null,
      html: input.html ?? null,
      text: input.text ?? null,
      builderDoc: input.builderDoc ?? null,
      category: input.category ?? null,
      favorite: input.favorite ?? false,
      language: input.language ?? null,
      components: input.components ?? null,
      // WhatsApp templates start as an unsubmitted draft; other channels don't
      // carry an approval status at all.
      approvalStatus: (input.channel ?? "email") === "whatsapp" ? "draft" : null,
    })
    .returning();
  return rows[0]!;
}

export async function getTemplate(
  tenantId: string,
  id: string,
): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function listTemplates(tenantId: string): Promise<TemplateRow[]> {
  return db
    .select()
    .from(templates)
    .where(eq(templates.tenantId, tenantId))
    .orderBy(desc(templates.createdAt));
}

export async function updateTemplate(
  tenantId: string,
  id: string,
  patch: Partial<Omit<UpsertTemplateInput, "tenantId">>,
): Promise<TemplateRow | null> {
  const set: Partial<NewTemplate> = { updatedAt: new Date() };
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.channel !== undefined) set.channel = patch.channel;
  if (patch.subject !== undefined) set.subject = patch.subject;
  if (patch.preheader !== undefined) set.preheader = patch.preheader;
  if (patch.html !== undefined) set.html = patch.html;
  if (patch.text !== undefined) set.text = patch.text;
  if (patch.builderDoc !== undefined) set.builderDoc = patch.builderDoc;
  if (patch.category !== undefined) set.category = patch.category;
  if (patch.favorite !== undefined) set.favorite = patch.favorite;
  if (patch.language !== undefined) set.language = patch.language;
  if (patch.components !== undefined) set.components = patch.components;

  const rows = await db
    .update(templates)
    .set(set)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteTemplate(tenantId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .returning({ id: templates.id });
  return rows.length > 0;
}

export interface RenderedContent {
  subject?: string;
  html?: string;
  text?: string;
}

/** Resolve one token (`email`/`name`/`phone`/`attributes.x`/bare attr) for a subscriber. */
function subscriberToken(sub: Subscriber, key: string): string {
  if (key === "email") return sub.email;
  if (key === "name") return sub.name ?? "";
  if (key === "phone") return sub.phone ?? "";
  const attrKey = key.startsWith("attributes.")
    ? key.slice("attributes.".length)
    : key;
  const v = sub.attributes[attrKey];
  return v == null ? "" : String(v);
}

/**
 * Render a template for a subscriber, substituting `{{email}}`, `{{name}}`,
 * `{{phone}}`, and `{{attributes.key}}` (or bare `{{key}}`) tokens from the
 * subscriber record.
 */
export function renderTemplate(
  tpl: TemplateRow,
  sub: Subscriber,
): Record<string, unknown> {
  const merge = (s: string | null): string | undefined =>
    s == null
      ? undefined
      : s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => subscriberToken(sub, k));

  return { subject: merge(tpl.subject), html: merge(tpl.html), text: merge(tpl.text) };
}

/**
 * Resolve a WhatsApp template's ordered body placeholders ({{1}}, {{2}}, …) for a
 * subscriber. `components.placeholders` maps each position to a subscriber token
 * (e.g. `["name", "attributes.orderId"]`); missing/non-string tokens become "".
 */
export function resolveTemplatePlaceholders(tpl: TemplateRow, sub: Subscriber): string[] {
  const components = (tpl.components ?? {}) as { placeholders?: unknown };
  const tokens = Array.isArray(components.placeholders) ? components.placeholders : [];
  return tokens.map((t) => (typeof t === "string" ? subscriberToken(sub, t) : ""));
}
