/**
 * Shared rendering constants for the email Reader / HTML export.
 *
 * These live in `@eb/email-builder` (the reusable rendering package) so
 * the Node-safe HTML renderer can consume them without importing the
 * editor app (`email-builder-standalone`). The editor re-exports them
 * from its own `constants.ts` for back-compat.
 */
export const MAX_WIDTH_DESKTOP = 600;
export const MAX_WIDTH_MOBILE = 370;
