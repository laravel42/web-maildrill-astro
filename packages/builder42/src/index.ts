/**
 * Entrada de librería de Builder42 (docs/52 F7, D1/D4).
 *
 * Este módulo es lo que un host externo (`web-maildrill-astro`, vía copia
 * vendorizada en `packages/builder42/` — D9, F8) importa para montar el
 * editor dentro de su propia app. `main.tsx` (modo standalone, `pnpm dev`)
 * NO importa este archivo — sigue montando `<App />` directamente con
 * `bootstrapDemoSite()`, el singleton global de i18n y `chrome.css`
 * (barrel completo, incluye `standalone.css`).
 *
 * El host importa el CSS del chrome por separado (`./style.css`, mapeado en
 * `package.json` — F8 — al barrel `chrome-embedded.css`, F6), igual que
 * `email-builder-standalone` mapea `./style.css` a `src/global.css`.
 */

export { Builder42Editor } from "./Builder42Editor";
export type { Builder42EditorProps, Builder42EditorHandle } from "./Builder42Editor";
export type {
  ApiAdapters,
  GenerateFragmentFn,
  SearchImagesFn,
  DownloadImageFn,
  ListMediaFn,
  PublishFn,
  FetchHealthFn,
} from "./services/apiAdapters";
export type { BuilderSite } from "./builder/model/types";
/**
 * First-run seed for a host with nothing saved and no requested template
 * (chain F29, W2, D-F29.10): a real runtime export, not a type, so a host
 * can construct a starter `BuilderSite` — root → one deletable container →
 * [text, image] — without inventing its own node shapes. Ships INERT: no
 * surface in this package calls it, and this host does not seed with it
 * today (its landings come from the backend). See VENDOR #29's invariant —
 * the first-run CONDITION is always the host's to evaluate.
 */
export { createBaseSite } from "./builder/baseSite";
/**
 * Re-exported so a host can validate whatever it reads back out of its own
 * persistence before handing it to `Builder42Editor`'s `site` prop
 * (builder42-landing divergence #47, replayed here 2026-10-02 alongside chain
 * F31's port). `parseSiteJson` never throws — malformed JSON and a
 * structurally invalid document both come back as `{ ok: false, errors }` —
 * which is exactly what a host needs in order to fall back to a fresh
 * document instead of handing the editor something it cannot render.
 *
 * Only the PACKAGE half is ported. That host's own recovery path (clearing a
 * corrupt `localStorage` key and reseeding) is specific to a static host with
 * no backend; this host persists through its own server. The rule generalises
 * even so: never pass an unvalidated stored document into the `site` prop.
 */
export { parseSiteJson } from "./builder/model/persist";
export type { ValidationResult } from "./builder/model/validate";

// ---------------------------------------------------------------------------
// Product tour (F4, docs/product-tour-driverjs-plan.md §4) — re-exported so
// the host (`src/components/react/LandingPageBuilder.tsx`) can type its
// `onTourEvent` callback without taking a direct dependency on
// `@md/product-tour` (which isn't declared at the repo root — only the
// editor packages depend on it).
// ---------------------------------------------------------------------------
export type { TourAnalyticsEvent, TourAnalyticsEventName } from "@md/product-tour";
