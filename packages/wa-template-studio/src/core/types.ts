import type { z } from 'zod';
import type * as React from 'react';

/**
 * Domain model for the WhatsApp Template Studio.
 *
 * A template is a fixed-slot document — that IS Meta's grammar (one
 * optional header, one body, one optional footer, one optional button
 * group) — but every slot's CONTENT is provided by a registered plugin,
 * so new Meta components mean new plugin registrations, never core
 * changes. Buttons are their own nested plugin system (`ButtonPlugin`)
 * because Meta grows that axis fastest.
 */

// ---------------------------------------------------------------------------
// Template document
// ---------------------------------------------------------------------------

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';

export type SlotName = 'header' | 'body' | 'footer' | 'buttons';

/** One placed block: which plugin renders it + its plugin-owned data. */
export interface BlockInstance<TData = unknown> {
  /** Stable instance id (selection, dnd, history). */
  id: string;
  /** Registered BlockPlugin type, e.g. 'header-image'. */
  type: string;
  data: TData;
}

/** One button inside the buttons block: which ButtonPlugin + its data. */
export interface ButtonInstance<TData = unknown> {
  id: string;
  /** Registered ButtonPlugin type, e.g. 'url', 'otp', 'flow'. */
  type: string;
  data: TData;
}

export interface TemplateDoc {
  /** Meta template name (lowercase snake_case enforced by validation). */
  name: string;
  /** Meta language code, e.g. 'en_US'. */
  language: string;
  category: TemplateCategory;
  blocks: {
    header: BlockInstance | null;
    body: BlockInstance;
    footer: BlockInstance | null;
    /** Ordered; empty array = no BUTTONS component. */
    buttons: ButtonInstance[];
  };
  /**
   * Fields from an imported Meta payload we don't model (forward
   * compatibility) — carried through export untouched (lossless
   * round-trip).
   */
  passthrough?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** Human message (already localized/plain English). */
  message: string;
  /** Where it lives, for badges/focus: slot or a specific instance. */
  slot: SlotName | 'template';
  blockId?: string;
  /** Stable code for tests/tooling, e.g. 'body/too-long'. */
  code: string;
}

// ---------------------------------------------------------------------------
// Meta payload (subset we model + open for passthrough)
// ---------------------------------------------------------------------------

/** A component object in Meta's template `components` array. */
export type MetaComponent = { type: string } & Record<string, unknown>;

/** A button object in Meta's BUTTONS component. */
export type MetaButton = { type: string } & Record<string, unknown>;

export interface MetaTemplate {
  name: string;
  language: string;
  category: TemplateCategory;
  components: MetaComponent[];
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Plugin contracts
// ---------------------------------------------------------------------------

export interface PreviewContext {
  doc: TemplateDoc;
  /** Resolve a {{n}} variable to its example value ('' when unset). */
  resolveVariable: (n: number) => string;
  dark: boolean;
}

export interface EditorProps<TData> {
  value: TData;
  onChange: (next: TData) => void;
  doc: TemplateDoc;
}

export interface PluginMeta {
  label: string;
  description: string;
  /** Library grouping, e.g. 'Headers', 'Buttons'. */
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Extra search terms for the library search. */
  keywords?: string[];
}

/** Why a plugin is unavailable, shown as a disabled-tile tooltip. */
export type Availability = { available: true } | { available: false; reason: string };

interface BasePlugin<TData> {
  /** Unique registry key, e.g. 'header-text', 'quick-reply'. */
  type: string;
  meta: PluginMeta;
  schema: z.ZodType<TData>;
  defaults: () => TData;
  /** Category gating (e.g. OTP only in AUTHENTICATION). */
  availableIn: (category: TemplateCategory, doc: TemplateDoc) => Availability;
  /** Block-local validation; cross-block rules live in the engine. */
  validate: (data: TData, doc: TemplateDoc) => ValidationIssue[];
  /** Properties form (right sidebar). */
  Editor: React.ComponentType<EditorProps<TData>>;
  /** WhatsApp-faithful preview rendering (center canvas). */
  Preview: React.ComponentType<{ data: TData; ctx: PreviewContext }>;
}

export interface BlockPlugin<TData = unknown> extends BasePlugin<TData> {
  slot: Exclude<SlotName, 'buttons'>;
  /** Serialize into Meta component(s); null = contributes nothing. */
  toMeta: (data: TData, doc: TemplateDoc) => MetaComponent | null;
  /**
   * Import matcher: return data when this plugin can represent the
   * Meta component, null to let other plugins try.
   */
  fromMeta: (component: MetaComponent, template: MetaTemplate) => TData | null;
}

export interface ButtonPlugin<TData = unknown> extends BasePlugin<TData> {
  /** Max instances per template (e.g. URL: 2, phone: 1). Infinity ok. */
  maxPerTemplate: number;
  toMeta: (data: TData, doc: TemplateDoc) => MetaButton | null;
  fromMeta: (button: MetaButton, template: MetaTemplate) => TData | null;
}

// ---------------------------------------------------------------------------
// Ids
// ---------------------------------------------------------------------------

let counter = 0;

export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Math.random().toString(36).slice(2, 8)}`;
}
