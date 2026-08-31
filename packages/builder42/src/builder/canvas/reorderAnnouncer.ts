/**
 * reorderAnnouncer — canal compartido de anuncios `aria-live` para las
 * acciones de reordenamiento del árbol (docs/24 §2.1). Tanto `Alt+flechas`
 * (`KeyboardReorder.tsx`) como los botones ▲▼◀▶ de click
 * (`dnd/SelectionHandle.tsx`) mueven el MISMO tipo de resultado (movido /
 * no se puede mover); comparten un único mensaje y una única región
 * `role="status"` en el DOM — evita dos regiones `aria-live` compitiendo o
 * anunciando dos veces el mismo movimiento, y mantiene un solo nodo
 * `getByRole("status")` para los tests existentes (guardia de regresión,
 * docs/24 §4).
 *
 * Implementación: store externo minúsculo (`useSyncExternalStore`), igual
 * patrón que `useThemeMode.ts`. Solo `KeyboardReorder` MONTA la región
 * `aria-live`; `SelectionHandle` solo PUBLICA mensajes vía `announce()`.
 */

import { useSyncExternalStore } from "react";

let message = "";
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

/** Publica un nuevo mensaje en el canal compartido de anuncios de reorder. */
export function announceReorder(text: string): void {
  message = text;
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string {
  return message;
}

/** Hook: lee el último mensaje publicado (solo lo consume `KeyboardReorder`, que renderiza la región). */
export function useReorderAnnouncement(): string {
  return useSyncExternalStore(subscribe, getSnapshot, () => "");
}
