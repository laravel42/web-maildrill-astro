/**
 * Acceso reactivo al historial de `zundo` (docs/03 §5).
 *
 * `useDocumentStore.temporal` es un store vanilla de Zustand con
 * `pastStates` / `futureStates` / `undo` / `redo` / `clear`. Lo consumimos con
 * `useStore` para habilitar/deshabilitar botones (`canUndo`/`canRedo`) de forma
 * reactiva, y exponemos un hook de atajos de teclado (⌘Z / ⌘⇧Z).
 */

import { useEffect } from "react";
import { useStore } from "zustand";
import type { TemporalState } from "zundo";
import { useDocumentStore } from "./documentStore";
import type { BuilderDocument } from "../model/types";

// El historial se parcializa a `{ document }` (docs/03 §5), así que el estado
// temporal está tipado sobre esa forma, no sobre el DocumentState completo.
type Temporal = TemporalState<{ document: BuilderDocument }>;

export function useTemporalStore<T>(selector: (state: Temporal) => T): T {
  return useStore(useDocumentStore.temporal, selector);
}

export function useCanUndo(): boolean {
  return useTemporalStore((s) => s.pastStates.length > 0);
}

export function useCanRedo(): boolean {
  return useTemporalStore((s) => s.futureStates.length > 0);
}

export function undo(): void {
  useDocumentStore.temporal.getState().undo();
}

export function redo(): void {
  useDocumentStore.temporal.getState().redo();
}

/** Cablea ⌘Z / Ctrl+Z (undo) y ⌘⇧Z / Ctrl+Shift+Z (redo). */
export function useUndoRedoShortcuts(): void {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;
      // No interferir mientras se escribe en un input/textarea/contentEditable.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
