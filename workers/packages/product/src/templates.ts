import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import {
  campaigns,
  db,
  messageEvents,
  messages,
  templates,
  type NewTemplate,
  type Subscriber,
  type TemplateRow,
} from '@maildrill/database';
import type { Channel } from '@maildrill/domain';
import { config } from '@maildrill/config';
import { unsubscribeUrl, webviewUrl } from '@maildrill/services';

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
      channel: input.channel ?? 'email',
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
      approvalStatus: (input.channel ?? 'email') === 'whatsapp' ? 'draft' : null,
    })
    .returning();
  return rows[0]!;
}

export async function getTemplate(tenantId: string, id: string): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface TemplateEngagement {
  /**
   * Deliveries on open-trackable channels (email + WhatsApp) across campaigns
   * that sent this template — the open/click rate denominator. SMS and voice
   * deliveries can never produce an open, so counting them would dilute rates.
   */
  trackedDelivered: number;
  opened: number;
  clicked: number;
  /**
   * Outcomes on every channel, so SMS and voice templates have something real
   * to report — their `trackedDelivered` is 0 by construction, which would
   * otherwise peg their open/click rates at 0% forever.
   */
  sent: number;
  delivered: number;
  failed: number;
}

/**
 * Templates with real engagement aggregated from the campaigns that used them
 * (via campaigns.template_id → messages / message_events), mirroring the
 * lists/subscribers convention. Templates never sent report zeroes.
 */
