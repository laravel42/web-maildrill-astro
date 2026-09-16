import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUILDER42_TOUR_ANCHORS } from "@/app/tour/tourAnchors";

/**
 * tour-anchors-coverage.test.ts — verifica que cada clave del registro único
 * (`BUILDER42_TOUR_ANCHORS`, §3.2 de docs/product-tour-driverjs-plan.md) aparece
 * exactamente una vez como literal `data-tour="<key>"` en el árbol fuente de
 * `packages/builder42` (o, para `pbx.header.identity`, en el HOST —
 * `src/components/react/shared/EditorHeader.tsx`).
 *
 * Por qué un grep estático de fuente y no un render de React (como el precedente
 * `i18n-chrome-coverage.test.ts`, que también es puramente estático — no monta
 * componentes): el `vitest.config.ts` de este paquete corre en `environment: "node"`
 * y el paquete no tiene `@testing-library/react` ni `jsdom`/`happy-dom` instalados
 * (a diferencia de `packages/email-builder-standalone`, que sí los añadió en F2a).
 * Añadir esas dependencias solo para este test violaría la restricción dura de F2b
 * ("no añadas dependencias"). El grep estático da la misma garantía que pide el
 * criterio de aceptación — "cada clave aparece exactamente una vez en el árbol
 * renderizado" — porque cada ancla de este registro se escribe con
 * `{...dataTourAttr(BUILDER42_TOUR_ANCHORS.xxx)}` en un único call-site fijo (no
 * hay bucles que dupliquen el atributo en runtime): contar apariciones del literal
 * en el código fuente es equivalente a contarlas en el DOM montado.
 *
 * Anclas que este test NO puede cubrir por completo (documentado, ver §4 F2b del
 * plan): `pbx.sidebar.tabs`/`pbx.sidebar.palette` solo existen en el DOM cuando
 * `sidebarMode !== "compact"`; `pbx.canvas.nodeActions` solo cuando hay un nodo
 * seleccionado distinto del root; `pbx.inspector.tabs`/`pbx.inspector.breakpoints`
 * solo cuando el Inspector está montado con un nodo seleccionado (y, para
 * `breakpoints`, con la tab "style" activa); `pbx.publish` solo dentro del
 * `PublishModal`/tab "publish" del `SiteSettingsPanel`. La condicionalidad real en
 * tiempo de ejecución (abrir paneles, seleccionar nodos, montar modales) es
 * exactamente lo que el e2e de F6 (Playwright) verifica recorriendo el editor en
 * vivo — este test solo garantiza que el call-site existe una vez y usa la clave
 * correcta del registro, no que el elemento esté siempre visible.
 */

const here = fileURLToPath(new URL(".", import.meta.url));
const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
const hostRoot = fileURLToPath(new URL("../../..", import.meta.url));

function read(relPath: string): string {
  return readFileSync(`${pkgRoot}/${relPath}`, "utf8");
}

function readHost(relPath: string): string {
  return readFileSync(`${hostRoot}/${relPath}`, "utf8");
}

/** Cuenta apariciones del literal `data-tour="<key>"` producidas por `dataTourAttr(...)`. */
function countAnchorCallSites(source: string, key: string): number {
  // `dataTourAttr(BUILDER42_TOUR_ANCHORS.xxx)` es la única forma permitida de emitir
  // el atributo (nadie debe escribir el string a mano) — buscamos el nombre de la
  // constante exportada cuyo valor es `key`, no el string literal, porque el código
  // fuente nunca contiene el string `"pbx.toolbar.views"` tal cual.
  const entry = Object.entries(BUILDER42_TOUR_ANCHORS).find(([, v]) => v === key);
  if (!entry) return 0;
  const [propName] = entry;
  // El call-site puede usar un alias del import (p. ej. `dataTourAttrPbx` en
  // `EditorHeader.tsx`, que también importa la homónima de EmailBuilder bajo
  // su nombre original y necesita distinguirlas) — se acepta cualquier
  // identificador que termine en `dataTourAttr` seguido del acceso a la
  // constante correcta, no un nombre de función fijo.
  const pattern = new RegExp(
    `\\bdataTourAttr\\w*\\(\\s*BUILDER42_TOUR_ANCHORS\\.${propName}\\s*\\)`,
    "g",
  );
  return (source.match(pattern) ?? []).length;
}

