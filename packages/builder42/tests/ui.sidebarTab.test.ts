/**
 * ui.sidebarTab.test.ts — verifica la seam de D38 (docs/AGENTS.md, bitácora):
 * la tab activa del sidebar izquierdo (`components` | `tokens` | `templates`)
 * vive en el store (`sidebarTab` / `setSidebarTab`, `slices/ui.ts`) y no en un
 * `useState` local de `Sidebar.tsx`, así que código que corre FUERA de React
 * (p. ej. el `before()` de un paso de tour, en una tarea futura) puede leerla
 * y cambiarla llamando directamente a `useDocumentStore.getState()`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "@/builder/store/documentStore";

function resetSidebarTab() {
  useDocumentStore.setState({ sidebarTab: "components" });
}

beforeEach(() => {
  resetSidebarTab();
});

afterEach(() => {
  resetSidebarTab();
});

describe("sidebarTab — estado inicial", () => {
  it("es 'components'", () => {
    expect(useDocumentStore.getState().sidebarTab).toBe("components");
  });
});

describe("sidebarTab — setSidebarTab", () => {
  it("cambia el valor observable a 'templates' y luego a 'tokens'", () => {
    useDocumentStore.getState().setSidebarTab("templates");
    expect(useDocumentStore.getState().sidebarTab).toBe("templates");

    useDocumentStore.getState().setSidebarTab("tokens");
    expect(useDocumentStore.getState().sidebarTab).toBe("tokens");
  });

  it("funciona llamado desde fuera de React (sin hook, sin componente)", () => {
    // Ningún hook de React involucrado: acceso directo a getState(), el mismo
    // patrón que usaría el before() de un paso de tour (fuera del árbol de
    // React) para forzar la tab visible del sidebar.
    useDocumentStore.getState().setSidebarTab("templates");
    expect(useDocumentStore.getState().sidebarTab).toBe("templates");
  });
});
