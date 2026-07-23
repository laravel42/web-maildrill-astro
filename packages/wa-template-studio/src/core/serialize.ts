import { getBlockPlugin, getButtonPlugin, listBlockPlugins, listButtonPlugins } from './registry';
import { hasErrors, validateTemplate } from './validation';
import { newId, type MetaButton, type MetaComponent, type MetaTemplate, type TemplateDoc } from './types';

/**
 * Serialization: TemplateDoc ⇄ Meta template JSON.
 *
 * Export walks the slots and asks each placed plugin for its Meta
 * component; import walks Meta's `components` and asks every
 * registered plugin's `fromMeta` matcher — so new component types
 * round-trip as soon as their plugin is registered. Unrecognized
 * components/fields are preserved on `doc.passthrough` and re-emitted
 * verbatim (lossless).
 */

export interface ExportOptions {
  /** Throw instead of exporting when validation has errors. */
  strict?: boolean;
}

export class InvalidTemplateError extends Error {
  constructor(public issues: ReturnType<typeof validateTemplate>) {
    super('Template has validation errors and cannot be exported');
    this.name = 'InvalidTemplateError';
  }
}

export function toMetaJson(doc: TemplateDoc, options: ExportOptions = {}): MetaTemplate {
  if (options.strict) {
    const issues = validateTemplate(doc);
    if (hasErrors(issues)) throw new InvalidTemplateError(issues);
  }

  const components: MetaComponent[] = [];

  for (const slot of ['header', 'body', 'footer'] as const) {
    const instance = doc.blocks[slot];
    if (!instance) continue;
    const plugin = getBlockPlugin(instance.type);
    const component = plugin?.toMeta(instance.data, doc);
    if (component) components.push(component);
  }

  const buttons: MetaButton[] = [];
  for (const b of doc.blocks.buttons) {
    const plugin = getButtonPlugin(b.type);
    const btn = plugin?.toMeta(b.data, doc);
    if (btn) buttons.push(btn);
  }
  if (buttons.length > 0) components.push({ type: 'BUTTONS', buttons });

  // Re-emit imported components we don't model (forward compatibility).
  const passthroughComponents = (doc.passthrough?.components as MetaComponent[] | undefined) ?? [];
  components.push(...passthroughComponents);

  const passthroughRoot = { ...(doc.passthrough ?? {}) };
  delete passthroughRoot.components;

  return {
    ...passthroughRoot,
    name: doc.name,
    language: doc.language,
    category: doc.category,
    components,
  };
}

/** Pretty / minified JSON string exports for the clipboard. */
export function toMetaJsonString(doc: TemplateDoc, pretty: boolean, options?: ExportOptions): string {
  const json = toMetaJson(doc, options);
  return pretty ? JSON.stringify(json, null, 2) : JSON.stringify(json);
}

/** Internal-format export (the editable doc itself). */
export function toInternalJson(doc: TemplateDoc): string {
  return JSON.stringify(doc, null, 2);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

const KNOWN_ROOT_KEYS = new Set(['name', 'language', 'category', 'components', 'id', 'status']);

export function fromMetaJson(input: MetaTemplate | string): TemplateDoc {
  const template: MetaTemplate = typeof input === 'string' ? (JSON.parse(input) as MetaTemplate) : input;

  const doc: TemplateDoc = {
    name: template.name ?? '',
    language: template.language ?? 'en_US',
    category: (template.category as TemplateDoc['category']) ?? 'MARKETING',
    blocks: { header: null, body: emptyBody(), footer: null, buttons: [] },
  };

  const unmatchedComponents: MetaComponent[] = [];

  for (const component of template.components ?? []) {
    const type = String(component.type ?? '').toUpperCase();

    if (type === 'BUTTONS') {
      const metaButtons = (component.buttons as MetaButton[] | undefined) ?? [];
      for (const metaButton of metaButtons) {
        const matched = matchButton(metaButton, template);
        if (matched) {
          doc.blocks.buttons.push({ id: newId('btn'), type: matched.type, data: matched.data });
        } else {
          // Preserve unknown buttons losslessly.
          unmatchedComponents.push({ type: 'BUTTONS', buttons: [metaButton] });
        }
      }
      continue;
    }

    const matched = matchBlock(component, template);
    if (matched) {
      const slot = matched.plugin.slot;
      doc.blocks[slot] = { id: newId(slot), type: matched.plugin.type, data: matched.data };
    } else {
      unmatchedComponents.push(component);
    }
  }

  // Preserve unknown root-level fields + unmatched components.
  const passthrough: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(template)) {
    if (!KNOWN_ROOT_KEYS.has(k)) passthrough[k] = v;
  }
  if (unmatchedComponents.length > 0) passthrough.components = unmatchedComponents;
  if (Object.keys(passthrough).length > 0) doc.passthrough = passthrough;

  return doc;
}

function matchBlock(component: MetaComponent, template: MetaTemplate) {
  for (const plugin of listBlockPlugins()) {
    const data = plugin.fromMeta(component, template);
    if (data !== null) return { plugin, data };
  }
  return null;
}

function matchButton(button: MetaButton, template: MetaTemplate) {
  for (const plugin of listButtonPlugins()) {
    const data = plugin.fromMeta(button, template);
    if (data !== null) return { type: plugin.type, data };
  }
  return null;
}

function emptyBody() {
  const plugin = getBlockPlugin('body');
  return { id: newId('body'), type: 'body', data: plugin ? plugin.defaults() : { text: '', variables: {} } };
}
