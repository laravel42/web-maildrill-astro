/**
 * Persistencia del sitio (Fase 4, docs/06 §8, docs/27 §4.1): `getFlushedSite`
 * vuelca la copia de trabajo (`document` de la página activa) al `BuilderSite`
 * completo; `loadSite` reemplaza el sitio en el store y resetea el historial.
 *
 * `loadSite` usa `getStoreHandle().temporal.setState(...)` en vez de importar
 * el barrel (`useDocumentStore`) como valor: esta slice se compone DENTRO del
 * `create()` de `documentStore.ts`, así que un import de valor del barrel
 * cerraría un ciclo de inicialización. `getStoreHandle()` (`historyRuntime.ts`)
 * es el punto de acceso imperativo acordado para este caso (docs/27 §6.1,
 * decisión D6) — mismo patrón que `restorePageHistory` en `historyRuntime.ts`
 * y que `switchToPage` en `slices/pages.ts` (Fase 13).
 */
import { writeDocIntoSite } from "../../model/site";
import type { BuilderSite } from "../../model/types";
import { clearPageHistory, getStoreHandle, withHistoryPaused } from "../historyRuntime";
import type { SliceCreator } from "./types";

export interface PersistenceSlice {
  // Persistencia (Fase 4, docs/06 §8). `getFlushedSite` vuelca la copia de
  // trabajo al sitio; `loadSite` reemplaza el sitio y resetea el historial.
  getFlushedSite: () => BuilderSite;
  loadSite: (site: BuilderSite) => void;
  /**
   * Fija `site.meta.siteId` (docs/36 D5/F2) — se llama en la primera
   * publicación exitosa (`PublishPanel`), nunca antes: el campo debe
   * reflejar el destino REAL ya publicado, no una reserva anticipada.
   * Republicar reutiliza el valor existente sin volver a llamar esto.
   */
  setSiteId: (siteId: string) => void;
}

export const createPersistenceSlice: SliceCreator<PersistenceSlice> = (set, get) => ({
  // --- Persistencia (Fase 4, docs/06 §8) ------------------------------
  getFlushedSite: () => {
    const s = get();
    return writeDocIntoSite(s.site, s.activePageId, s.document);
  },

  loadSite: (incoming) => {
    const homeId = incoming.homePageId;
    const home = incoming.pages[homeId];
    if (!home) return; // sitio incoherente: no cargar (validado aguas arriba)
    // Resetea el historial POR PÁGINA: el sitio cargado empieza limpio.
    clearPageHistory();
    withHistoryPaused(() => {
      set({
        site: incoming,
        activePageId: homeId,
        document: home.document,
        selectedId: null,
        editingTextNodeId: null,
        activeTiptapEditor: null,
        editingModalId: null,
        pickInsert: null,
        activeSlotByComposite: {},
        previewStateBySelectedId: {},
        // El locale de edición podría no existir en el sitio entrante (otro
        // conjunto de idiomas o monolingüe): cae al default del sitio nuevo
        // (docs/12 §B.6).
        editingLocale: incoming.meta.i18n?.locales.includes(get().editingLocale)
          ? get().editingLocale
          : incoming.meta.defaultLang,
      });
    });
    getStoreHandle().temporal.setState({ pastStates: [], futureStates: [] });
  },

  setSiteId: (siteId) =>
    set((s) => {
      s.site.meta.siteId = siteId;
    }),
});
