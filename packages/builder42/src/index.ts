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

// ---------------------------------------------------------------------------
// Product tour (F4, docs/product-tour-driverjs-plan.md §4) — re-exported so
// the host (`src/components/react/LandingPageBuilder.tsx`) can type its
// `onTourEvent` callback without taking a direct dependency on
// `@md/product-tour` (which isn't declared at the repo root — only the
// editor packages depend on it).
// ---------------------------------------------------------------------------
export type { TourAnalyticsEvent, TourAnalyticsEventName } from "@md/product-tour";
