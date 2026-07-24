/**
 * L42-306 / L42-307 — shared library helpers.
 *
 * Cross-route utilities for the dev-only "library" endpoints
 * (components + themes). Centralises:
 *
 *   - The endpoint gate (env var or non-production NODE_ENV).
 *   - The UUID v4 validator used for path-param sanitisation and as
 *     the identity primitive for both libraries.
 *   - Short helpers to mint ids, ISO timestamps, and consistent error
 *     bodies so both routes return the exact same shapes for the same
 *     classes of failure.
 *
 * Avoid putting filesystem paths or runtime state in this module —
 * `dev-library-paths.ts` is the dedicated place for that (it has to
 * stay tiny because of ts-jest / CommonJS interop with
 * `import.meta.url`).
 */

import { randomUUID } from 'node:crypto';

/**
 * UUID v4 regex (lowercase, hyphenated). Generated values come from
 * `crypto.randomUUID()` which always emits this casing on Node 14.17+.
 *
 * Validates URL path-params before any filesystem access — the regex
 * confines us to the alphabet `[0-9a-f-]` so traversal sequences,
 * URL-encoded variants and Unicode lookalikes are all rejected.
 */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * Mirrored client-side in `@eb/document-core`. Keep the two regexes in
 * sync if you ever change one — or extract to a shared package later.
 */
export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_V4_REGEX.test(value);
}

/**
 * Always-uppercase helper around `crypto.randomUUID()`. Wrapping it
 * keeps test mocks centralised (jest can `jest.spyOn(shared, 'newId')`
 * to control the generated identity in spec deterministic assertions).
 */
export function newId(): string {
  return randomUUID();
}

/**
 * Current ISO 8601 UTC timestamp. Wrapped so tests can mock the clock
 * for deterministic `createdAt` / `updatedAt` assertions.
 */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Endpoint gate.
 *
 * Decision history mirrors `dev-save-section`'s original comment: we
 * dropped the original `NODE_ENV === 'production'` blanket-deny in
 * favour of an explicit env var so self-hosted production deployments
 * can opt into letting end-users grow the library. Default is closed —
 * a deployment that doesn't set the variable behaves exactly like the
 * legacy production guard.
 *
 * Both `EB_ENABLE_SAVE_COMPONENTS` and any non-production NODE_ENV open
 * the endpoint. The env var name is intentionally unchanged from the
 * components-only era so existing deployments keep working without
 * config edits when themes ship.
 */
export function isLibraryEndpointEnabled(): boolean {
  if (process.env.EB_ENABLE_SAVE_COMPONENTS === 'true') return true;
  if (process.env.NODE_ENV !== 'production') return true;
  return false;
}

/**
 * Standard 403 body for disabled endpoints. Both routes share the same
 * shape so clients can branch on `error: 'endpoint_disabled'` without
 * caring which library they hit.
 */
export const DISABLED_RESPONSE_BODY = {
  error: 'endpoint_disabled',
  hint: 'Set EB_ENABLE_SAVE_COMPONENTS=true to enable in production.',
} as const;

/**
 * Trim + length-cap for `name` metadata. <=100 chars after trim,
 * non-empty after trim.
 */
export const NAME_MAX_LENGTH = 100;

/**
 * Length cap for `description` metadata. Mirrors the value used in
 * `themeBundleSchema` on the client side.
 */
export const DESCRIPTION_MAX_LENGTH = 280;
