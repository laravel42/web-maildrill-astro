import { and, eq } from "drizzle-orm";
import { db, templates, type TemplateRow } from "@maildrill/database";
import { config } from "@maildrill/config";
import {
  getProvider,
  type RegisterTemplateInput,
  type TemplateStatusEvent,
  type WhatsAppTemplateStructure,
} from "@maildrill/providers";

/** The configured WhatsApp sender, digits only — the Infobip `{sender}` path param. */
function whatsappSender(): string {
  return config.infobip.whatsappFrom.replace(/\D/g, "");
}

/** Reconstruct the WhatsApp template structure a template was authored with. */
function structureOf(row: TemplateRow): WhatsAppTemplateStructure | null {
  const c = (row.components ?? {}) as Record<string, unknown>;
  const body = (c.body ?? {}) as { text?: unknown; examples?: unknown };
  const text = typeof body.text === "string" ? body.text : (row.text ?? "");
  if (!text) return null;

  const structure: WhatsAppTemplateStructure = { body: { text } };
  if (Array.isArray(body.examples)) {
    const examples = body.examples.filter((e): e is string => typeof e === "string");
    if (examples.length) structure.body.examples = examples;
  }
  if (c.header && typeof c.header === "object") {
    structure.header = c.header as WhatsAppTemplateStructure["header"];
  }
  if (c.footer && typeof c.footer === "object") {
    structure.footer = c.footer as WhatsAppTemplateStructure["footer"];
  }
  if (Array.isArray(c.buttons) && c.buttons.length) {
    structure.buttons = c.buttons as WhatsAppTemplateStructure["buttons"];
  }
  return structure;
}

function categoryOf(row: TemplateRow): RegisterTemplateInput["category"] {
  const c = (row.components ?? {}) as Record<string, unknown>;
  const cat = typeof c.category === "string" ? c.category.toUpperCase() : "";
  return cat === "UTILITY" || cat === "AUTHENTICATION" ? cat : "MARKETING";
}

async function loadTemplate(tenantId: string, id: string): Promise<TemplateRow | null> {
  const rows = await db
    .select()
    .from(templates)
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .limit(1);
  return rows[0] ?? null;
}

export interface TemplateApprovalResult {
  template: TemplateRow | null;
  error?: string;
}

/**
 * Submit a WhatsApp template to the provider for Meta review. Persists the
 * returned provider template id and starting status (usually `pending`).
 */
export async function submitTemplateForApproval(
  tenantId: string,
  id: string,
): Promise<TemplateApprovalResult> {
  const row = await loadTemplate(tenantId, id);
  if (!row) return { template: null, error: "not_found" };
  if (row.channel !== "whatsapp") {
    return { template: row, error: "only WhatsApp templates require approval" };
  }
  const structure = structureOf(row);
  if (!structure) return { template: row, error: "template body text is required" };
  const sender = whatsappSender();
  if (!sender) {
    return { template: row, error: "no WhatsApp sender configured (INFOBIP_WHATSAPP_FROM)" };
  }

  const provider = getProvider();
  if (!provider.registerWhatsAppTemplate) {
    return { template: row, error: `provider ${provider.name} cannot register templates` };
  }
  const input: RegisterTemplateInput = {
    sender,
    // Infobip/Meta require lowercase alphanumeric + underscores.
    name: row.name,
    language: row.language ?? "en",
    category: categoryOf(row),
    structure,
  };
  if (!/^[a-z0-9_]+$/.test(input.name)) {
    // Soft-normalize for the provider call; keep DB display name as authored.
    input.name = input.name
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_")
      .replace(/[^a-z0-9_]/g, "")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "");
  }
  if (!input.name) {
    return {
      template: row,
      error:
        "WhatsApp template name must contain lowercase letters, numbers, or underscores (e.g. welcome_offer)",
    };
  }
  const result = await provider.registerWhatsAppTemplate(input);
  if (!result.ok) return { template: row, error: result.error?.message ?? "submission failed" };

  const updated = await db
    .update(templates)
    .set({
      approvalStatus: result.status ?? "pending",
      providerTemplateId: result.providerTemplateId ?? row.providerTemplateId ?? null,
      rejectionReason: null,
      updatedAt: new Date(),
    })
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .returning();
  return { template: updated[0] ?? row };
}

