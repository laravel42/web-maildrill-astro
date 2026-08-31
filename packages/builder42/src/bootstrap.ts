/**
 * Bootstrap del sitio de ejemplo (docs/27 §5 Fase 2).
 *
 * `documentStore.ts` ya no crea el sitio de ejemplo en tiempo de módulo (su
 * estado inicial es un sitio mínimo, `createSiteFromDocument(createEmptyDocument())`)
 * porque ese módulo lo importan ~50 archivos y no debe arrastrar la cadena de
 * dependencias del sitio de ejemplo hacia el `componentRegistry`.
 *
 * `bootstrapDemoSite()` carga el sitio de ejemplo real en el store. Debe
 * llamarse UNA vez, en `main.tsx`, ANTES de `ReactDOM.createRoot(...).render(...)`
 * — así corre después de que todos los imports del módulo (registro de
 * componentes incluido) ya resolvieron, y antes de que `React.StrictMode`
 * pueda re-ejecutar nada. `loadSite` ya resetea `activePageId`, selección y el
 * historial de undo/redo; esta función no reimplementa nada de eso.
 */
import { useDocumentStore } from "./builder/store/documentStore";
import { createExampleSite } from "./builder/store/exampleSite";

export function bootstrapDemoSite(): void {
  useDocumentStore.getState().loadSite(createExampleSite());
}
