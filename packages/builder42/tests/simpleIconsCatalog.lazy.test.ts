import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { exportSite } from "@/builder/export/site";
import { usedSocialIconSlugs } from "@/builder/export/usage";
import { createSiteFromDocument } from "@/builder/model/site";
import type { BuilderDocument, BuilderNode, NodeId } from "@/builder/model/types";
import { simpleIconsCatalog } from "@/builder/registry/catalogs/simpleIcons.catalog";

/**
 * Test de guardia para docs/34 §F11a/§F11a2 (mover el catálogo de
 * simple-icons — 3450 marcas, ~5 MB de string literal, 78% del chunk
 * comprimido del editor — a un chunk lazy, cargado SOLO con `await
 * import()` dentro de `ensure()`).
 *
 * Las tres asserts protegen tres regresiones DISTINTAS que F11a hace
 * posibles y que ningún otro test del paquete toca:
 *
 * (a) **El export queda mudo si `ensure()` no se esperó.** `get()` es
 *     sincrónico y devuelve `undefined` hasta que el barrel cargó.
 *     `exportSite()`/`exportPage()` también son sincrónicos: si el server
 *     llamara a export sin haber esperado `ensure()` antes, el `.zip`
 *     saldría con el icono GENÉRICO en cada red social y nadie lo notaría
 *     (el canvas, que sí re-renderiza cuando el catálogo llega, se ve
 *     perfecto). Antes de F11a esto era IMPOSIBLE — la data estaba siempre
 *     ahí. Esta prueba corre el export real después de `ensure()` y
 *     verifica que el `path` SVG real de la marca (no el genérico) aparece
 *     en el HTML emitido.
 *
 * (b) **La implementación vuelve a ser eager sin que nada lo note.** Si
 *     `get()` empezara a devolver el glifo ANTES de llamar a `ensure()`
 *     (la versión pre-F11a, con el barrel importado de forma estática), el
 *     "ahorro" de bundle habría desaparecido pero todo seguiría en verde —
 *     salvo esta assert, que exige `undefined` antes de `ensure()` y un
 *     valor después, en una instancia de módulo fresca.
 *
 * (c) **El seam se re-fusiona al chunk principal por un import estático
 *     nuevo.** Si cualquier archivo bajo `src/` referenciara
 *     `simpleIcons.catalog.data` fuera de un `await import()` dentro de
 *     `ensure()` — un `import` estático de una sola línea, uno multi-línea,
 *     un side-effect import sin `from`, un `require(...)`, un
 *     `export ... from` con alias, cualquier forma — Vite fusionaría de
 *     vuelta el módulo de ~5 MB en el chunk inicial del editor, sin que
 *     ningún build, typecheck ni audit lo detecte (el código seguiría
 *     siendo válido). Esta assert no reconoce sintaxis de import: quita
 *     comentarios de todo archivo `.ts`/`.tsx` en `src/` y exige que el
 *     nombre del módulo de datos aparezca CERO veces en el código restante
 *     — salvo dentro del propio `import(...)` dinámico autorizado en
 *     `simpleIcons.catalog.ts`, que además debe seguir existiendo.
 */

// -----------------------------------------------------------------------
// (a) El export real: un `social-links` con GitHub y X (ambos SÍ viven en
// simple-icons — LinkedIn NO, es el fallback hardcodeado de SocialLinks.tsx,
// así que probarlo no diría nada sobre el catálogo lazy).
// -----------------------------------------------------------------------

// Paths SVG reales, verificados contra el paquete `simple-icons` instalado
// (node_modules/simple-icons, `siGithub.path` / `siX.path`) en esta misma
// sesión de trabajo, no de memoria.
const GITHUB_PATH_FRAGMENT =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385";
const X_PATH_FRAGMENT = "M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993z";