/**
 * Pull the current status for a submitted template straight from the provider
 * (manual fallback when a status webhook was missed).
 */
export async function refreshTemplateStatus(
  tenantId: string,
  id: string,
): Promise<TemplateApprovalResult> {
  const row = await loadTemplate(tenantId, id);
  if (!row) return { template: null, error: "not_found" };
  if (row.channel !== "whatsapp") {
    return { template: row, error: "only WhatsApp templates have an approval status" };
  }
  const sender = whatsappSender();
  if (!sender) return { template: row, error: "no WhatsApp sender configured" };

  const provider = getProvider();
  if (!provider.listWhatsAppTemplates) {
    return { template: row, error: `provider ${provider.name} cannot list templates` };
  }
  const result = await provider.listWhatsAppTemplates(sender);
  if (!result.ok) return { template: row, error: result.error?.message ?? "status refresh failed" };

  const match =
    result.templates.find((t) => t.id === row.providerTemplateId) ??
    result.templates.find(
      (t) => t.name === row.name && (!row.language || t.language === row.language),
    );
  if (!match) return { template: row }; // not visible remotely yet — leave as-is

  const updated = await db
    .update(templates)
    .set({
      approvalStatus: match.status,
      providerTemplateId: match.id,
      rejectionReason: match.rejectionReason ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(templates.id, id), eq(templates.tenantId, tenantId)))
    .returning();
  return { template: updated[0] ?? row };
}

/**
 * Apply an inbound provider template-status webhook. Correlates purely on the
 * provider template id (the webhook carries no tenant), which is globally unique.
 * Returns the number of rows updated.
 *
 * Prefer {@link pollPendingWhatsAppTemplates} for product truth — Infobip
 * template-status notify URLs should point at PostHog for analytics.
 */
export async function applyTemplateStatusEvent(event: TemplateStatusEvent): Promise<number> {
  const updated = await db
    .update(templates)
    .set({
      approvalStatus: event.status,
      rejectionReason: event.rejectionReason ?? null,
      updatedAt: new Date(),
    })
    .where(eq(templates.providerTemplateId, event.providerTemplateId))
    .returning({ id: templates.id });
  return updated.length;
}

export interface PollPendingTemplatesResult {
  checked: number;
  updated: number;
  errors: number;
}

/**
 * Poll Infobip for WhatsApp templates still awaiting Meta review and sync
 * approvalStatus into Postgres. One listTemplates call per configured sender.
 */
export async function pollPendingWhatsAppTemplates(): Promise<PollPendingTemplatesResult> {
  const pending = await db
    .select({
      id: templates.id,
      tenantId: templates.tenantId,
      name: templates.name,
      language: templates.language,
      providerTemplateId: templates.providerTemplateId,
      approvalStatus: templates.approvalStatus,
    })
    .from(templates)
    .where(
      and(
        eq(templates.channel, "whatsapp"),
        eq(templates.approvalStatus, "pending"),
      ),
    );

  const withProviderId = pending.filter((r) => Boolean(r.providerTemplateId));
  if (withProviderId.length === 0) {
    return { checked: 0, updated: 0, errors: 0 };
  }

  const sender = whatsappSender();
  if (!sender) {
    return { checked: withProviderId.length, updated: 0, errors: 1 };
  }

  const provider = getProvider();
  if (!provider.listWhatsAppTemplates) {
    return { checked: withProviderId.length, updated: 0, errors: 1 };
  }

  const listed = await provider.listWhatsAppTemplates(sender);
  if (!listed.ok) {
    return { checked: withProviderId.length, updated: 0, errors: 1 };
  }

  let updated = 0;
  for (const row of withProviderId) {
    const match =
      listed.templates.find((t) => t.id === row.providerTemplateId) ??
      listed.templates.find(
        (t) => t.name === row.name && (!row.language || t.language === row.language),
      );
    if (!match) continue;
    if (match.status === row.approvalStatus && match.id === row.providerTemplateId) {
      continue;
    }

    await db
      .update(templates)
      .set({
        approvalStatus: match.status,
        providerTemplateId: match.id,
        rejectionReason: match.rejectionReason ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(templates.id, row.id), eq(templates.tenantId, row.tenantId)));
    updated += 1;
  }

  return { checked: withProviderId.length, updated, errors: 0 };
}
