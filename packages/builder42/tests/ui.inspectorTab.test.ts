/**
 * ui.inspectorTab.test.ts — verifica la seam de D48 (mismo espíritu que D38,
 * ver `ui.sidebarTab.test.ts`): la tab activa del Inspector para el nodo
 * seleccionado ("props" | "style" | "behaviors") vive en el store
 * (`inspectorTab` / `setInspectorTab`, `slices/ui.ts`) y no en un `useState`
 * local de `InspectorForm.tsx`, así que código que corre FUERA de React (el
 * `before()`/`after()` del paso `pbx.inspector.breakpoints` del tour guiado)
 * puede leerla y cambiarla llamando directamente a
 * `useDocumentStore.getState()`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "@/builder/store/documentStore";

function resetInspectorTab() {
  useDocumentStore.setState({ inspectorTab: "props" });
}

beforeEach(() => {
  resetInspectorTab();
});

afterEach(() => {
  resetInspectorTab();
});

describe("inspectorTab — estado inicial", () => {
  it("es 'props' (mismo default que el useState local que reemplaza)", () => {
    expect(useDocumentStore.getState().inspectorTab).toBe("props");
  });
});

describe("inspectorTab — setInspectorTab", () => {
  it("cambia el valor observable a 'style' y luego a 'behaviors'", () => {
    useDocumentStore.getState().setInspectorTab("style");
    expect(useDocumentStore.getState().inspectorTab).toBe("style");

    useDocumentStore.getState().setInspectorTab("behaviors");
    expect(useDocumentStore.getState().inspectorTab).toBe("behaviors");
  });

  it("funciona llamado desde fuera de React (sin hook, sin componente)", () => {
    // Ningún hook de React involucrado: acceso directo a getState(), el mismo
    // patrón que usaría el before()/after() del paso `pbx.inspector.breakpoints`
    // del tour (fuera del árbol de React) para forzar y luego restaurar la tab
    // activa del Inspector.
    useDocumentStore.getState().setInspectorTab("style");
    expect(useDocumentStore.getState().inspectorTab).toBe("style");
  });
});