export async function listTemplates(
  tenantId: string,
): Promise<Array<TemplateRow & TemplateEngagement>> {
  const rows = await db
    .select()
    .from(templates)
    .where(eq(templates.tenantId, tenantId))
    .orderBy(desc(templates.createdAt));

  const outcomes = await db
    .select({
      templateId: campaigns.templateId,
      trackedDelivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read') and ${messages.channel} in ('email', 'whatsapp'))::int`,
      opened: sql<number>`count(*) filter (where ${messages.status} = 'read')::int`,
      sent: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${messages.status} in ('delivered', 'read'))::int`,
      failed: sql<number>`count(*) filter (where ${messages.status} = 'failed')::int`,
    })
    .from(messages)
    .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
    .where(and(eq(messages.tenantId, tenantId), isNotNull(campaigns.templateId)))
    .groupBy(campaigns.templateId);

  const clicks = await db
    .select({
      templateId: campaigns.templateId,
      clicked: sql<number>`count(distinct ${messageEvents.messageId})::int`,
    })
    .from(messageEvents)
    .innerJoin(messages, eq(messageEvents.messageId, messages.id))
    .innerJoin(campaigns, eq(messages.campaignId, campaigns.id))
    .where(
      and(
        eq(messages.tenantId, tenantId),
        eq(messageEvents.eventType, 'click'),
        isNotNull(campaigns.templateId),
      ),
    )
    .groupBy(campaigns.templateId);

  const outcomeByTpl = new Map(outcomes.filter((o) => o.templateId).map((o) => [o.templateId!, o]));
  const clicksByTpl = new Map(clicks.filter((c) => c.templateId).map((c) => [c.templateId!, c]));

  return rows.map((t) => ({
    ...t,
    trackedDelivered: outcomeByTpl.get(t.id)?.trackedDelivered ?? 0,
    opened: outcomeByTpl.get(t.id)?.opened ?? 0,
    clicked: clicksByTpl.get(t.id)?.clicked ?? 0,
    sent: outcomeByTpl.get(t.id)?.sent ?? 0,
    delivered: outcomeByTpl.get(t.id)?.delivered ?? 0,
    failed: outcomeByTpl.get(t.id)?.failed ?? 0,
  }));
}

export async function updateTemplate(
  tenantId: string,
  id: string,
  patch: Partial<Omit<UpsertTemplateInput, 'tenantId'>>,
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
/** Extra context a token may need beyond the subscriber record. */
export interface MergeContext {
  campaignId?: string;
}

function subscriberToken(sub: Subscriber, key: string, ctx?: MergeContext): string {
  // The unsubscribe link is per recipient and signed, so it resolves from the
  // subscriber rather than a stored value. Anything unresolved still falls
  // through to attributes and renders empty, so an unknown tag stays harmless
  // — but this one must never render empty in a marketing email.
  // A test send builds a synthetic recipient with no id or tenant, so there is
  // nobody to sign a token for. Emit the bare page — which says the link is
  // incomplete — rather than a token over the string "undefined".
  const real = Boolean(sub.id && sub.tenantId);
  if (key === 'unsubscribe')
    return real
      ? unsubscribeUrl({ tenantId: sub.tenantId, subscriberId: sub.id })
      : `${config.app.url}/unsubscribe`;
  if (key === 'webview')
    return real
      ? webviewUrl({
          tenantId: sub.tenantId,
          subscriberId: sub.id,
          ...(ctx?.campaignId ? { campaignId: ctx.campaignId } : {}),
        })
      : `${config.app.url}/view`;
  if (key === 'email') return sub.email;
  if (key === 'name') return sub.name ?? '';
  if (key === 'phone') return sub.phone ?? '';
  const attrKey = key.startsWith('attributes.') ? key.slice('attributes.'.length) : key;
  const v = sub.attributes[attrKey];
  return v == null ? '' : String(v);
}

/**
 * Substitute `{{email}}`, `{{name}}`, `{{phone}}`, `{{unsubscribe}}` and
 * `{{attributes.key}}` (or bare `{{key}}`) tokens anywhere in a string from the
 * subscriber record.
 */
export function mergeSubscriberTokens(s: string, sub: Subscriber, ctx?: MergeContext): string {
  return s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, k: string) => subscriberToken(sub, k, ctx));
}

/** Render a template's copy fields for a subscriber. */
export function renderTemplate(tpl: TemplateRow, sub: Subscriber): Record<string, unknown> {
  const merge = (s: string | null): string | undefined =>
    s == null ? undefined : mergeSubscriberTokens(s, sub);

  return {
    subject: merge(tpl.subject),
    preheader: merge(tpl.preheader),
    html: merge(tpl.html),
    text: merge(tpl.text),
  };
}

/** Numbered WhatsApp placeholders ({{1}}, {{2}}, …) as opposed to merge tokens. */
const WA_VARIABLE_RE = /\{\{\s*(\d+)\s*\}\}/g;

/**
 * {{n}} → subscriber token from the WA studio doc's body variable map, where the
 * editor stores each variable's merge tag as `source` (e.g. `{{attributes.x}}`).
 */
function builderDocVariableSources(tpl: TemplateRow): Record<string, string> {
  const doc = tpl.builderDoc as { blocks?: { body?: { data?: { variables?: unknown } } } } | null;
  const vars = doc?.blocks?.body?.data?.variables;
  const out: Record<string, string> = {};
  if (!vars || typeof vars !== 'object') return out;
  for (const [n, meta] of Object.entries(vars as Record<string, unknown>)) {
    const source = (meta as { source?: unknown } | null)?.source;
    if (typeof source !== 'string') continue;
    const m = /^\{\{\s*([\w.]+)\s*\}\}$/.exec(source.trim());
    if (m) out[n] = m[1]!;
  }
  return out;
}

/**
 * Resolve a WhatsApp template's ordered body placeholders ({{1}}, {{2}}, …) for a
 * subscriber. Every position the registered body uses MUST get a non-empty value
 * or Meta rejects the send (EC_INVALID_TEMPLATE_ARGS), so each one resolves
 * through a fallback chain:
 *
 *   1. `components.placeholders[i]` subscriber token (e.g. `"attributes.orderId"`)
 *   2. the studio builderDoc's `variables[n].source` merge tag
 *   3. the Meta-review example value (`components.body.examples[i]`) as a literal
 */
export function resolveTemplatePlaceholders(tpl: TemplateRow, sub: Subscriber): string[] {
  const components = (tpl.components ?? {}) as {
    placeholders?: unknown;
    body?: { text?: unknown; examples?: unknown };
  };
  const bodyText =
    typeof components.body?.text === 'string' ? components.body.text : (tpl.text ?? '');
  let count = 0;
  for (const m of bodyText.matchAll(WA_VARIABLE_RE)) count = Math.max(count, Number(m[1]));

  const tokens = Array.isArray(components.placeholders) ? components.placeholders : [];
  count = Math.max(count, tokens.length);
  if (count === 0) return [];

  const examples = Array.isArray(components.body?.examples) ? components.body.examples : [];
  const sources = builderDocVariableSources(tpl);

  return Array.from({ length: count }, (_, i) => {
    const token = tokens[i];
    let v = typeof token === 'string' && token ? subscriberToken(sub, token) : '';
    if (!v) {
      const source = sources[String(i + 1)];
      if (source) v = subscriberToken(sub, source);
    }
    if (!v && examples[i] != null) v = String(examples[i]);
    return v;
  });
}

/** Provider-facing body fields; strips UI metadata stored alongside (e.g. audienceIds). */
const MESSAGE_CONTENT_KEYS = [
  'subject',
  'html',
  'text',
  'from',
  'preheader',
  // Email open/click tracking opt-outs chosen in the campaign wizard
  // (`false` disables; absent = provider default). Booleans survive the
  // empty-value filter below.
  'trackOpens',
  'trackClicks',
  // Voice TTS language / voice selection (ignored by email/SMS builders).
  'language',
  'voiceName',
  'voiceGender',
  'speechRate',
  'audioFileUrl',
] as const;

function messageContentOverrides(
  raw: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!raw) return {};
  const out: Record<string, unknown> = {};
  for (const key of MESSAGE_CONTENT_KEYS) {
    const v = raw[key];
    if (v !== undefined && v !== null && v !== '') out[key] = v;
  }
  return out;
}

/** User-authored copy fields that may carry {{merge}} tags, whichever source they came from. */
const COPY_FIELDS = ['subject', 'html', 'text', 'preheader'] as const;

function renderCopyFields(
  content: Record<string, unknown>,
  sub: Subscriber,
  ctx?: MergeContext,
): Record<string, unknown> {
  for (const key of COPY_FIELDS) {
    const v = content[key];
    if (typeof v === 'string') content[key] = mergeSubscriberTokens(v, sub, ctx);
  }
  return content;
}

/**
 * Final provider content for one recipient: template body (if any) merged with
 * campaign-level overrides, then subscriber tokens substituted exactly once in
 * every copy field. Campaign-authored copy (an email subject, a composer SMS /
 * voice script stored on the campaign with no template) personalizes the same
 * way a template body does, on every channel.
 */
export function resolveMessageContent(
  template: TemplateRow | null,
  sub: Subscriber,
  overrides: Record<string, unknown> | undefined,
  channel: Channel,
  ctx?: MergeContext,
): Record<string, unknown> {
  const campaign = messageContentOverrides(overrides);
  if (!template) return renderCopyFields(campaign, sub, ctx);

  // Approved WhatsApp templates send via the template endpoint: pass the template
  // name/language plus the ordered placeholder values resolved per recipient.
  if (channel === 'whatsapp' && template.approvalStatus === 'approved') {
    // Infobip/Meta template names are lowercase; DB may still hold a display name.
    const templateName = template.name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    return renderCopyFields(
      {
        templateName,
        templateLanguage: template.language ?? 'en',
        placeholders: resolveTemplatePlaceholders(template, sub),
        ...campaign,
      },
      sub,
      ctx,
    );
  }

  // Templates carry body only (html/text/preheader). Subject lives on the campaign.
  const body: Record<string, unknown> = {};
  if (template.html) body.html = template.html;
  if (template.text) body.text = template.text;
  if (template.preheader) body.preheader = template.preheader;

  // Voice templates persist their TTS selection in builderDoc
  // ({ voice: { name, gender, sayLanguage }, speechRate }) — surface it as
  // provider content so delivery speaks the authored voice. Campaign-level
  // overrides still win via the spread below.
  if (channel === 'voice' && template.builderDoc) {
    const doc = template.builderDoc as Record<string, unknown>;
    const voice = (doc.voice ?? {}) as Record<string, unknown>;
    if (typeof voice.sayLanguage === 'string') body.language = voice.sayLanguage;
    if (typeof voice.name === 'string') body.voiceName = voice.name;
    if (typeof voice.gender === 'string') body.voiceGender = voice.gender;
    if (typeof doc.speechRate === 'number') body.speechRate = doc.speechRate;
  }
  return renderCopyFields({ ...body, ...campaign }, sub, ctx);
}
