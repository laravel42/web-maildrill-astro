import type { FastifyInstance } from "fastify";

/**
 * Public surface of the vendored EmailBuilder backend.
 *
 * This declaration is what other workspace packages typecheck against, so the
 * vendored sources are never walked by the root `tsc`. That matters: upstream
 * compiles with `lib: [es2023, dom]` and without `noUncheckedIndexedAccess`,
 * while this repo does the opposite. Resolving through here lets the vendored
 * copy stay byte-identical to `@eb/backend` — it is typechecked on its own
 * terms via `pnpm --filter @maildrill/email-builder-api typecheck`.
 */

/** Every EmailBuilder route (AI generation, images, dev authoring helpers). */
export declare function emailBuilderRoutes(app: FastifyInstance): Promise<void>;

/** Feature flags the editor reads from the health endpoint. */
export declare function emailBuilderHealth(): Record<string, unknown>;