describe("Builder42 tour anchors — coverage (F2b, static source scan)", () => {
  void here; // reservado si algún caso futuro necesita resolver rutas relativas al test

  const filesByAnchor: Record<string, { path: string; read: () => string }[]> = {
    [BUILDER42_TOUR_ANCHORS.headerIdentity]: [
      { path: "src/components/react/shared/EditorHeader.tsx", read: () => readHost("src/components/react/shared/EditorHeader.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.toolbarViews]: [
      { path: "src/app/layout/HostToolbar.tsx", read: () => read("src/app/layout/HostToolbar.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.toolbarViewport]: [
      { path: "src/app/layout/ViewportDropdown.tsx", read: () => read("src/app/layout/ViewportDropdown.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.toolbarHistory]: [
      { path: "src/app/layout/HostToolbar.tsx", read: () => read("src/app/layout/HostToolbar.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.sidebarTabs]: [
      { path: "src/app/layout/Sidebar.tsx", read: () => read("src/app/layout/Sidebar.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.sidebarPalette]: [
      { path: "src/app/layout/Sidebar.tsx", read: () => read("src/app/layout/Sidebar.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.canvasFrame]: [
      { path: "src/app/layout/Canvas.tsx", read: () => read("src/app/layout/Canvas.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.canvasNodeActions]: [
      { path: "src/builder/dnd/NodeActionsRail.tsx", read: () => read("src/builder/dnd/NodeActionsRail.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.inspectorTabs]: [
      { path: "src/builder/inspector/InspectorForm.tsx", read: () => read("src/builder/inspector/InspectorForm.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.inspectorBreakpoints]: [
      { path: "src/builder/inspector/panel/VisibilityStrip.tsx", read: () => read("src/builder/inspector/panel/VisibilityStrip.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.pagesBreadcrumb]: [
      { path: "src/app/layout/PageBreadcrumb.tsx", read: () => read("src/app/layout/PageBreadcrumb.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.publish]: [
      { path: "src/builder/inspector/PublishPanel.tsx", read: () => read("src/builder/inspector/PublishPanel.tsx") },
    ],
    [BUILDER42_TOUR_ANCHORS.profileMenu]: [
      { path: "src/app/layout/ProfileMenu.tsx", read: () => read("src/app/layout/ProfileMenu.tsx") },
    ],
  };

  it("registers every anchor key exactly once (§3.2 table)", () => {
    const expectedKeys = Object.values(BUILDER42_TOUR_ANCHORS);
    const coveredKeys = Object.keys(filesByAnchor);
    expect(coveredKeys.sort()).toEqual([...expectedKeys].sort());
  });

  it.each(Object.entries(filesByAnchor))(
    "anchor %s appears exactly once in its source file(s)",
    (key, files) => {
      // PublishPanel tiene DOS call-sites legítimos (rama `disabled` y rama
      // normal, mutuamente excluyentes en runtime — nunca ambos DOM a la vez),
      // así que ese caso admite 2; todos los demás deben ser exactamente 1.
      const isPublish = key === BUILDER42_TOUR_ANCHORS.publish;
      const expectedCount = isPublish ? 2 : 1;

      let total = 0;
      for (const file of files) {
        total += countAnchorCallSites(file.read(), key);
      }
      expect(total, `expected ${expectedCount} call-site(s) for "${key}"`).toBe(expectedCount);
    },
  );

  // Guardia para el bug T2: un call-site `{...dataTourAttr(BUILDER42_TOUR_ANCHORS.x)}`
  // puede colarse sin el `import { dataTourAttr, BUILDER42_TOUR_ANCHORS } from
  // "@/app/tour/tourAnchors"` correspondiente — el grep de arriba solo confirma que
  // el texto del call-site existe, no que los identificadores estén en scope. Ese
  // exacto defecto llegó a `ViewportDropdown.tsx` y solo se vio en el navegador
  // (`ReferenceError: dataTourAttr is not defined`) porque el `tsconfig.json` raíz
  // EXCLUYE `packages/`, este paquete no tiene script `typecheck`, y su entorno
  // vitest es `node` sin jsdom (nada monta el componente). Este caso cierra ese
  // hueco de forma estática: para cada archivo listado en `filesByAnchor`, exige
  // que el import de `dataTourAttr` (aceptando un alias, p. ej. `dataTourAttr as
  // dataTourAttrPbx` en `EditorHeader.tsx`) y el de `BUILDER42_TOUR_ANCHORS` estén
  // presentes y vengan de un módulo cuya ruta termine en `tour/tourAnchors` (el
  // alias interno `@/app/tour/tourAnchors`) o `builder42/tour` (el subpath público
  // del `package.json` de este paquete, que resuelve al mismo `tourAnchors.ts` —
  // el caso de `EditorHeader.tsx`, que vive fuera de `packages/builder42`).
  it.each(
    Object.values(filesByAnchor)
      .flat()
      .filter((file, index, all) => all.findIndex((f) => f.path === file.path) === index),
  )("$path imports dataTourAttr and BUILDER42_TOUR_ANCHORS from tour/tourAnchors", (file) => {
    const source = file.read();
    const importLines = source.match(/^import\s*\{[^}]*\}\s*from\s*["'][^"']*["'];?/gms) ?? [];
    const tourImportLine = importLines.find((line) => /tour\/tourAnchors["']|builder42\/tour["']/.test(line));

    expect(
      tourImportLine,
      `${file.path} is missing an import from a "tour/tourAnchors" (or "builder42/tour") module`,
    ).toBeTruthy();

    const namedImports = tourImportLine!;
    expect(
      /\bdataTourAttr\b(\s+as\s+\w+)?/.test(namedImports),
      `${file.path} calls dataTourAttr(...) but does not import "dataTourAttr" from tour/tourAnchors`,
    ).toBe(true);
    expect(
      /\bBUILDER42_TOUR_ANCHORS\b/.test(namedImports),
      `${file.path} uses BUILDER42_TOUR_ANCHORS but does not import it from tour/tourAnchors`,
    ).toBe(true);
  });

  it("EditorHeader gates pbx.header.identity to the landing identity only (no channel)", () => {
    const source = readHost("src/components/react/shared/EditorHeader.tsx");
    // No debe escribirse incondicionalmente — solo cuando no hay `channel` (Landings
    // pasa `identity` en su lugar, ver `LandingPageBuilder.tsx` → `LANDING_IDENTITY`).
    expect(source).toMatch(/!channel\s*&&\s*identity/);
    expect(source).toContain("BUILDER42_TOUR_ANCHORS.headerIdentity");
  });
});
