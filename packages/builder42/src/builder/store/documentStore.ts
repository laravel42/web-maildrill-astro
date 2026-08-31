/**
 * Store del sitio — fuente de estado del editor (PLAN §7, docs/06 §5).
 *
 * El builder edita un **sitio de N páginas** (`BuilderSite`), no un documento
 * suelto. El modelo se normaliza un nivel arriba (P2): `pages` + `pageOrder` +
 * `homePageId`. La página en foco es `activePageId`.
 *
 * Copia de trabajo (docs/06 §6, opción A): `document` es la copia de trabajo de
 * la página activa y es lo que `zundo` rastrea (partialize `{ document }`), de
 * modo que las acciones de nodo y el undo/redo funcionan EXACTAMENTE igual que
 * antes. Al cambiar de página se **vuelca** `document` al sitio y se **conmuta**
 * la pila de historial (mapa `pageHistory`), logrando undo/redo POR PÁGINA sin
 * mezclar contextos.
 *
 * El estado de UI (selección, breakpoint, vista) NO entra al historial. Los
 * breakpoints (y tokens, docs/08) viven a nivel **sitio** (`site.meta`), no en
 * la página (docs/06 §3): `resolveStyle` toma el `cfg` de `site.meta.breakpoints`.
 */

import { create } from "zustand";
import { temporal } from "zundo";
import { immer } from "zustand/middleware/immer";

import { setStoreHandle, type DocumentStoreHandle } from "./historyRuntime";
import { createBehaviorsSlice, type BehaviorsSlice } from "./slices/behaviors";
import { createCoreSlice, type CoreSlice } from "./slices/core";
import { createI18nSiteSlice, type I18nSiteSlice } from "./slices/i18nSite";
import { createLayoutsSlice, type LayoutsSlice } from "./slices/layouts";
import { createPagesSlice, type PagesSlice } from "./slices/pages";
import { createPersistenceSlice, type PersistenceSlice } from "./slices/persistence";
import { createPickInsertSlice, type PickInsertSlice } from "./slices/pickInsert";
import { createReorderSlice, type ReorderSlice } from "./slices/reorder";
import { createPropsSlice, type PropsSlice } from "./slices/props";
import { createThemesSlice, type ThemesSlice } from "./slices/themes";
import { createTokensSlice, type TokensSlice } from "./slices/tokens";
import { createTreeSlice, type TreeSlice } from "./slices/tree";
import { createUiSlice, type UiSlice } from "./slices/ui";

// Re-exportados desde `slices/pickInsert.ts` (docs/27 §4.1): la API pública
// del barrel no cambia aunque el tipo se haya movido a la slice.
export type { PickInsertSource, PickInsertState } from "./slices/pickInsert";
export type { NodeFragment } from "../model/tree";

// Re-exportado desde `slices/pages.ts` (docs/27 §4.1, Fase 13): la API
// pública del barrel no cambia aunque el tipo se haya movido a la slice.
export type { MetaFieldPath } from "./slices/pages";

// Re-exportados desde `slices/ui.ts` (docs/27 §4.1, Fase 15): la API pública
// del barrel no cambia aunque los tipos se hayan movido a la slice.
export type { ViewMode } from "./slices/ui";
export type { SiteTab } from "./slices/ui";

// ---------------------------------------------------------------------------
// Estado + acciones
// ---------------------------------------------------------------------------

// `SiteState` compone todas las slices de dominio ya migradas (docs/27 §4.2).
// Con la Fase 15 (slice `ui`) desaparece la última interfaz inline
// (`SiteStateBase`): el store queda compuesto en su totalidad por slices.
export type SiteState = UiSlice &
  CoreSlice &
  BehaviorsSlice &
  ReorderSlice &
  I18nSiteSlice &
  TokensSlice &
  ThemesSlice &
  PropsSlice &
  PickInsertSlice &
  LayoutsSlice &
  TreeSlice &
  PagesSlice &
  PersistenceSlice;

export const useDocumentStore = create<SiteState>()(
  temporal(
    immer((set, get, api) => ({
      ...createCoreSlice(set, get, api),
      ...createReorderSlice(set, get, api),
      ...createI18nSiteSlice(set, get, api),
      ...createTokensSlice(set, get, api),
      ...createThemesSlice(set, get, api),
      ...createUiSlice(set, get, api),

      ...createPropsSlice(set, get, api),
      ...createPickInsertSlice(set, get, api),
      ...createLayoutsSlice(set, get, api),
      ...createTreeSlice(set, get, api),
      ...createPagesSlice(set, get, api),
      ...createPersistenceSlice(set, get, api),

      ...createBehaviorsSlice(set, get, api),
    })),
    {
      // Solo el documento de la página activa entra al historial (docs/03 §5,
      // docs/06 §6). El estado de UI y el sitio quedan fuera.
      partialize: (s) => ({ document: s.document }),
      equality: (a, b) => JSON.stringify(a) === JSON.stringify(b),
      limit: 100,
    },
  ),
);

// Las slices (`pages.ts`, `persistence.ts`) llegan a `setState`/`.temporal` de forma
// imperativa a través de `historyRuntime.ts`, nunca importando este barrel
// (docs/27 §6.1, D6; AGENTS.md §5.6) — evita el ciclo de inicialización.
// Cast necesario y acotado (no `as any`): el middleware `immer` amplía la
// firma de `setState` para aceptar un mutador de draft además del objeto
// plano, así que `UseBoundStore<WithImmer<...>>` no es asignable
// estructuralmente a `StoreApi<SiteState>` (la sobrecarga de `replace: true`
// choca). `historyRuntime.ts` solo llama `getState()`/`setState(objeto)` —
// el subconjunto que SÍ coincide en runtime — nunca la sobrecarga de replace.
setStoreHandle(useDocumentStore as DocumentStoreHandle);
