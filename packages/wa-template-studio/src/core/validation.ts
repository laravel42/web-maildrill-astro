import { CATEGORY_CAPS, LIMITS, TEMPLATE_NAME_RE } from './limits';
import { getBlockPlugin, getButtonPlugin } from './registry';
import type { TemplateDoc, ValidationIssue } from './types';

/**
 * Validation engine. Three layers, all live:
 *
 *  1. plugin-local rules   — each plugin's `validate(data, doc)`
 *  2. cross-block rules    — counts, grouping, slot/category compat
 *  3. template-level rules — name, language
 *
 * Errors gate Meta-JSON export (never emit an invalid payload);
 * warnings inform but don't block.
 */

export function validateTemplate(doc: TemplateDoc): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const caps = CATEGORY_CAPS[doc.category];

  // ---- template level ----
  if (!doc.name.trim()) {
    issues.push({ severity: 'error', slot: 'template', code: 'template/name-required', message: 'Template name is required' });
  } else if (!TEMPLATE_NAME_RE.test(doc.name)) {
    issues.push({
      severity: 'error',
      slot: 'template',
      code: 'template/name-format',
      message: 'Name must be lowercase letters, numbers and underscores only',
    });
  } else if (doc.name.length > LIMITS.NAME_MAX) {
    issues.push({
      severity: 'error',
      slot: 'template',
      code: 'template/name-too-long',
      message: `Name exceeds ${LIMITS.NAME_MAX} characters`,
    });
  }
  if (!doc.language) {
    issues.push({ severity: 'error', slot: 'template', code: 'template/language-required', message: 'Language is required' });
  }

  // ---- per-block: header / body / footer ----
  for (const slot of ['header', 'body', 'footer'] as const) {
    const instance = doc.blocks[slot];
    if (!instance) continue;
    const plugin = getBlockPlugin(instance.type);
    if (!plugin) {
      issues.push({
        severity: 'error',
        slot,
        blockId: instance.id,
        code: `${slot}/unknown-plugin`,
        message: `Unknown component type "${instance.type}"`,
      });
      continue;
    }
    const availability = plugin.availableIn(doc.category, doc);
    if (!availability.available) {
      issues.push({
        severity: 'error',
        slot,
        blockId: instance.id,
        code: `${slot}/not-allowed-in-category`,
        message: `${plugin.meta.label}: ${availability.reason}`,
      });
    }
    issues.push(...plugin.validate(instance.data, doc).map((i) => ({ ...i, blockId: instance.id })));
  }

  // ---- buttons ----
  const buttons = doc.blocks.buttons;
  if (buttons.length > LIMITS.MAX_BUTTONS) {
    issues.push({
      severity: 'error',
      slot: 'buttons',
      code: 'buttons/too-many',
      message: `Templates allow at most ${LIMITS.MAX_BUTTONS} buttons`,
    });
  }

  const countByType = new Map<string, number>();
  for (const b of buttons) countByType.set(b.type, (countByType.get(b.type) ?? 0) + 1);

  for (const [type, count] of countByType) {
    const plugin = getButtonPlugin(type);
    if (!plugin) continue;
    if (count > plugin.maxPerTemplate) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: `buttons/too-many-${type}`,
        message: `At most ${plugin.maxPerTemplate} ${plugin.meta.label} button${plugin.maxPerTemplate === 1 ? '' : 's'} allowed`,
      });
    }
  }

  for (const b of buttons) {
    const plugin = getButtonPlugin(b.type);
    if (!plugin) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        blockId: b.id,
        code: 'buttons/unknown-plugin',
        message: `Unknown button type "${b.type}"`,
      });
      continue;
    }
    if (!caps.buttonTypes.includes(b.type)) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        blockId: b.id,
        code: 'buttons/not-allowed-in-category',
        message: `${plugin.meta.label} buttons aren't available in ${doc.category} templates`,
      });
    }
    issues.push(...plugin.validate(b.data, doc).map((i) => ({ ...i, blockId: b.id })));
  }

  // Grouping: Meta requires same-kind buttons to be contiguous (quick
  // replies can't interleave with call-to-action buttons).
  const kindOf = (type: string) => (type === 'quick-reply' ? 'reply' : 'cta');
  const kinds = buttons.map((b) => kindOf(b.type));
  let switches = 0;
  for (let i = 1; i < kinds.length; i++) {
    if (kinds[i] !== kinds[i - 1]) switches += 1;
  }
  if (switches > 1) {
    issues.push({
      severity: 'error',
      slot: 'buttons',
      code: 'buttons/grouping',
      message: 'Quick replies must be grouped together, before or after all other buttons',
    });
  }

  // ---- category composition ----
  if (doc.category === 'AUTHENTICATION') {
    if (buttons.length === 0 || !countByType.has('otp')) {
      issues.push({
        severity: 'error',
        slot: 'buttons',
        code: 'auth/otp-required',
        message: 'Authentication templates need one OTP button',
      });
    }
  }

  return issues;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'error');
}

/** Issues scoped to one slot (for panel badges). */
export function issuesForSlot(issues: ValidationIssue[], slot: ValidationIssue['slot']): ValidationIssue[] {
  return issues.filter((i) => i.slot === slot);
}

/** Issues scoped to one block/button instance. */
export function issuesForBlock(issues: ValidationIssue[], blockId: string): ValidationIssue[] {
  return issues.filter((i) => i.blockId === blockId);
}
