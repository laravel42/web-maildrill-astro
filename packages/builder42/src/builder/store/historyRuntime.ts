/**
 * Runtime imperativo del historial de zundo (docs/27 §5 Fase 3, §6.1/§6.4).
 *
 * Vive FUERA de `documentStore.ts` porque el historial es una dependencia
 * COMPARTIDA entre `switchToPage`, `loadSite` y `removePage`: ocultarlo dentro
 * de la extracción de una sola slice (Fases 5-15) haría que el otro dominio
 * dependiera de sus internals, o que un commit intermedio reintrodujera el
 * ciclo de inicialización que este módulo existe para evitar (D6).
 *
 * `getStoreHandle()`/`setStoreHandle()` son el único punto de acceso
 * imperativo a `setState`/`.temporal` que las futuras slices (`pages.ts`,
 * `persistence.ts`) usarán SIN importar el barrel — evita el ciclo de
 * inicialización que se produciría si una slice importara `useDocumentStore`
 * desde `documentStore.ts` mientras ese mismo archivo compone la slice.
 */
import type { StoreApi } from "zustand";
import type { TemporalState } from "zundo";
import type { BuilderDocument, PageId } from "../model/types";
// Import de SOLO TIPO: `documentStore.ts` importa (valor) desde este módulo,
// así que este `import type` cierra un ciclo — pero es un ciclo de TIPOS que
// se borra por completo al compilar (docs/27 §4.2) y no existe en el grafo de
// módulos en runtime.
import type { SiteState } from "./documentStore";

export type HistoryState = Pick<SiteState, "document">;
export type DocumentStoreHandle = StoreApi<SiteState> & {
  temporal: StoreApi<TemporalState<HistoryState>>;
};

let handle: DocumentStoreHandle | null = null;

/** Registra el store real. Lo llama `documentStore.ts` justo tras `create()`. */
export function setStoreHandle(next: DocumentStoreHandle): void {
  handle = next;
}

/** Devuelve el handle registrado. Lanza si se usa antes del registro. */
export function getStoreHandle(): DocumentStoreHandle {
  if (!handle) throw new Error("document store handle no registrado");
  return handle;
}

interface TemporalStacks {
  pastStates: { document: BuilderDocument }[];
  futureStates: { document: BuilderDocument }[];
}

// Pilas de undo/redo por página NO-activa (docs/06 §6 opción A). La página en
// foco vive en `useDocumentStore.temporal`; el resto se guarda acá mientras
// no está en pantalla.
const pageHistory = new Map<PageId, TemporalStacks>();

/** Guarda la pila de historial de `pageId` (copiada, sin alias con la pila activa). */
export function savePageHistory(pageId: PageId): void {
  const temporal = getStoreHandle().temporal.getState();
  pageHistory.set(pageId, {
    pastStates: structuredClone(temporal.pastStates as { document: BuilderDocument }[]),
    futureStates: structuredClone(temporal.futureStates as { document: BuilderDocument }[]),
  });
}

/** Restaura (o inicia vacía) la pila de historial de `pageId`. */
export function restorePageHistory(pageId: PageId): void {
  const saved = pageHistory.get(pageId);
  getStoreHandle().temporal.setState({
    pastStates: saved?.pastStates ?? [],
    futureStates: saved?.futureStates ?? [],
  });
}

/** Descarta la pila guardada de `pageId` (p. ej. al borrar la página). */
export function deletePageHistory(pageId: PageId): void {
  pageHistory.delete(pageId);
}

/** Vacía TODAS las pilas guardadas (p. ej. al cargar un sitio nuevo). */
export function clearPageHistory(): void {
  pageHistory.clear();
}

/**
 * Ejecuta `fn` con el historial de zundo en pausa, garantizando `resume()`
 * incluso si `fn` lanza (try/finally) — antes de esta fase, un error dentro
 * del `set(...)` entre `pause()`/`resume()` dejaba el historial pausado para
 * siempre.
 */
export function withHistoryPaused(fn: () => void): void {
  const temporal = getStoreHandle().temporal.getState();
  temporal.pause();
  try {
    fn();
  } finally {
    temporal.resume();
  }
}
