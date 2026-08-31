/**
 * Estado base del sitio: `site`, `activePageId`, `document` (docs/27 §4.1).
 * Sin acciones — las mutaciones sobre estos campos viven en otras slices
 * (`pages`, `persistence`, `tree`, ...) que aún no se extraen.
 */
import { createEmptyDocument, createSiteFromDocument } from "../../model/site";
import type { BuilderDocument, BuilderSite, PageId } from "../../model/types";
import type { SliceCreator } from "./types";

export interface CoreSlice {
  site: BuilderSite;
  activePageId: PageId;
  /** Copia de trabajo de la página activa (lo que rastrea zundo). */
  document: BuilderDocument;
}

// Estado inicial mínimo (docs/27 §5 Fase 2): este módulo NO importa nada de
// `../exampleSite` — es el módulo raíz que ~50 archivos importan (vía
// `documentStore.ts`), y el sitio de ejemplo (con su cadena de dependencias
// hacia el `componentRegistry`) no debe formar parte de esa carga. El sitio
// de ejemplo real se carga aparte, antes de montar React, vía
// `bootstrapDemoSite()` (`src/bootstrap.ts`).
export const initialSite = createSiteFromDocument(createEmptyDocument());
export const initialActivePageId = initialSite.homePageId;

export const createCoreSlice: SliceCreator<CoreSlice> = () => ({
  site: initialSite,
  activePageId: initialActivePageId,
  document: initialSite.pages[initialActivePageId]!.document,
});
