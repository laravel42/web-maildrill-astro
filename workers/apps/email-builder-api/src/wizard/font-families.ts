/**
 * Font-family keys for wizard/theme validation.
 *
 * Derived from the audit engine's font table, which is the single inlined
 * copy of the editor's `@eb/document-core` FONT_CATALOG in this backend —
 * keeping two hand-maintained lists in sync was one list too many. Keep
 * `FONT_FACTS` in sync with the editor catalog when it changes.
 */
import { FONT_FAMILY_KEYS } from '../audit/client-matrix.js';

export const FONT_FAMILY_NAMES = FONT_FAMILY_KEYS as unknown as [string, ...string[]];