function makeSocialLinksDocument(): BuilderDocument {
  const rootId = "root" as NodeId;
  const socialId = "social-1" as NodeId;
  const socialNode: BuilderNode = {
    id: socialId,
    type: "social-links",
    props: {
      // La etiqueta "GitHub" (mayúscula) a propósito: `resolveIcon` (en
      // SocialLinks.tsx) resuelve por label MINÚSCULA y sin espacios — si el
      // trim/lowercase se rompiera, esta prueba lo notaría.
      links: [
        { label: "GitHub", value: "https://github.com/octocat" },
        { label: "x", value: "https://x.com/" },
      ],
    },
    style: { base: {} },
  } as BuilderNode;
  return {
    rootId,
    nodes: {
      [rootId]: {
        id: rootId,
        type: "container",
        props: {},
        style: { base: {} },
        children: [socialId],
      } as BuilderNode,
      [socialId]: socialNode,
    },
    meta: { revealOnScroll: false },
  } as BuilderDocument;
}

describe("simpleIconsCatalog — guardia del seam lazy (docs/34 §F11a/§F11a2)", () => {
  it(
    "(a) el export real emite el SVG path de marca real tras esperar ensure() — no el icono genérico",
    async () => {
      const doc = makeSocialLinksDocument();
      const site = createSiteFromDocument(doc, "F11b fixture site");

      const slugs = usedSocialIconSlugs(site);
      expect(slugs).toContain("github");
      expect(slugs).toContain("x");

      await simpleIconsCatalog.ensure(slugs);

      // `exportSite` (facade del editor, @/builder/export/site) es el camino
      // REAL de un .zip: inyecta `viteRuntimeSourceProvider`. Se intentó
      // primero, según la decisión #2 del contrato, y CORRE bajo vitest sin
      // fallback: `viteRuntimeSourceProvider` usa `import.meta.glob`, que
      // Vite (el mismo motor detrás de `vitest`) soporta de forma nativa
      // también en el entorno de test.
      const result = exportSite(site);
      const pageFile = result.files.find(
        (f) => typeof f.contents === "string" && f.path.endsWith(".html"),
      );
      expect(pageFile).toBeDefined();
      const html = pageFile!.contents as string;

      expect(html).toContain(GITHUB_PATH_FRAGMENT);
      expect(html).toContain(X_PATH_FRAGMENT);

      // Negativo: el icono genérico (SocialLinks.tsx `GENERIC_ICON`) NO debe
      // aparecer para estas dos marcas — si apareciera, `ensure()` no habría
      // poblado el catálogo antes del export.
      const GENERIC_ICON_PATH_FRAGMENT =
        "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1";
      expect(html).not.toContain(GENERIC_ICON_PATH_FRAGMENT);
    },
    // Cargar el barrel completo de simple-icons (~5 MB, 3450 marcas) puede
    // tardar más que el timeout default de vitest (5000 ms) en máquinas
    // cargadas o en frío; se sube localmente solo en este test.
    20_000,
  );
});

// -----------------------------------------------------------------------
// (b) El seam es genuinamente lazy: `get()` no puede adelantarse a `ensure()`.
// -----------------------------------------------------------------------

describe("simpleIconsCatalog — laziness del seam", () => {
  it(
    "get('github') es undefined ANTES de ensure() y está definido DESPUÉS, en una instancia de módulo fresca",
    async () => {
      // El test (a) ya corrió antes en este mismo archivo y SÍ llamó a
      // `ensure()`, así que el módulo importado de forma estática arriba
      // (`@/builder/registry/catalogs/simpleIcons.catalog`) ya tiene su
      // `_cache` poblado: reutilizar esa instancia daría un falso verde
      // (el `get()` "antes de ensure()" ya devolvería datos). Por eso se
      // usa `vi.resetModules()` seguido de un `import()` dinámico: eso
      // fuerza una instancia de módulo NUEVA, con su propio `_cache`
      // vacío, para que el `undefined` de abajo sea real y no un
      // artefacto de orden de ejecución.
      const { vi } = await import("vitest");
      vi.resetModules();
      const fresh = await import("@/builder/registry/catalogs/simpleIcons.catalog");

      expect(fresh.simpleIconsCatalog.get("github")).toBeUndefined();

      await fresh.simpleIconsCatalog.ensure(["github"]);

      expect(fresh.simpleIconsCatalog.get("github")).toBeDefined();
      expect(fresh.simpleIconsCatalog.get("github")?.path).toContain(GITHUB_PATH_FRAGMENT);
    },
    20_000,
  );
});

