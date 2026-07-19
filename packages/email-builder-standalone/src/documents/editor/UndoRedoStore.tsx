import { create } from 'zustand';

// ============================================================================
// TYPES
// ============================================================================

type UndoRedoState = {
  past: string[]; // Snapshots JSON del documento (más reciente al final)
  future: string[]; // Snapshots JSON para redo (más reciente al final)
};

// ============================================================================
// STORE
// ============================================================================

export const undoRedoStore = create<UndoRedoState>(() => ({
  past: [],
  future: [],
}));

// ============================================================================
// HOOKS (Selectores Optimizados)
// ============================================================================

/**
 * Hook para saber si se puede hacer undo
 * Solo causa re-render cuando el valor booleano cambia
 */
export function useCanUndo(): boolean {
  return undoRedoStore((state) => state.past.length > 0);
}

/**
 * Hook para saber si se puede hacer redo
 * Solo causa re-render cuando el valor booleano cambia
 */
export function useCanRedo(): boolean {
  return undoRedoStore((state) => state.future.length > 0);
}

/**
 * Hook para obtener el stack de undo (usar con precaución)
 * Este hook causa re-render cada vez que cambia el array
 * Solo usar en componentes que realmente necesitan el array completo
 */
export function useStackUndo(): string[] {
  return undoRedoStore((state) => state.past);
}

/**
 * Hook para obtener el stack de redo (usar con precaución)
 */
export function useStackRedo(): string[] {
  return undoRedoStore((state) => state.future);
}

// ============================================================================
// GETTERS (Acceso Directo sin Suscripción)
// ============================================================================

export function getUndoRedoState(): UndoRedoState {
  return undoRedoStore.getState();
}

// ============================================================================
// SETTERS (Actualizaciones de Estado)
// ============================================================================

/**
 * Actualización atómica de múltiples propiedades
 * Minimiza el número de notificaciones a los suscriptores
 */
export function updateUndoRedoState(updates: Partial<UndoRedoState>): void {
  undoRedoStore.setState(updates);
}

// ============================================================================
// RESET
// ============================================================================

/**
 * Resetea el store de undo/redo al estado inicial
 */
export function resetUndoRedoStore(): void {
  undoRedoStore.setState({
    past: [],
    future: [],
  });
}
