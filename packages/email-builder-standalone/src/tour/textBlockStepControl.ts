/**
 * textBlockStepControl.ts — guardia compartida de los pasos `eb.canvas.textBlock` y
 * `eb.inspector.tabs` del tour (T6).
 *
 * Ambos pasos requieren un bloque `NotionText` en el documento (D25 — el tour nunca escribe
 * en el documento del usuario, así que si no hay uno, ambos pasos se omiten vía `when()` en
 * `tourSteps.ts` en vez de crear un bloque de demostración). `findFirstNotionTextBlockId` es
 * la única fuente de verdad para "cuál bloque de texto": primero mira los hijos directos del
 * root en su orden real, y si ninguno es `NotionText` (p. ej. está anidado en Columns o
 * Container) recorre el resto del mapa en orden de claves — así un texto anidado también se
 * encuentra, sin tener que bajar recursivamente el árbol de children.
 *
 * `eb.inspector.tabs` además necesita el inspector abierto en modo `full` y en la pestaña
 * Content — un estado transitorio del tour, no una preferencia del usuario. Por eso escribe
 * el store directamente con `editorStateStore.setState(...)` en vez de
 * `setInspectorDrawerMode`, que marca `inspectorModeUserOverride: true` y persiste el modo en
 * localStorage (ver cabecera de `EditorContext.tsx`) — un paso de tour no debe fijar una
 * preferencia que el usuario no pidió cambiar. El snapshot se toma una sola vez (una segunda
 * llamada a `enterInspectorTabsStep` sin un `leave` intermedio no lo debe sobrescribir) y
 * `leaveInspectorTabsStep` lo restaura de forma síncrona e idempotente.
 */

import {
  editorStateStore,
  setSelectedBlockId,
  setSidebarTab,
} from '../documents/editor/EditorContext';

/** Entrada mínima de un bloque del documento que este módulo necesita inspeccionar. */
interface MinimalBlockEntry {
  type?: string;
  data?: { childrenIds?: unknown };
}

/** Forma mínima del documento que este módulo necesita: un mapa id -> bloque. */
type MinimalDocument = Record<string, MinimalBlockEntry | undefined>;

/**
 * Primer bloque cuyo `type === 'NotionText'`, priorizando el orden de los hijos del root.
 * Pura y total: nunca lanza, incluso con un documento malformado (root ausente,
 * `childrenIds` que no es array, ids que no apuntan a nada).
 */
export function findFirstNotionTextBlockId(document: MinimalDocument): string | null {
  if (!document || typeof document !== 'object') return null;

  const root = document.root;
  const rootChildrenIds = root?.data?.childrenIds;

  if (Array.isArray(rootChildrenIds)) {
    for (const id of rootChildrenIds) {
      if (typeof id !== 'string') continue;
      const entry = document[id];
      if (entry?.type === 'NotionText') return id;
    }
  }

  // Fallback: un texto anidado en Columns/Container no es hijo directo del root — se
  // recorre el resto del mapa en orden de claves para encontrarlo igualmente.
  for (const [id, entry] of Object.entries(document)) {
    if (id === 'root') continue;
    if (entry?.type === 'NotionText') return id;
  }

  return null;
}

/** `true` cuando el documento actual tiene al menos un bloque `NotionText`. */
export function hasNotionTextBlock(): boolean {
  const document = editorStateStore.getState().document as unknown as MinimalDocument;
  return findFirstNotionTextBlockId(document) !== null;
}

/** `before()` de `eb.canvas.textBlock`: selecciona el bloque de texto. Nada más (D25/Q4). */
export function enterCanvasTextBlockStep(): void {
  const document = editorStateStore.getState().document as unknown as MinimalDocument;
  const blockId = findFirstNotionTextBlockId(document);
  if (blockId) setSelectedBlockId(blockId);
}

/** Snapshot del inspector tomado al entrar en `eb.inspector.tabs`, para restaurar al salir. */
interface InspectorStepSnapshot {
  inspectorDrawerOpen: boolean;
  inspectorDrawerMode: 'full' | 'compact';
  selectedSidebarTab: 'block-configuration' | 'styles' | 'css';
}

let inspectorTabsStepSnapshot: InspectorStepSnapshot | null = null;

/**
 * `before()` de `eb.inspector.tabs`: selecciona el bloque de texto, abre el inspector en
 * `full` y muestra la pestaña Content. Escribe el estado transitorio directamente con
 * `editorStateStore.setState(...)` (nunca `setInspectorDrawerMode`) para no tocar
 * `inspectorModeUserOverride` ni persistir nada. El snapshot previo solo se toma la primera
 * vez — una segunda llamada sin `leaveInspectorTabsStep()` de por medio no lo sobrescribe.
 */
export function enterInspectorTabsStep(): void {
  if (inspectorTabsStepSnapshot === null) {
    const state = editorStateStore.getState();
    inspectorTabsStepSnapshot = {
      inspectorDrawerOpen: state.inspectorDrawerOpen,
      inspectorDrawerMode: state.inspectorDrawerMode,
      selectedSidebarTab: state.selectedSidebarTab,
    };
  }

  const document = editorStateStore.getState().document as unknown as MinimalDocument;
  const blockId = findFirstNotionTextBlockId(document);
  if (blockId) setSelectedBlockId(blockId);

  editorStateStore.setState({ inspectorDrawerOpen: true, inspectorDrawerMode: 'full' });
  setSidebarTab('block-configuration');
}

/**
 * `after()` de `eb.inspector.tabs`: restaura el snapshot tomado por `enterInspectorTabsStep`
 * (cada campo solo si difiere) y lo descarta. Síncrono — ningún paso posterior depende de que
 * el inspector siga abierto. Seguro de llamar sin un `enter` previo (no-op).
 */
export function leaveInspectorTabsStep(): void {
  if (inspectorTabsStepSnapshot === null) return;
  const snapshot = inspectorTabsStepSnapshot;
  inspectorTabsStepSnapshot = null;

  const state = editorStateStore.getState();
  const patch: Partial<InspectorStepSnapshot> = {};
  if (state.inspectorDrawerOpen !== snapshot.inspectorDrawerOpen) {
    patch.inspectorDrawerOpen = snapshot.inspectorDrawerOpen;
  }
  if (state.inspectorDrawerMode !== snapshot.inspectorDrawerMode) {
    patch.inspectorDrawerMode = snapshot.inspectorDrawerMode;
  }
  if (state.selectedSidebarTab !== snapshot.selectedSidebarTab) {
    patch.selectedSidebarTab = snapshot.selectedSidebarTab;
  }
  if (Object.keys(patch).length > 0) {
    editorStateStore.setState(patch);
  }
}

/** Descarta el snapshot sin tocar el store (solo para tests). */
export function resetTextBlockStepGuard(): void {
  inspectorTabsStepSnapshot = null;
}