// -----------------------------------------------------------------------
// (c) Nadie importa `simpleIcons.catalog.data` de forma estática.
// -----------------------------------------------------------------------

describe("simpleIconsCatalog — nadie reimporta el módulo de datos de forma estática", () => {
  // Quita comentarios de bloque (`/* ... */`, no-greedy, cruzando líneas) y
  // de línea (`// ...` hasta el fin de línea). No es un tokenizador: no
  // entiende de strings, así que un literal de string que contenga `//` se
  // trataría (incorrectamente) como el inicio de un comentario. Para los
  // archivos que este test escanea (código fuente de `src/`, sin fixtures
  // de texto arbitrario) eso no es un riesgo realista, y añadir un parser
  // completo para evitarlo sería una dependencia nueva para un caso que no
  // ocurre aquí.
  function stripComments(contents: string): string {
    return contents
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");
  }

  const DATA_MODULE_BASENAME = "simpleIcons.catalog.data";
  const OWN_FILE = "simpleIcons.catalog.data.ts";
  const DYNAMIC_IMPORTER_FILE = "simpleIcons.catalog.ts";

  // Import-expresión dinámica que apunta al módulo de datos, p.ej.
  // `await import("./simpleIcons.catalog.data")` o
  // `import ( "../catalogs/simpleIcons.catalog.data" )` con espacios sueltos.
  // Es la ÚNICA forma autorizada de referenciar el módulo fuera de sí mismo.
  const dynamicImportRe =
    /\bimport\s*\(\s*["'][^"']*simpleIcons\.catalog\.data["']\s*\)/g;

  function walk(dir: string, files: string[]): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, files);
      } else if (/\.(ts|tsx)$/.test(entry)) {
        files.push(full);
      }
    }
  }

  it(
    "un import estático (multi-línea, side-effect, require o re-export) de simpleIcons.catalog.data " +
      "en cualquier .ts/.tsx re-fusionaría el chunk de ~5 MB al chunk inicial",
    () => {
      const here = path.dirname(fileURLToPath(import.meta.url));
      const srcRoot = path.resolve(here, "..", "src");

      const allFiles: string[] = [];
      walk(srcRoot, allFiles);
      expect(allFiles.length).toBeGreaterThan(0);

      const offenders: string[] = [];
      let dynamicImporterHasDynamicImport = false;

      for (const file of allFiles) {
        const base = path.basename(file);
        if (base === OWN_FILE) continue;

        const raw = readFileSync(file, "utf8");
        const code = stripComments(raw);

        if (base === DYNAMIC_IMPORTER_FILE) {
          // Cinturón adicional (decisión #4 del contrato): confirmar que el
          // import() dinámico autorizado sigue existiendo aquí — si alguien
          // borra el seam lazy en vez de añadir un import estático, esta
          // assert también debe fallar.
          dynamicImporterHasDynamicImport = dynamicImportRe.test(code);

          // Quitar la(s) ocurrencia(s) del import dinámico autorizado; lo
          // que quede fuera de comentarios no puede volver a nombrar el
          // módulo de datos — eso autoriza el import dinámico y nada más.
          const withoutDynamicImport = code.replace(dynamicImportRe, "");
          if (withoutDynamicImport.includes(DATA_MODULE_BASENAME)) {
            offenders.push(
              `${path.relative(srcRoot, file)} — referencia a "${DATA_MODULE_BASENAME}" fuera del ` +
                `único "await import(...)" dinámico autorizado dentro de ensure() ` +
                `(re-fusionaría el catálogo de simple-icons, ~5 MB, con el chunk inicial del editor; ` +
                `ningún build, typecheck ni audit lo detecta)`,
            );
          }
          continue;
        }

        // Cualquier otro archivo: cero ocurrencias del nombre del módulo de
        // datos fuera de comentarios, sin importar cómo llegue ahí (import
        // multi-línea, `export ... from`, side-effect import sin `from`,
        // `require(...)`, un re-export con alias, etc.) — no hay ninguna
        // razón legítima para que otro módulo lo nombre en código.
        if (code.includes(DATA_MODULE_BASENAME)) {
          offenders.push(
            `${path.relative(srcRoot, file)} — referencia estática a "${DATA_MODULE_BASENAME}" ` +
              `(re-fusiona el catálogo de simple-icons, ~5 MB, con el chunk inicial del editor; ` +
              `ningún build, typecheck ni audit lo detecta; debe cargarse SOLO vía ` +
              `"await import()" dentro de simpleIconsCatalog.ensure())`,
          );
        }
      }

      expect(offenders).toEqual([]);

      // El seam lazy debe seguir existiendo: si `simpleIcons.catalog.ts` ya
      // no contiene el `import()` dinámico, esta assert también falla,
      // aunque nadie haya añadido un import estático en otro archivo.
      expect(dynamicImporterHasDynamicImport).toBe(true);
    },
  );
});

