import type { ZodIssue } from 'zod';

import { EditorConfigurationSchema, type TEditorConfiguration } from '../schemas';

import { extractAllChildIds } from './extractChildIds';

export type ValidationSuccess = { ok: true; data: TEditorConfiguration };
export type ValidationFailure = { ok: false; issues: string[] };
export type ValidationResult = ValidationSuccess | ValidationFailure;

export function isValidationFailure(result: ValidationResult): result is ValidationFailure {
  return result.ok === false;
}

function formatZodIssue(issue: ZodIssue): string {
  const path = issue.path.length > 0 ? issue.path.join('.') : '<root>';
  return `${path}: ${issue.message}`;
}

/**
 * Validate a document against the full editor contract (3 layers):
 *
 *   1. Zod schema parse — every block conforms to its type-specific schema.
 *   2. Root invariant — `root` key exists and is type `EmailLayout`.
 *   3. Structural integrity — every `childrenIds` ref points to an existing block.
 *
 * Pure function, never mutates input. Safe to call from Node (no browser deps).
 */
export function validateDocument(raw: unknown): ValidationResult {
  // Layer 1
  const parsed = EditorConfigurationSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(formatZodIssue) };
  }

  const data = parsed.data;

  // Layer 2
  const root = data.root;
  if (!root) {
    return { ok: false, issues: ['Missing "root" block'] };
  }
  if (root.type !== 'EmailLayout') {
    return { ok: false, issues: [`Root block must be of type "EmailLayout", got "${root.type}"`] };
  }

  // Layer 3
  const structuralIssues: string[] = [];
  for (const [id, block] of Object.entries(data)) {
    for (const childId of extractAllChildIds(block)) {
      if (!(childId in data)) {
        structuralIssues.push(`Block "${id}" references a missing child "${childId}"`);
      }
    }
  }

  if (structuralIssues.length > 0) {
    return { ok: false, issues: structuralIssues };
  }

  return { ok: true, data };
}
