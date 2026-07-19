import {
  isValidationFailure,
  validateDocument,
  type ValidationFailure,
  type ValidationResult,
  type ValidationSuccess,
} from '@eb/document-core';

export type { ValidationSuccess, ValidationFailure, ValidationResult };
export { isValidationFailure };

/**
 * Validate a template produced by the AI backend before it reaches the editor.
 * Delegates to the shared `validateDocument()` from `@eb/document-core`.
 */
export function validateGeneratedTemplate(raw: unknown): ValidationResult {
  return validateDocument(raw);
}