// -----------------------------------------------------------------------
// (d) Todo camino de descarga espera `ensure()` antes de construir el .zip.
// -----------------------------------------------------------------------

describe("simpleIconsCatalog — todo camino que construye un .zip espera ensure() primero", () => {
  /**
   * Caveat 18 del host (`docs/HANDOFF.md`) dice esto en prosa: *cualquier*
   * camino NUEVO de browser que exporte tiene que `await
   * simpleIconsCatalog.ensure(...)` antes, o el `.zip` sale con el icono
   * genérico en vez del glifo de marca real — y se ve bien en el canvas, que sí
   * re-renderiza cuando el catálogo llega, así que nadie lo nota. La assert (a)
   * de arriba prueba que el export honra `ensure()`; ésta prueba que nadie
   * construyó un camino nuevo sin llamarlo, que es la regresión realista: ya
   * pasó que `Canvas.tsx` y `SiteFileActions.tsx` necesitaran el mismo `await`
   * por separado, y el tercero (`Builder42Editor.downloadZip`, el único
   * disponible en modo embebido) existe precisamente porque los otros dos no se
   * montan ahí.
   *
   * El disparador se detecta por `zipSite(` — un `.zip` solo se construye ahí —
   * exceptuando el módulo que la define.
   */
  const ZIP_DEFINITION = path.join("builder", "export", "zip.ts");

  function stripComments(contents: string): string {
    return contents.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  function walkFiles(dir: string, files: string[]): void {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walkFiles(full, files);
      else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
    }
  }

  it("un camino de descarga sin ensure() emitiría el icono genérico sin que ningún gate lo note", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const srcRoot = path.resolve(here, "..", "src");

    const allFiles: string[] = [];
    walkFiles(srcRoot, allFiles);

    const triggers: string[] = [];
    const offenders: string[] = [];

    for (const file of allFiles) {
      const relative = path.relative(srcRoot, file);
      if (relative === ZIP_DEFINITION) continue;
      const code = stripComments(readFileSync(file, "utf8"));
      if (!/\bzipSite\s*\(/.test(code)) continue;
      triggers.push(relative);
      if (!/\bsimpleIconsCatalog\.ensure\s*\(/.test(code)) {
        offenders.push(
          `${relative} — construye un .zip con zipSite() pero nunca llama ` +
            `simpleIconsCatalog.ensure(usedSocialIconSlugs(site)) antes: el archivo saldría con el ` +
            `icono genérico en cada red social (docs/HANDOFF.md caveat 18)`,
        );
      }
    }

    expect(offenders).toEqual([]);
    // Si el conteo cae a cero, el escaneo dejó de encontrar lo que mide (un
    // rename de `zipSite`, una carpeta movida) y la guardia estaría pasando en
    // vacío.
    //
    // El piso es 2 en esta copia: los dos caminos que el paquete monta por sí
    // mismo, `app/layout/Canvas.tsx` (el botón de la vista Code) y
    // `builder/inspector/SiteFileActions.tsx` (el del panel de ajustes del
    // sitio). El tercero, `Builder42EditorHandle.downloadZip()`, es la
    // divergencia #9 de `builder42-landing` (un host embebido no monta ninguno
    // de los dos anteriores) y no está portada aquí todavía: al portarla, sube
    // este piso a 3 en el mismo commit.
    expect(triggers.length).toBeGreaterThanOrEqual(2);
  });
});
